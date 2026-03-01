using AICFO.Connector.Shared.Models;
using AICFO.Connector.Shared.Services;
using Xunit;

namespace AICFO.Connector.Shared.Tests;

public class WebCompanySelectionHelperTests
{
    [Fact]
    public void GetPreferredCompanyIndex_EmptyList_ReturnsMinusOne()
    {
        var companies = new List<WebCompany>();
        Assert.Equal(-1, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, "any"));
        Assert.Equal(-1, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, null));
    }

    [Fact]
    public void GetPreferredCompanyIndex_NullOrEmptyPreferred_ReturnsMinusOne()
    {
        var companies = new List<WebCompany>
        {
            new() { Id = "id1", Name = "Company A" }
        };
        Assert.Equal(-1, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, null));
        Assert.Equal(-1, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, ""));
    }

    [Fact]
    public void GetPreferredCompanyIndex_TwoCompanies_PrefersMatchingId()
    {
        var id1 = "d70836db-1111-2222-3333-000000000001";
        var id2 = "aeff095f-4444-5555-6666-000000000002";
        var companies = new List<WebCompany>
        {
            new() { Id = id1, Name = "TULSI electronics" },
            new() { Id = id2, Name = "TULSI ELECTRONICS" }
        };
        Assert.Equal(0, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, id1));
        Assert.Equal(1, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, id2));
    }

    [Fact]
    public void GetPreferredCompanyIndex_CaseInsensitive()
    {
        var idLower = "abc-123";
        var companies = new List<WebCompany>
        {
            new() { Id = idLower, Name = "Co" }
        };
        Assert.Equal(0, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, "ABC-123"));
        Assert.Equal(0, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, idLower));
    }

    [Fact]
    public void GetPreferredCompanyIndex_NoMatch_ReturnsMinusOne()
    {
        var companies = new List<WebCompany>
        {
            new() { Id = "id1", Name = "A" },
            new() { Id = "id2", Name = "B" }
        };
        Assert.Equal(-1, WebCompanySelectionHelper.GetPreferredCompanyIndex(companies, "other-id"));
    }
}
