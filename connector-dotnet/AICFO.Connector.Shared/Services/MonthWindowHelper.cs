namespace AICFO.Connector.Shared.Services;

public static class MonthWindowHelper
{
    public static List<string> GetMonthKeys(int lastN = 24, bool includeCurrent = true, DateTime? referenceUtc = null)
    {
        var normalizedCount = Math.Clamp(lastN, 1, 120);
        var refDate = referenceUtc ?? DateTime.UtcNow;
        var cursor = new DateTime(refDate.Year, refDate.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (!includeCurrent)
        {
            cursor = cursor.AddMonths(-1);
        }

        var monthKeys = new List<string>(normalizedCount);
        for (var i = 0; i < normalizedCount; i++)
        {
            monthKeys.Add(cursor.ToString("yyyy-MM"));
            cursor = cursor.AddMonths(-1);
        }

        monthKeys.Reverse();
        return monthKeys;
    }

    public static DateOnly GetMonthStart(string monthKey)
    {
        if (DateTime.TryParseExact($"{monthKey}-01", "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var parsed))
        {
            return DateOnly.FromDateTime(parsed);
        }

        var utcNow = DateTime.UtcNow;
        return new DateOnly(utcNow.Year, utcNow.Month, 1);
    }

    public static DateOnly GetMonthEnd(string monthKey)
    {
        var start = GetMonthStart(monthKey);
        return start.AddMonths(1).AddDays(-1);
    }
}
