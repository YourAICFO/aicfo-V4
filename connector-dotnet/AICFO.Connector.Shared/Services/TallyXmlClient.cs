using System.Security.Cryptography;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using System.Globalization;
using AICFO.Connector.Shared.Models;
using AICFO.Connector.Shared.Utils;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface ITallyXmlClient
{
    Task<bool> TestConnectionAsync(ConnectorConfig config, CancellationToken cancellationToken);
    Task<bool> TestConnectionAsync(string host, int port, CancellationToken cancellationToken);
    /// <summary>Rich reachability check: GET / first (TallyPrime Server is Running = reachable); if unreachable returns reason (timeout/refused). If reachable but POST fails, ApiRequestFailure is set.</summary>
    Task<TallyReachabilityResult> GetReachabilityAsync(string host, int port, CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetCompanyNamesAsync(string host, int port, CancellationToken cancellationToken);
    Task<TallySnapshot> FetchSnapshotAsync(ConnectorConfig config, string? tallyCompanyName, CancellationToken cancellationToken);
}

public sealed class TallyXmlClient(HttpClient httpClient, ILogger<TallyXmlClient> logger) : ITallyXmlClient
{
    private const int HealthCheckTimeoutSeconds = 5;

    public async Task<bool> TestConnectionAsync(ConnectorConfig config, CancellationToken cancellationToken)
        => await TestConnectionAsync(config.TallyHost, config.TallyPort, cancellationToken);

    public async Task<bool> TestConnectionAsync(string host, int port, CancellationToken cancellationToken)
    {
        var result = await GetReachabilityAsync(host, port, cancellationToken);
        return result.IsReachable;
    }

    /// <summary>Lightweight GET / first; if response contains "TallyPrime Server is Running" or valid Tally XML, server is reachable. Then optionally validate POST; if POST fails, still reachable but ApiRequestFailure set.</summary>
    public async Task<TallyReachabilityResult> GetReachabilityAsync(string host, int port, CancellationToken cancellationToken)
    {
        var baseUrl = $"http://{host}:{port}";
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(HealthCheckTimeoutSeconds));

        try
        {
            var getUrl = baseUrl + "/";
            using var request = new HttpRequestMessage(HttpMethod.Get, getUrl);
            using var response = await httpClient.SendAsync(request, timeoutCts.Token);
            var body = await response.Content.ReadAsStringAsync(timeoutCts.Token);
            logger.LogInformation("[INF] Tally GET {Url} => {StatusCode}", getUrl, (int)response.StatusCode);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Tally GET / returned {StatusCode} host={Host} port={Port}", response.StatusCode, host, port);
                return new TallyReachabilityResult(
                    IsReachable: false,
                    UnreachableReason: $"HTTP {(int)response.StatusCode}",
                    ApiRequestFailure: null);
            }

            if (IsTallyServerRunningResponse(body))
            {
                var apiFailure = (string?)null;
                try
                {
                    var postResponse = await PostXmlAsync(host, port, BuildCompanyInfoRequest(), cancellationToken);
                    apiFailure = ClassifyPostResponse(postResponse);
                    logger.LogInformation("[INF] Tally POST List of Companies => {Result}", apiFailure is null ? "OK" : apiFailure);
                }
                catch (Exception ex)
                {
                    apiFailure = ex.Message;
                    logger.LogWarning(ex, "[INF] Tally POST List of Companies => Exception {Type}: {Message}", ex.GetType().Name, ex.Message);
                }

                return new TallyReachabilityResult(IsReachable: true, UnreachableReason: null, ApiRequestFailure: apiFailure);
            }

            return new TallyReachabilityResult(
                IsReachable: false,
                UnreachableReason: "Unexpected response (not Tally server).",
                ApiRequestFailure: null);
        }
        catch (OperationCanceledException) when (timeoutCts.Token.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Tally health check timed out host={Host} port={Port}", host, port);
            return new TallyReachabilityResult(IsReachable: false, UnreachableReason: "Timeout", ApiRequestFailure: null);
        }
        catch (HttpRequestException ex)
        {
            var reason = ex.InnerException?.Message ?? ex.Message;
            var refused = reason.Contains("refused", StringComparison.OrdinalIgnoreCase) || reason.Contains("actively refused", StringComparison.OrdinalIgnoreCase);
            logger.LogWarning(ex, "Tally request failed host={Host} port={Port}", host, port);
            return new TallyReachabilityResult(
                IsReachable: false,
                UnreachableReason: refused ? "Connection refused" : reason,
                ApiRequestFailure: null);
        }
        catch (TaskCanceledException)
        {
            return new TallyReachabilityResult(IsReachable: false, UnreachableReason: "Timeout", ApiRequestFailure: null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Tally reachability check failed host={Host} port={Port}", host, port);
            return new TallyReachabilityResult(IsReachable: false, UnreachableReason: ex.Message, ApiRequestFailure: null);
        }
    }

    /// <summary>Public for testing. Returns true if the response body indicates Tally/TallyPrime server is running.</summary>
    public static bool IsTallyServerRunningResponse(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return false;
        var b = body.Trim();
        if (b.Contains("TallyPrime Server is Running", StringComparison.OrdinalIgnoreCase)) return true;
        if (b.Contains("Tally Server is Running", StringComparison.OrdinalIgnoreCase)) return true;
        // Require both "Tally" and "Running" for generic matches — do NOT match <RESPONSE> alone,
        // as license pages / gateways may wrap arbitrary content in a <RESPONSE> element.
        if (b.Contains("Tally", StringComparison.OrdinalIgnoreCase) && b.Contains("Running", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    /// <summary>
    /// Classifies a Tally POST response body. Returns null when the response is valid (contains company data),
    /// or a human-readable ApiRequestFailure string for known error patterns.
    /// Public for testing.
    /// </summary>
    public static string? ClassifyPostResponse(string? postResponse)
    {
        if (string.IsNullOrWhiteSpace(postResponse))
            return "Empty response from Tally XML API.";

        // "Unknown Request" — port is a gateway/license server, not an XML export endpoint.
        if (postResponse.Contains("Unknown Request", StringComparison.OrdinalIgnoreCase))
            return "Tally XML API is not enabled on this port (Unknown Request). " +
                   "Enable XML import/export in Tally Gateway settings.";

        // <LINEERROR> — Tally returned a structured error.
        var lineErrorStart = postResponse.IndexOf("<LINEERROR>", StringComparison.OrdinalIgnoreCase);
        if (lineErrorStart >= 0)
        {
            var valueStart = lineErrorStart + "<LINEERROR>".Length;
            var lineErrorEnd = postResponse.IndexOf("</LINEERROR>", valueStart, StringComparison.OrdinalIgnoreCase);
            var errorText = lineErrorEnd > valueStart
                ? postResponse.Substring(valueStart, lineErrorEnd - valueStart).Trim()
                : "(see Tally logs)";
            return $"Tally returned LINEERROR: {errorText}";
        }

        // HTML / wrong endpoint — license or gateway page, not XML API.
        if (postResponse.Contains("<html", StringComparison.OrdinalIgnoreCase) ||
            postResponse.Contains("License server is Running", StringComparison.OrdinalIgnoreCase) ||
            postResponse.Contains("</html>", StringComparison.OrdinalIgnoreCase))
            return "Wrong endpoint or not Tally XML API (HTML/license page). Use Tally XML port and enable XML in Gateway of Tally.";

        // Valid XML export — must contain at least one company entry OR an empty but well-formed envelope.
        if (postResponse.Contains("<COMPANYNAME>", StringComparison.OrdinalIgnoreCase) ||
            postResponse.Contains("<ENVELOPE>", StringComparison.OrdinalIgnoreCase))
            return null; // OK

        return "Tally XML API returned an unexpected response format.";
    }

    /// <summary>Tag names used by Tally for company name in List of Companies export (varies by version).</summary>
    private static readonly string[] CompanyNameTagNames = ["COMPANYNAME", "NAME", "COMPANY", "CMPNAME"];

    public async Task<IReadOnlyList<string>> GetCompanyNamesAsync(string host, int port, CancellationToken cancellationToken)
    {
        var (decoded, statusCode, contentType, rawBytes) = await PostXmlWithDiagnosticsAsync(host, port, BuildCompanyInfoRequest(), cancellationToken);

        // Detect HTML / wrong endpoint before parsing.
        if (IsHtmlOrNonXmlResponse(decoded))
        {
            logger.LogWarning("Tally company list: response is HTML or non-XML (status={StatusCode} len={Len}). Wrong port or enable XML in Tally.",
                (int)statusCode, rawBytes.Length);
            return [];
        }

        var names = ExtractCompanyNamesFromXml(decoded);
        if (names.Count == 0)
        {
            var snippet = decoded.Length > 300 ? decoded.Substring(0, 300) + "..." : decoded;
            logger.LogWarning("Tally company list: 0 companies extracted. StatusCode={StatusCode} ContentType={ContentType} Len={Len} Snippet={Snippet}",
                (int)statusCode, contentType ?? "(null)", rawBytes.Length, LogRedaction.RedactSecrets(snippet));
        }
        else
        {
            logger.LogInformation("[INF] Tally company list: {Count} companies", names.Count);
        }

        return names;
    }

    private static bool IsHtmlOrNonXmlResponse(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return true;
        var b = body.TrimStart();
        if (b.StartsWith("<html", StringComparison.OrdinalIgnoreCase)) return true;
        if (b.Contains("License server is Running", StringComparison.OrdinalIgnoreCase)) return true;
        if (b.Contains("</html>", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    /// <summary>Extract company names from Tally XML; supports COMPANYNAME, NAME, COMPANY, CMPNAME.</summary>
    public static List<string> ExtractCompanyNamesFromXml(string? xml)
    {
        if (string.IsNullOrWhiteSpace(xml)) return [];
        var (sanitized, _) = XmlSanitizer.Sanitize(xml);
        try
        {
            var doc = XDocument.Parse(sanitized);
            var names = new List<string>();
            foreach (var element in doc.Descendants())
            {
                if (CompanyNameTagNames.Any(tag => string.Equals(element.Name.LocalName, tag, StringComparison.OrdinalIgnoreCase)))
                {
                    var v = element.Value?.Trim();
                    if (!string.IsNullOrWhiteSpace(v)) names.Add(v);
                }
            }
            return names.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        catch
        {
            return [];
        }
    }

    /// <summary>POST and return decoded body + raw bytes and response metadata for diagnostics.</summary>
    private async Task<(string decoded, int statusCode, string? contentType, byte[] rawBytes)> PostXmlWithDiagnosticsAsync(string host, int port, string body, CancellationToken cancellationToken)
    {
        var url = $"http://{host}:{port}";
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "text/xml")
        };
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var rawBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        var contentType = response.Content.Headers.ContentType?.ToString();
        var decoded = DecodeTallyResponse(rawBytes, contentType);
        logger.LogInformation("[INF] Tally POST List of Companies => StatusCode={Code} ContentType={Ct} Len={Len}",
            (int)response.StatusCode, contentType ?? "-", rawBytes.Length);
        return (decoded, (int)response.StatusCode, contentType, rawBytes);
    }

    private static string DecodeTallyResponse(byte[] bytes, string? contentType)
    {
        if (bytes.Length == 0) return string.Empty;
        // UTF-16 LE BOM
        if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
            return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);
        // UTF-16 BE BOM
        if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
            return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);
        // UTF-8 BOM
        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
            return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        // Default UTF-8
        return Encoding.UTF8.GetString(bytes);
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
                var rawBytes = await response.Content.ReadAsByteArrayAsync(timeoutCts.Token);
                var contentType = response.Content.Headers.ContentType?.ToString();
                return DecodeTallyResponse(rawBytes, contentType);
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

    public async Task<TallySnapshot> FetchSnapshotAsync(ConnectorConfig config, string? tallyCompanyName, CancellationToken cancellationToken)
    {
        _ = await PostXmlAsync(config.TallyHost, config.TallyPort, BuildCompanyInfoRequest(), cancellationToken);
        var currentMonthKey = DateTime.UtcNow.ToString("yyyy-MM");

        var groupsResponse = await PostXmlAsync(config.TallyHost, config.TallyPort, BuildGroupRequest(tallyCompanyName), cancellationToken);
        var ledgersResponse = await PostXmlAsync(config.TallyHost, config.TallyPort, BuildLedgerRequest(tallyCompanyName), cancellationToken);

        var (groupsXml, groupsRemoved) = XmlSanitizer.Sanitize(groupsResponse);
        if (groupsRemoved > 0)
            logger.LogWarning("[TALLY] Sanitized invalid XML chars removedCount={N} lengthBefore={A} lengthAfter={B}", groupsRemoved, groupsResponse.Length, groupsXml.Length);
        List<TallyGroup> groups;
        try { groups = ParseGroups(groupsXml); }
        catch (XmlException ex) { LogXmlException(ex, groupsXml, "ParseGroups"); throw; }

        var (ledgersXml, ledgersRemoved) = XmlSanitizer.Sanitize(ledgersResponse);
        if (ledgersRemoved > 0)
            logger.LogWarning("[TALLY] Sanitized invalid XML chars removedCount={N} lengthBefore={A} lengthAfter={B}", ledgersRemoved, ledgersResponse.Length, ledgersXml.Length);
        List<TallyLedger> ledgers;
        try { ledgers = ParseLedgers(ledgersXml); }
        catch (XmlException ex) { LogXmlException(ex, ledgersXml, "ParseLedgers"); throw; }
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

                var (monthLedgersXml, monthRemoved) = XmlSanitizer.Sanitize(monthlyLedgerResponse);
                if (monthRemoved > 0)
                    logger.LogWarning("[TALLY] Sanitized invalid XML chars removedCount={N} lengthBefore={A} lengthAfter={B}", monthRemoved, monthlyLedgerResponse.Length, monthLedgersXml.Length);
                List<TallyLedger> monthLedgers;
                try { monthLedgers = ParseLedgers(monthLedgersXml); }
                catch (XmlException ex) { LogXmlException(ex, monthLedgersXml, "ParseLedgers(monthly)"); throw; }
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

    private void LogXmlException(XmlException ex, string xml, string context)
    {
        const int snippetLen = 300;
        var snippet = GetSnippetAroundPosition(xml, ex.LineNumber, ex.LinePosition, snippetLen);
        logger.LogWarning(ex, "[TALLY] XmlException in {Context}: {Message}. Snippet (~{Len} chars): {Snippet}", context, ex.Message, snippet?.Length ?? 0, snippet ?? "(null)");
    }

    private static string? GetSnippetAroundPosition(string xml, int lineNumber, int linePosition, int totalChars)
    {
        if (string.IsNullOrEmpty(xml) || lineNumber < 1 || linePosition < 1) return null;
        var line = 1;
        var col = 1;
        var pos = 0;
        for (; pos < xml.Length && line < lineNumber; pos++)
        {
            if (xml[pos] == '\n') line++;
        }
        for (; pos < xml.Length && col < linePosition; pos++, col++) { }
        var half = totalChars / 2;
        var start = Math.Max(0, pos - half);
        var len = Math.Min(totalChars, xml.Length - start);
        return len <= 0 ? null : xml.Substring(start, len);
    }
}
