using System.Text.Json.Serialization;

namespace AICFO.Connector.Shared.Models;

public sealed class CoaContractPayload
{
    [JsonPropertyName("chartOfAccounts")]
    public required CoaContractChartOfAccounts ChartOfAccounts { get; init; }

    [JsonPropertyName("asOfDate")]
    public required string AsOfDate { get; init; }
}

public sealed class CoaContractChartOfAccounts
{
    [JsonPropertyName("source")]
    public string Source { get; init; } = "tally";

    [JsonPropertyName("generatedAt")]
    public string GeneratedAt { get; init; } = DateTime.UtcNow.ToString("O");

    [JsonPropertyName("groups")]
    public required List<CoaGroupDto> Groups { get; init; }

    [JsonPropertyName("ledgers")]
    public required List<CoaLedgerDto> Ledgers { get; init; }

    [JsonPropertyName("balances")]
    public CoaBalancesDto? Balances { get; init; }
}

public sealed class CoaGroupDto
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("parent")]
    public required string Parent { get; init; }

    [JsonPropertyName("reservedName")]
    public string ReservedName { get; init; } = string.Empty;

    [JsonPropertyName("guid")]
    public required string Guid { get; init; }

    [JsonPropertyName("type")]
    public string Type { get; init; } = "Group";
}

public sealed class CoaLedgerDto
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("parent")]
    public required string Parent { get; init; }

    [JsonPropertyName("guid")]
    public required string Guid { get; init; }

    [JsonPropertyName("type")]
    public string Type { get; init; } = "Ledger";

    [JsonPropertyName("groupName")]
    public string? GroupName { get; init; }

    [JsonPropertyName("closingBalance")]
    public decimal ClosingBalance { get; init; }
}

public sealed class CoaBalancesDto
{
    [JsonPropertyName("current")]
    public CoaCurrentBalanceDto? Current { get; init; }

    [JsonPropertyName("closedMonths")]
    public List<CoaClosedMonthDto> ClosedMonths { get; init; } = new();
}

public sealed class CoaCurrentBalanceDto
{
    [JsonPropertyName("monthKey")]
    public required string MonthKey { get; init; }

    [JsonPropertyName("asOfDate")]
    public required string AsOfDate { get; init; }

    [JsonPropertyName("items")]
    public required List<CoaBalanceItemDto> Items { get; init; }
}

public sealed class CoaClosedMonthDto
{
    [JsonPropertyName("monthKey")]
    public required string MonthKey { get; init; }

    [JsonPropertyName("items")]
    public required List<CoaBalanceItemDto> Items { get; init; }
}

public sealed class CoaBalanceItemDto
{
    [JsonPropertyName("ledgerGuid")]
    public required string LedgerGuid { get; init; }

    [JsonPropertyName("balance")]
    public decimal Balance { get; init; }
}
