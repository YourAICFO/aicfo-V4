using AICFO.Connector.Shared.Models;

namespace AICFO.Connector.Shared.Services;

public interface ITallyPayloadBuilder
{
    CoaContractPayload BuildPayload(TallySnapshot snapshot);
}

public sealed class TallyPayloadBuilder : ITallyPayloadBuilder
{
    public CoaContractPayload BuildPayload(TallySnapshot snapshot)
    {
        var asOfDate = snapshot.AsOfDate.ToString("yyyy-MM-dd");

        var groups = snapshot.Groups.Select(group => new CoaGroupDto
        {
            Name = group.Name,
            Parent = group.Parent,
            ReservedName = group.ReservedName ?? string.Empty,
            Guid = group.Guid,
            Type = "Group"
        }).ToList();

        var ledgers = snapshot.Ledgers.Select(ledger => new CoaLedgerDto
        {
            Name = ledger.Name,
            Parent = ledger.Parent,
            Guid = ledger.Guid,
            GroupName = ledger.GroupName,
            Type = "Ledger",
            ClosingBalance = ledger.ClosingBalance
        }).ToList();

        var currentItems = snapshot.Ledgers
            .Select(ledger => new CoaBalanceItemDto { LedgerGuid = ledger.Guid, Balance = ledger.ClosingBalance })
            .ToList();

        var balances = new CoaBalancesDto
        {
            Current = new CoaCurrentBalanceDto
            {
                MonthKey = snapshot.CurrentMonthKey,
                AsOfDate = asOfDate,
                Items = currentItems
            },
            ClosedMonths = snapshot.ClosedMonths.Select(month => new CoaClosedMonthDto
            {
                MonthKey = month.MonthKey,
                Items = month.Items.Select(item => new CoaBalanceItemDto
                {
                    LedgerGuid = item.LedgerGuid,
                    Balance = item.Balance
                }).ToList()
            }).ToList()
        };

        return new CoaContractPayload
        {
            AsOfDate = asOfDate,
            ChartOfAccounts = new CoaContractChartOfAccounts
            {
                Source = "tally",
                GeneratedAt = DateTime.UtcNow.ToString("O"),
                Groups = groups,
                Ledgers = ledgers,
                Balances = balances
            }
        };
    }
}
