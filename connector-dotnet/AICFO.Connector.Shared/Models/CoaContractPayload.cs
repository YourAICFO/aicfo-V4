using System.Text.Json.Serialization;

namespace AICFO.Connector.Shared.Models;

public sealed class CoaContractPayload
{
    [JsonPropertyName("chartOfAccounts")]
    public required CoaContractChartOfAccounts ChartOfAccounts { get; init; }

    [JsonPropertyName("asOfDate")]
    public required string AsOfDate { get; init; }

    [JsonPropertyName("partyBalances")]
    public CoaPartyBalancesDto? PartyBalances { get; init; }

    [JsonPropertyName("loans")]
    public CoaLoansDto? Loans { get; init; }

    [JsonPropertyName("interestSummary")]
    public CoaInterestSummaryDto? InterestSummary { get; init; }

    [JsonPropertyName("metadata")]
    public CoaPayloadMetadataDto? Metadata { get; init; }
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

    [JsonPropertyName("asOfDate")]
    public string? AsOfDate { get; init; }

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

public sealed class CoaPartyBalancesDto
{
    [JsonPropertyName("asOfDate")]
    public required string AsOfDate { get; init; }

    [JsonPropertyName("debtors")]
    public required List<CoaPartyAmountDto> Debtors { get; init; }

    [JsonPropertyName("creditors")]
    public required List<CoaPartyAmountDto> Creditors { get; init; }

    [JsonPropertyName("debtorsTotalCount")]
    public int DebtorsTotalCount { get; init; }

    [JsonPropertyName("creditorsTotalCount")]
    public int CreditorsTotalCount { get; init; }
}

public sealed class CoaPartyAmountDto
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }
}

public sealed class CoaLoansDto
{
    [JsonPropertyName("asOfDate")]
    public required string AsOfDate { get; init; }

    [JsonPropertyName("items")]
    public required List<CoaLoanItemDto> Items { get; init; }
}

public sealed class CoaLoanItemDto
{
    [JsonPropertyName("ledgerGuid")]
    public required string LedgerGuid { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("parent")]
    public required string Parent { get; init; }

    [JsonPropertyName("balance")]
    public decimal Balance { get; init; }
}

public sealed class CoaInterestSummaryDto
{
    [JsonPropertyName("monthKey")]
    public required string MonthKey { get; init; }

    [JsonPropertyName("latestMonthAmount")]
    public decimal LatestMonthAmount { get; init; }
}

public sealed class CoaPayloadMetadataDto
{
    [JsonPropertyName("historicalMonthsRequested")]
    public int HistoricalMonthsRequested { get; init; }

    [JsonPropertyName("historicalMonthsSynced")]
    public int HistoricalMonthsSynced { get; init; }

    [JsonPropertyName("missingMonths")]
    public List<string> MissingMonths { get; init; } = new();
}
