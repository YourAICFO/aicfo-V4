using System.Net;
using System.Net.Http;
using System.Text;
using AICFO.Connector.Shared.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AICFO.Connector.Shared.Tests;

public class AicfoApiClientTests
{
    [Fact]
    public async Task GetCompaniesAsync_200_EmptyList_ReturnsEmptyList()
    {
        var handler = new MockHttpMessageHandler((req, ct) =>
        {
            var body = """{"success":true,"data":[]}""";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
        });
        var client = new AicfoApiClient(new HttpClient(handler), NullLogger<AicfoApiClient>.Instance);
        var companies = await client.GetCompaniesAsync("https://example.com", "fake-token", true, CancellationToken.None);
        Assert.NotNull(companies);
        Assert.Empty(companies);
    }

    [Fact]
    public async Task GetCompaniesAsync_401_ThrowsUnauthorizedAccessException()
    {
        var handler = new MockHttpMessageHandler((req, ct) =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent("""{"success":false,"error":"Unauthorized"}""", Encoding.UTF8, "application/json")
            });
        var client = new AicfoApiClient(new HttpClient(handler), NullLogger<AicfoApiClient>.Instance);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            client.GetCompaniesAsync("https://example.com", "bad-token", true, CancellationToken.None));
    }

    [Fact]
    public async Task GetCompaniesAsync_500_ThrowsWithResponseSnippet()
    {
        var handler = new MockHttpMessageHandler((req, ct) =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("""{"success":false,"error":"Server error"}""", Encoding.UTF8, "application/json")
            });
        var client = new AicfoApiClient(new HttpClient(handler), NullLogger<AicfoApiClient>.Instance);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.GetCompaniesAsync("https://example.com", "token", true, CancellationToken.None));
        Assert.Contains("Response:", ex.Message);
    }

    private sealed class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, HttpResponseMessage> _respond;

        public MockHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, HttpResponseMessage> respond)
        {
            _respond = respond;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_respond(request, cancellationToken));
        }
    }
}
