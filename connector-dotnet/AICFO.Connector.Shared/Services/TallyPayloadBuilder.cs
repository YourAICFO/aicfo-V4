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
                AsOfDate = MonthWindowHelper.GetMonthEnd(month.MonthKey).ToString("yyyy-MM-dd"),
                Items = month.Items.Select(item => new CoaBalanceItemDto
                {
                    LedgerGuid = item.LedgerGuid,
                    Balance = item.Balance
                }).ToList()
            }).ToList()
        };

        var partyBalances = snapshot.PartyBalances is null
            ? null
            : new CoaPartyBalancesDto
            {
                AsOfDate = snapshot.PartyBalances.AsOfDate.ToString("yyyy-MM-dd"),
                Debtors = snapshot.PartyBalances.Debtors
                    .Select(item => new CoaPartyAmountDto { Name = item.Name, Amount = item.Amount })
                    .ToList(),
                Creditors = snapshot.PartyBalances.Creditors
                    .Select(item => new CoaPartyAmountDto { Name = item.Name, Amount = item.Amount })
                    .ToList(),
                DebtorsTotalCount = snapshot.PartyBalances.DebtorsTotalCount,
                CreditorsTotalCount = snapshot.PartyBalances.CreditorsTotalCount
            };

        var loans = snapshot.Loans.Count == 0
            ? null
            : new CoaLoansDto
            {
                AsOfDate = asOfDate,
                Items = snapshot.Loans.Select(loan => new CoaLoanItemDto
                {
                    LedgerGuid = loan.LedgerGuid,
                    Name = loan.Name,
                    Parent = loan.Parent,
                    Balance = loan.Balance
                }).ToList()
            };

        var interestSummary = snapshot.InterestSummary is null
            ? null
            : new CoaInterestSummaryDto
            {
                MonthKey = snapshot.InterestSummary.MonthKey,
                LatestMonthAmount = snapshot.InterestSummary.LatestMonthAmount
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
            },
            PartyBalances = partyBalances,
            Loans = loans,
            InterestSummary = interestSummary,
            Metadata = new CoaPayloadMetadataDto
            {
                HistoricalMonthsRequested = snapshot.RequestedClosedMonths > 0
                    ? snapshot.RequestedClosedMonths
                    : snapshot.ClosedMonths.Count + snapshot.MissingClosedMonths.Count,
                HistoricalMonthsSynced = snapshot.ClosedMonths.Count,
                MissingMonths = snapshot.MissingClosedMonths
            }
        };
    }
}
