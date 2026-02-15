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

public sealed class TallySnapshot
{
    public List<TallyGroup> Groups { get; init; } = new();
    public List<TallyLedger> Ledgers { get; init; } = new();
    public DateOnly AsOfDate { get; init; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string CurrentMonthKey { get; init; } = DateTime.UtcNow.ToString("yyyy-MM");
    public List<TallyClosedMonthBalance> ClosedMonths { get; init; } = new();
}
