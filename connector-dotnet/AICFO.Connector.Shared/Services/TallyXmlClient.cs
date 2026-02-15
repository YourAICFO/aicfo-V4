using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using AICFO.Connector.Shared.Models;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface ITallyXmlClient
{
    Task<bool> TestConnectionAsync(ConnectorConfig config, CancellationToken cancellationToken);
    Task<TallySnapshot> FetchSnapshotAsync(ConnectorConfig config, CancellationToken cancellationToken);
}

public sealed class TallyXmlClient(HttpClient httpClient, ILogger<TallyXmlClient> logger) : ITallyXmlClient
{
    public async Task<bool> TestConnectionAsync(ConnectorConfig config, CancellationToken cancellationToken)
    {
        try
        {
            var xml = BuildCompanyInfoRequest();
            var response = await PostXmlAsync(config, xml, cancellationToken);
            return response.Contains("<COMPANYNAME>", StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Tally connection test failed");
            return false;
        }
    }

    public async Task<TallySnapshot> FetchSnapshotAsync(ConnectorConfig config, CancellationToken cancellationToken)
    {
        var companyResponse = await PostXmlAsync(config, BuildCompanyInfoRequest(), cancellationToken);
        var currentMonthKey = DateTime.UtcNow.ToString("yyyy-MM");

        var groupsResponse = await PostXmlAsync(config, BuildGroupRequest(), cancellationToken);
        var ledgersResponse = await PostXmlAsync(config, BuildLedgerRequest(), cancellationToken);

        var groups = ParseGroups(groupsResponse);
        var ledgers = ParseLedgers(ledgersResponse);

        // Add top-level parent if missing to keep parent traversal deterministic.
        if (!groups.Any(g => string.Equals(g.Name, "Primary", StringComparison.OrdinalIgnoreCase)))
        {
            groups.Insert(0, new TallyGroup("Primary", string.Empty, "", HashGuid("group:Primary")));
        }

        logger.LogInformation("Parsed Tally snapshot groups={GroupCount} ledgers={LedgerCount}", groups.Count, ledgers.Count);

        return new TallySnapshot
        {
            Groups = groups,
            Ledgers = ledgers,
            AsOfDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CurrentMonthKey = currentMonthKey,
            ClosedMonths = []
        };
    }

    private async Task<string> PostXmlAsync(ConnectorConfig config, string body, CancellationToken cancellationToken)
    {
        var url = $"http://{config.TallyHost}:{config.TallyPort}";
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "text/xml")
        };

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync(cancellationToken);
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

    private static string BuildGroupRequest() =>
        """
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
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              </STATICVARIABLES>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;

    private static string BuildLedgerRequest() =>
        """
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
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              </STATICVARIABLES>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;

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

                _ = decimal.TryParse(closingBalanceRaw, out var closingBalance);

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

    private static string Value(XElement root, string nodeName) =>
        root.Descendants().FirstOrDefault(x => string.Equals(x.Name.LocalName, nodeName, StringComparison.OrdinalIgnoreCase))?.Value?.Trim() ?? string.Empty;

    private static string HashGuid(string input)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash).Substring(0, 32).ToLowerInvariant();
    }
}
