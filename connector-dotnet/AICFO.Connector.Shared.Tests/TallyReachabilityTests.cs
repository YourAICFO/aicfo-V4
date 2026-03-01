using System.Net;
using System.Net.Http;
using System.Text;
using AICFO.Connector.Shared.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AICFO.Connector.Shared.Tests;

public class TallyReachabilityTests
{
    /// <summary>GET returns Running, POST returns empty envelope => IsReachable true; empty envelope is valid so ApiRequestFailure is null.</summary>
    [Fact]
    public async Task GetReachabilityAsync_GetReturnsRunning_ReturnsReachable()
    {
        var getResponse = "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
        var handler = new TallyMockHandler(getResponse, postResponse: "<ENVELOPE></ENVELOPE>");
        var client = new TallyXmlClient(new HttpClient(handler), NullLogger<TallyXmlClient>.Instance);
        var result = await client.GetReachabilityAsync("127.0.0.1", 9000, CancellationToken.None);
        Assert.True(result.IsReachable);
        Assert.Null(result.UnreachableReason);
        Assert.Null(result.ApiRequestFailure); // empty but well-formed ENVELOPE is valid (no companies loaded)
    }

    [Fact]
    public async Task GetReachabilityAsync_GetReturnsRunning_PostReturnsCompanyNames_ReturnsReachableWithNoApiFailure()
    {
        var getResponse = "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
        var postResponse = "<ENVELOPE><BODY><COMPANYNAME>Test Co</COMPANYNAME></BODY></ENVELOPE>";
        var handler = new TallyMockHandler(getResponse, postResponse);
        var client = new TallyXmlClient(new HttpClient(handler), NullLogger<TallyXmlClient>.Instance);
        var result = await client.GetReachabilityAsync("127.0.0.1", 9000, CancellationToken.None);
        Assert.True(result.IsReachable);
        Assert.Null(result.UnreachableReason);
        Assert.Null(result.ApiRequestFailure);
    }

    private sealed class TallyMockHandler : HttpMessageHandler
    {
        private readonly string _getResponse;
        private readonly string _postResponse;

