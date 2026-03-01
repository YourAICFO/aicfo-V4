using AICFO.Connector.Shared.Models;

namespace AICFO.Connector.Shared.Services;

/// <summary>Testable helper for resolving which web company index to select when binding a dropdown.</summary>
public static class WebCompanySelectionHelper
{
    /// <summary>Returns the index of the company whose Id matches preferredCompanyId (case-insensitive), or -1 if not found.</summary>
    public static int GetPreferredCompanyIndex(IReadOnlyList<WebCompany> companies, string? preferredCompanyId)
    {
        if (companies.Count == 0 || string.IsNullOrWhiteSpace(preferredCompanyId)) return -1;
        for (var i = 0; i < companies.Count; i++)
        {
            if (string.Equals(companies[i].Id, preferredCompanyId, StringComparison.OrdinalIgnoreCase))
                return i;
        }
        return -1;
    }
}
