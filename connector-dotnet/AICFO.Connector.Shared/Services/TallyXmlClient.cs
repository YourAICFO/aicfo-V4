using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using System.Globalization;
using AICFO.Connector.Shared.Models;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface ITallyXmlClient
{
    Task<bool> TestConnectionAsync(ConnectorConfig config, CancellationToken cancellationToken);
    Task<bool> TestConnectionAsync(string host, int port, CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetCompanyNamesAsync(string host, int port, CancellationToken cancellationToken);
    Task<TallySnapshot> FetchSnapshotAsync(ConnectorConfig config, string? tallyCompanyName, CancellationToken cancellationToken);
}

public sealed class TallyXmlClient(HttpClient httpClient, ILogger<TallyXmlClient> logger) : ITallyXmlClient
{
    public async Task<bool> TestConnectionAsync(ConnectorConfig config, CancellationToken cancellationToken)
        => await TestConnectionAsync(config.TallyHost, config.TallyPort, cancellationToken);

    public async Task<bool> TestConnectionAsync(string host, int port, CancellationToken cancellationToken)
    {
        try
        {
            var response = await PostXmlAsync(host, port, BuildCompanyInfoRequest(), cancellationToken);
            return response.Contains("<COMPANYNAME>", StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Tally connection test failed host={Host} port={Port}", host, port);
            return false;
        }
    }

    public async Task<IReadOnlyList<string>> GetCompanyNamesAsync(string host, int port, CancellationToken cancellationToken)
    {
        var response = await PostXmlAsync(host, port, BuildCompanyInfoRequest(), cancellationToken);
        var doc = XDocument.Parse(response);
        var names = doc
            .Descendants()
            .Where(e => string.Equals(e.Name.LocalName, "COMPANYNAME", StringComparison.OrdinalIgnoreCase))
            .Select(e => e.Value?.Trim())
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return names;
    }

    public async Task<TallySnapshot> FetchSnapshotAsync(ConnectorConfig config, string? tallyCompanyName, CancellationToken cancellationToken)
    {
        _ = await PostXmlAsync(config.TallyHost, config.TallyPort, BuildCompanyInfoRequest(), cancellationToken);
        var currentMonthKey = DateTime.UtcNow.ToString("yyyy-MM");

        var groupsResponse = await PostXmlAsync(config.TallyHost, config.TallyPort, BuildGroupRequest(tallyCompanyName), cancellationToken);
        var ledgersResponse = await PostXmlAsync(config.TallyHost, config.TallyPort, BuildLedgerRequest(tallyCompanyName), cancellationToken);

        var groups = ParseGroups(groupsResponse);
        var ledgers = ParseLedgers(ledgersResponse);
        if (ledgers.Count > config.MaxLedgerCountWarning)
        {
            logger.LogWarning(
                "Tally ledger count is high ledgers={LedgerCount} threshold={Threshold}; sync may take longer.",
                ledgers.Count,
                config.MaxLedgerCountWarning);
        }

        // Add top-level parent if missing to keep parent traversal deterministic.
        if (!groups.Any(g => string.Equals(g.Name, "Primary", StringComparison.OrdinalIgnoreCase)))
        {
            groups.Insert(0, new TallyGroup("Primary", string.Empty, "", HashGuid("group:Primary")));
        }

        var knownLedgerGuids = ledgers.Select(ledger => ledger.Guid).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var requestedMonthKeys = MonthWindowHelper.GetMonthKeys(config.HistoricalMonthsToSync, includeCurrent: false);
        var closedMonths = new List<TallyClosedMonthBalance>();
        var missingMonthKeys = new List<string>();
        foreach (var monthKey in requestedMonthKeys)
        {
            try
            {
                var monthStart = MonthWindowHelper.GetMonthStart(monthKey);
                var monthEnd = MonthWindowHelper.GetMonthEnd(monthKey);
                var monthlyLedgerResponse = await PostXmlAsync(
                    config.TallyHost,
                    config.TallyPort,
                    BuildLedgerRequest(tallyCompanyName, monthStart, monthEnd),
                    cancellationToken,
                    config);

                var monthLedgers = ParseLedgers(monthlyLedgerResponse);
                var monthItems = monthLedgers
                    .Where(ledger => knownLedgerGuids.Contains(ledger.Guid))
                    .Select(ledger => new TallyBalanceItem(ledger.Guid, ledger.ClosingBalance))
                    .ToList();
                if (monthItems.Count == 0)
                {
                    missingMonthKeys.Add(monthKey);
                    continue;
                }
                closedMonths.Add(new TallyClosedMonthBalance(monthKey, monthItems));
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to fetch monthly balances for month={MonthKey}; continuing with partial history.", monthKey);
                missingMonthKeys.Add(monthKey);
            }
        }

        var partyBalances = BuildPartyBalances(ledgers);
        var loans = BuildLoanBalances(ledgers);
        var interestSummary = BuildInterestSummary(currentMonthKey, ledgers);

        logger.LogInformation("Parsed Tally snapshot groups={GroupCount} ledgers={LedgerCount}", groups.Count, ledgers.Count);

        return new TallySnapshot
        {
            Groups = groups,
            Ledgers = ledgers,
            AsOfDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CurrentMonthKey = currentMonthKey,
            RequestedClosedMonths = requestedMonthKeys.Count,
            ClosedMonths = closedMonths,
            MissingClosedMonths = missingMonthKeys,
            PartyBalances = partyBalances,
            Loans = loans,
            InterestSummary = interestSummary
        };
    }

    private async Task<string> PostXmlAsync(string host, int port, string body, CancellationToken cancellationToken, ConnectorConfig? config = null)
    {
        var timeoutSeconds = config?.TallyRequestTimeoutSeconds is > 0 ? config.TallyRequestTimeoutSeconds : 30;
        var maxRetries = config?.TallyRequestMaxRetries is >= 0 ? config.TallyRequestMaxRetries : 3;
        var url = $"http://{host}:{port}";
        var attempt = 0;

        while (true)
        {
            attempt++;
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(body, Encoding.UTF8, "text/xml")
                };

                using var response = await httpClient.SendAsync(request, timeoutCts.Token);
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync(timeoutCts.Token);
            }
            catch (Exception ex) when (attempt <= maxRetries && !cancellationToken.IsCancellationRequested)
            {
                var delay = TimeSpan.FromMilliseconds(Math.Min(2000 * attempt, 10000));
                logger.LogWarning(
                    ex,
                    "Tally XML request retry host={Host} port={Port} attempt={Attempt} maxRetries={MaxRetries} delayMs={DelayMs}",
                    host,
                    port,
                    attempt,
                    maxRetries,
                    delay.TotalMilliseconds);
                await Task.Delay(delay, cancellationToken);
            }
        }
    }

    private static string BuildCompanyInfoRequest() =>
        """
        <ENVELOPE>
          <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>List of Companies</ID>
          </HEADER>
          <BODY>
            <DESC>
              <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              </STATICVARIABLES>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;

    private static string BuildGroupRequest(string? companyName)
    {
        var companyVariable = string.IsNullOrWhiteSpace(companyName)
            ? string.Empty
            : $"<SVCURRENTCOMPANY>{System.Security.SecurityElement.Escape(companyName)}</SVCURRENTCOMPANY>";

        return $"""
        <ENVELOPE>
          <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>List of Groups</ID>
          </HEADER>
          <BODY>
            <DESC>
              <STATICVARIABLES>
                {companyVariable}
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              </STATICVARIABLES>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;
    }

    private static string BuildLedgerRequest(string? companyName, DateOnly? fromDate = null, DateOnly? toDate = null)
    {
        var companyVariable = string.IsNullOrWhiteSpace(companyName)
            ? string.Empty
            : $"<SVCURRENTCOMPANY>{System.Security.SecurityElement.Escape(companyName)}</SVCURRENTCOMPANY>";
        var fromDateVariable = fromDate is null ? string.Empty : $"<SVFROMDATE>{fromDate.Value:yyyyMMdd}</SVFROMDATE>";
        var toDateVariable = toDate is null ? string.Empty : $"<SVTODATE>{toDate.Value:yyyyMMdd}</SVTODATE>";

        return $"""
        <ENVELOPE>
          <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>List of Ledgers</ID>
          </HEADER>
          <BODY>
            <DESC>
              <STATICVARIABLES>
                {companyVariable}
                {fromDateVariable}
                {toDateVariable}
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              </STATICVARIABLES>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;
    }

    private static List<TallyGroup> ParseGroups(string xml)
    {
        var doc = XDocument.Parse(xml);
        var groups = doc
            .Descendants()
            .Where(e => string.Equals(e.Name.LocalName, "GROUP", StringComparison.OrdinalIgnoreCase))
            .Select(group =>
            {
                var name = Value(group, "NAME");
                var parent = Value(group, "PARENT");
                var reserved = Value(group, "RESERVEDNAME");
                var guid = Value(group, "GUID");

                return new TallyGroup(
                    Name: string.IsNullOrWhiteSpace(name) ? "Unknown Group" : name,
                    Parent: string.IsNullOrWhiteSpace(parent) ? "Primary" : parent,
                    ReservedName: reserved,
                    Guid: string.IsNullOrWhiteSpace(guid) ? HashGuid($"group:{name}:{parent}") : guid
                );
            })
            .DistinctBy(g => g.Guid)
            .ToList();

        return groups;
    }

    private static List<TallyLedger> ParseLedgers(string xml)
    {
        var doc = XDocument.Parse(xml);
        var ledgers = doc
            .Descendants()
            .Where(e => string.Equals(e.Name.LocalName, "LEDGER", StringComparison.OrdinalIgnoreCase))
            .Select(ledger =>
            {
                var name = Value(ledger, "NAME");
                var parent = Value(ledger, "PARENT");
                var guid = Value(ledger, "GUID");
                var reserved = Value(ledger, "RESERVEDNAME");
                var closingBalanceRaw = Value(ledger, "CLOSINGBALANCE");
                _ = decimal.TryParse(closingBalanceRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var closingBalance);

                return new TallyLedger(
                    Name: string.IsNullOrWhiteSpace(name) ? "Unknown Ledger" : name,
                    Parent: string.IsNullOrWhiteSpace(parent) ? "Primary" : parent,
                    Guid: string.IsNullOrWhiteSpace(guid) ? HashGuid($"ledger:{name}:{parent}") : guid,
                    ClosingBalance: closingBalance,
                    ReservedName: reserved,
                    GroupName: parent
                );
            })
            .DistinctBy(l => l.Guid)
            .ToList();

        return ledgers;
    }

    private static TallyPartyBalances BuildPartyBalances(List<TallyLedger> ledgers)
    {
        var debtors = ledgers
            .Where(ledger => IsDebtorParent(ledger.Parent))
            .Select(ledger => new TallyPartyAmount(NormalizeName(ledger.Name), ledger.ClosingBalance))
            .Where(item => !string.IsNullOrWhiteSpace(item.Name) && item.Amount != 0)
            .OrderByDescending(item => Math.Abs(item.Amount))
            .ToList();

        var creditors = ledgers
            .Where(ledger => IsCreditorParent(ledger.Parent))
            .Select(ledger => new TallyPartyAmount(NormalizeName(ledger.Name), ledger.ClosingBalance))
            .Where(item => !string.IsNullOrWhiteSpace(item.Name) && item.Amount != 0)
            .OrderByDescending(item => Math.Abs(item.Amount))
            .ToList();

        return new TallyPartyBalances
        {
            AsOfDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Debtors = debtors.Take(200).ToList(),
            Creditors = creditors.Take(200).ToList(),
            DebtorsTotalCount = debtors.Count,
            CreditorsTotalCount = creditors.Count
        };
    }

    private static List<TallyLoanBalance> BuildLoanBalances(List<TallyLedger> ledgers) =>
        ledgers
            .Where(ledger => IsLoanParent(ledger.Parent))
            .Where(ledger => ledger.ClosingBalance != 0)
            .Select(ledger => new TallyLoanBalance(
                LedgerGuid: ledger.Guid,
                Name: NormalizeName(ledger.Name),
                Parent: NormalizeName(ledger.Parent),
                Balance: ledger.ClosingBalance))
            .OrderByDescending(item => Math.Abs(item.Balance))
            .ToList();

    private static TallyInterestSummary? BuildInterestSummary(string monthKey, List<TallyLedger> ledgers)
    {
        var total = ledgers
            .Where(ledger => IsInterestLedger(ledger))
            .Sum(ledger => Math.Abs(ledger.ClosingBalance));
        if (total <= 0) return null;

        return new TallyInterestSummary
        {
            MonthKey = monthKey,
            LatestMonthAmount = total
        };
    }

    private static bool IsDebtorParent(string? parent) =>
        NormalizeName(parent).Contains("sundry debtors", StringComparison.OrdinalIgnoreCase)
        || NormalizeName(parent).Contains("debtors", StringComparison.OrdinalIgnoreCase)
        || NormalizeName(parent).Contains("accounts receivable", StringComparison.OrdinalIgnoreCase);

    private static bool IsCreditorParent(string? parent) =>
        NormalizeName(parent).Contains("sundry creditors", StringComparison.OrdinalIgnoreCase)
        || NormalizeName(parent).Contains("creditors", StringComparison.OrdinalIgnoreCase)
        || NormalizeName(parent).Contains("accounts payable", StringComparison.OrdinalIgnoreCase);

    private static bool IsLoanParent(string? parent)
    {
        var normalized = NormalizeName(parent);
        return normalized.Contains("secured loans", StringComparison.OrdinalIgnoreCase)
               || normalized.Contains("unsecured loans", StringComparison.OrdinalIgnoreCase)
               || normalized.Contains("loans (liability)", StringComparison.OrdinalIgnoreCase)
               || normalized.Contains("loan", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsInterestLedger(TallyLedger ledger)
    {
        var name = NormalizeName(ledger.Name);
        var parent = NormalizeName(ledger.Parent);
        return name.Contains("interest", StringComparison.OrdinalIgnoreCase)
               || parent.Contains("interest", StringComparison.OrdinalIgnoreCase)
               || parent.Contains("finance cost", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeName(string? value) =>
        string.Join(" ", (value ?? string.Empty).Trim().Split([' ', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries));

    private static string Value(XElement root, string nodeName) =>
        root.Descendants().FirstOrDefault(x => string.Equals(x.Name.LocalName, nodeName, StringComparison.OrdinalIgnoreCase))?.Value?.Trim() ?? string.Empty;

    private static string HashGuid(string input)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash).Substring(0, 32).ToLowerInvariant();
    }
}