        public TallyMockHandler(string getResponse, string postResponse)
        {
            _getResponse = getResponse;
            _postResponse = postResponse;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var isGet = request.Method == HttpMethod.Get && request.RequestUri?.AbsolutePath == "/";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(isGet ? _getResponse : _postResponse, Encoding.UTF8, "text/xml")
            });
        }
    }

    // ── ClassifyPostResponse unit tests ─────────────────────────────────────────

    /// <summary>POST returns "Unknown Request" => ApiRequestFailure contains "Unknown Request".</summary>
    [Fact]
    public async Task GetReachabilityAsync_PostReturnsUnknownRequest_SetsApiRequestFailure()
    {
        var getResponse = "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
        var postResponse = "<RESPONSE>Unknown Request, cannot be processed</RESPONSE>";
        var handler = new TallyMockHandler(getResponse, postResponse);
        var client = new TallyXmlClient(new HttpClient(handler), NullLogger<TallyXmlClient>.Instance);
        var result = await client.GetReachabilityAsync("127.0.0.1", 9000, CancellationToken.None);
        Assert.True(result.IsReachable, "Server should be reachable (GET passed)");
        Assert.NotNull(result.ApiRequestFailure);
        Assert.Contains("Unknown Request", result.ApiRequestFailure, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>POST returns a LINEERROR element => ApiRequestFailure contains the extracted error text.</summary>
    [Fact]
    public async Task GetReachabilityAsync_PostReturnsLineError_SetsApiRequestFailureWithErrorText()
    {
        var getResponse = "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
        var postResponse = "<ENVELOPE><BODY><LINEERROR>Access denied to company data</LINEERROR></BODY></ENVELOPE>";
        var handler = new TallyMockHandler(getResponse, postResponse);
        var client = new TallyXmlClient(new HttpClient(handler), NullLogger<TallyXmlClient>.Instance);
        var result = await client.GetReachabilityAsync("127.0.0.1", 9000, CancellationToken.None);
        Assert.True(result.IsReachable, "Server should be reachable (GET passed)");
        Assert.NotNull(result.ApiRequestFailure);
        Assert.Contains("Access denied to company data", result.ApiRequestFailure, StringComparison.OrdinalIgnoreCase);
    }

    // ── ClassifyPostResponse direct tests ───────────────────────────────────────

    [Fact]
    public void ClassifyPostResponse_UnknownRequest_ReturnsFailureMessage()
    {
        var response = "<RESPONSE>Unknown Request, cannot be processed</RESPONSE>";
        var result = TallyXmlClient.ClassifyPostResponse(response);
        Assert.NotNull(result);
        Assert.Contains("Unknown Request", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ClassifyPostResponse_LineError_ReturnsExtractedText()
    {
        var response = "<ENVELOPE><LINEERROR>Invalid company license</LINEERROR></ENVELOPE>";
        var result = TallyXmlClient.ClassifyPostResponse(response);
        Assert.NotNull(result);
        Assert.Contains("Invalid company license", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ClassifyPostResponse_ValidEnvelope_ReturnsNull()
    {
        var response = "<ENVELOPE><BODY><COMPANYNAME>Test Co</COMPANYNAME></BODY></ENVELOPE>";
        var result = TallyXmlClient.ClassifyPostResponse(response);
        Assert.Null(result);
    }

    [Fact]
    public void ClassifyPostResponse_EmptyEnvelope_ReturnsNull()
    {
        // An empty but well-formed ENVELOPE is a valid response (no companies loaded).
        var response = "<ENVELOPE></ENVELOPE>";
        var result = TallyXmlClient.ClassifyPostResponse(response);
        Assert.Null(result);
    }

    // ── Regression: <RESPONSE>OK</RESPONSE> must NOT be treated as running server ─

    [Fact]
    public void IsTallyServerRunningResponse_ResponseElementWithoutRunning_ReturnsFalse()
    {
        // Before the fix, the <RESPONSE> catch-all returned true for this — causing
        // gateway/license pages to be treated as a live Tally server.
        var body = "<RESPONSE>OK</RESPONSE>";
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse(body),
            "Generic <RESPONSE>OK</RESPONSE> must NOT be treated as a running Tally server");
    }

    [Fact]
    public void IsTallyServerRunningResponse_TallyPrimeServerIsRunning_ReturnsTrue()
    {
        var body = "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
        Assert.True(TallyXmlClient.IsTallyServerRunningResponse(body));
    }

    [Fact]
    public void IsTallyServerRunningResponse_TallyServerIsRunning_ReturnsTrue()
    {
        var body = "<RESPONSE>Tally Server is Running</RESPONSE>";
        Assert.True(TallyXmlClient.IsTallyServerRunningResponse(body));
    }

    [Fact]
    public void IsTallyServerRunningResponse_ContainsTallyAndRunning_ReturnsTrue()
    {
        Assert.True(TallyXmlClient.IsTallyServerRunningResponse("Tally something Running"));
        Assert.True(TallyXmlClient.IsTallyServerRunningResponse("  TALLY   RUNNING  "));
    }

    [Fact]
    public void IsTallyServerRunningResponse_XmlWithResponseElementOnlyOk_ReturnsFalse()
    {
        // Generic <RESPONSE>OK</RESPONSE> must NOT be treated as running (same as ResponseElementWithoutRunning).
        var body = "<?xml version=\"1.0\"?><RESPONSE>OK</RESPONSE>";
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse(body));
    }

    [Fact]
    public void IsTallyServerRunningResponse_EmptyOrNull_ReturnsFalse()
    {
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse(null));
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse(""));
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse("   "));
    }

    [Fact]
    public void IsTallyServerRunningResponse_ConnectionRefusedHtml_ReturnsFalse()
    {
        var body = "<html><body>Connection refused</body></html>";
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse(body));
    }

    [Fact]
    public void IsTallyServerRunningResponse_404Page_ReturnsFalse()
    {
        var body = "<!DOCTYPE html><html>404 Not Found</html>";
        Assert.False(TallyXmlClient.IsTallyServerRunningResponse(body));
    }

    // ── HTML / wrong endpoint classification ───────────────────────────────────

    [Fact]
    public void ClassifyPostResponse_Html_ReturnsFailureMessage()
    {
        var response = "<html><body>License server is Running</body></html>";
        var result = TallyXmlClient.ClassifyPostResponse(response);
        Assert.NotNull(result);
        Assert.Contains("Wrong endpoint", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ClassifyPostResponse_LicenseServerIsRunning_ReturnsFailureMessage()
    {
        var response = "License server is Running";
        var result = TallyXmlClient.ClassifyPostResponse(response);
        Assert.NotNull(result);
        Assert.Contains("Wrong endpoint", result, StringComparison.OrdinalIgnoreCase);
    }

    // ── ExtractCompanyNamesFromXml: multiple tag names ─────────────────────────

    [Fact]
    public void ExtractCompanyNamesFromXml_CompanyNameTag_Extracts()
    {
        var xml = "<ENVELOPE><BODY><COMPANYNAME>Acme Ltd</COMPANYNAME><COMPANYNAME>Beta Inc</COMPANYNAME></BODY></ENVELOPE>";
        var names = TallyXmlClient.ExtractCompanyNamesFromXml(xml);
        Assert.Equal(2, names.Count);
        Assert.Contains("Acme Ltd", names, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("Beta Inc", names, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void ExtractCompanyNamesFromXml_NameTag_Extracts()
    {
        var xml = "<ENVELOPE><COLLECTION><NAME>My Company</NAME></COLLECTION></ENVELOPE>";
        var names = TallyXmlClient.ExtractCompanyNamesFromXml(xml);
        Assert.Single(names);
        Assert.Equal("My Company", names[0]);
    }

    [Fact]
    public void ExtractCompanyNamesFromXml_CompanyTag_Extracts()
    {
        var xml = "<ENVELOPE><BODY><COMPANY>Test Co</COMPANY></BODY></ENVELOPE>";
        var names = TallyXmlClient.ExtractCompanyNamesFromXml(xml);
        Assert.Single(names);
        Assert.Equal("Test Co", names[0]);
    }

    [Fact]
    public void ExtractCompanyNamesFromXml_CmpNameTag_Extracts()
    {
        var xml = "<ENVELOPE><CMPNAME>Legacy Co</CMPNAME></ENVELOPE>";
        var names = TallyXmlClient.ExtractCompanyNamesFromXml(xml);
        Assert.Single(names);
        Assert.Equal("Legacy Co", names[0]);
    }

    [Fact]
    public void ExtractCompanyNamesFromXml_EmptyOrNull_ReturnsEmpty()
    {
        Assert.Empty(TallyXmlClient.ExtractCompanyNamesFromXml(null));
        Assert.Empty(TallyXmlClient.ExtractCompanyNamesFromXml(""));
        Assert.Empty(TallyXmlClient.ExtractCompanyNamesFromXml("   "));
    }

    [Fact]
    public void ExtractCompanyNamesFromXml_InvalidXml_ReturnsEmpty()
    {
        var names = TallyXmlClient.ExtractCompanyNamesFromXml("<ENVELOPE><unclosed>");
        Assert.Empty(names);
    }

    [Fact]
    public void ExtractCompanyNamesFromXml_NoCompanyTags_ReturnsEmpty()
    {
        var xml = "<ENVELOPE><BODY><OTHER>X</OTHER></BODY></ENVELOPE>";
        Assert.Empty(TallyXmlClient.ExtractCompanyNamesFromXml(xml));
    }

    /// <summary>GetCompanyNamesAsync with HTML response returns empty list (wrong endpoint).</summary>
    [Fact]
    public async Task GetCompanyNamesAsync_HtmlResponse_ReturnsEmptyList()
    {
        var getResponse = "<RESPONSE>TallyPrime Server is Running</RESPONSE>";
        var postResponse = "<html><body>License server is Running</body></html>";
        var handler = new TallyMockHandler(getResponse, postResponse);
        var client = new TallyXmlClient(new HttpClient(handler), NullLogger<TallyXmlClient>.Instance);
        var names = await client.GetCompanyNamesAsync("127.0.0.1", 9000, CancellationToken.None);
        Assert.NotNull(names);
        Assert.Empty(names);
    }

    /// <summary>GetCompanyNamesAsync with UTF-16 LE BOM response decodes and extracts companies.</summary>
    [Fact]
    public async Task GetCompanyNamesAsync_Utf16LeBomResponse_ExtractsCompanies()
    {
        var xml = "<ENVELOPE><BODY><COMPANYNAME>Unicode Co</COMPANYNAME></BODY></ENVELOPE>";
        var utf16Bytes = new byte[] { 0xFF, 0xFE }.Concat(Encoding.Unicode.GetBytes(xml)).ToArray();
        var handler = new TallyUtf16MockHandler(utf16Bytes);
        var client = new TallyXmlClient(new HttpClient(handler), NullLogger<TallyXmlClient>.Instance);
        var names = await client.GetCompanyNamesAsync("127.0.0.1", 9000, CancellationToken.None);
        Assert.NotNull(names);
        Assert.Single(names);
        Assert.Equal("Unicode Co", names[0]);
    }

    private sealed class TallyUtf16MockHandler : HttpMessageHandler
    {
        private readonly byte[] _postResponseBytes;

        public TallyUtf16MockHandler(byte[] postResponseBytes)
        {
            _postResponseBytes = postResponseBytes;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var isGet = request.Method == HttpMethod.Get && request.RequestUri?.AbsolutePath == "/";
            if (isGet)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("<RESPONSE>TallyPrime Server is Running</RESPONSE>", Encoding.UTF8, "text/xml")
                });
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(_postResponseBytes)
                {
                    Headers = { { "Content-Type", "text/xml; charset=utf-16" } }
                }
            });
        }
    }
}
