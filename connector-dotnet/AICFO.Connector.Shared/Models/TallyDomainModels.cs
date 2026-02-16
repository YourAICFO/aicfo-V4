namespace AICFO.Connector.Shared.Models;

public sealed record TallyGroup(
    string Name,
    string Parent,
    string? ReservedName,
    string Guid,
    string Type = "Group"
);

public sealed record TallyLedger(
    string Name,
    string Parent,
    string Guid,
    decimal ClosingBalance,
    string Type = "Ledger",
    string? ReservedName = null,
    string? GroupName = null
);

public sealed record TallyBalanceItem(string LedgerGuid, decimal Balance);

public sealed record TallyClosedMonthBalance(string MonthKey, List<TallyBalanceItem> Items);

public sealed record TallyPartyAmount(string Name, decimal Amount);

public sealed class TallyPartyBalances
{
    public DateOnly AsOfDate { get; init; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public List<TallyPartyAmount> Debtors { get; init; } = new();
    public List<TallyPartyAmount> Creditors { get; init; } = new();
    public int DebtorsTotalCount { get; init; }
    public int CreditorsTotalCount { get; init; }
}

public sealed record TallyLoanBalance(string LedgerGuid, string Name, string Parent, decimal Balance);

public sealed class TallyInterestSummary
{
    public string MonthKey { get; init; } = DateTime.UtcNow.ToString("yyyy-MM");
    public decimal LatestMonthAmount { get; init; }
}

public sealed class TallySnapshot
{
    public List<TallyGroup> Groups { get; init; } = new();
    public List<TallyLedger> Ledgers { get; init; } = new();
    public DateOnly AsOfDate { get; init; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string CurrentMonthKey { get; init; } = DateTime.UtcNow.ToString("yyyy-MM");
    public int RequestedClosedMonths { get; init; }
    public List<TallyClosedMonthBalance> ClosedMonths { get; init; } = new();
    public List<string> MissingClosedMonths { get; init; } = new();
    public TallyPartyBalances? PartyBalances { get; init; }
    public List<TallyLoanBalance> Loans { get; init; } = new();
    public TallyInterestSummary? InterestSummary { get; init; }
}
