using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

/// <summary>Logs every HTTP request: method, URL, status code, duration; and exceptions with type and message.</summary>
public sealed class LoggingHttpMessageHandler : DelegatingHandler
{
    private readonly ILogger _logger;

    public LoggingHttpMessageHandler(HttpMessageHandler inner, ILogger logger)
        : base(inner)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var method = request.Method.Method;
        var url = request.RequestUri?.ToString() ?? "(null)";
        var sw = Stopwatch.StartNew();
        HttpResponseMessage? response = null;
        try
        {
            response = await base.SendAsync(request, cancellationToken).ConfigureAwait(false);
            sw.Stop();
            var status = (int)response.StatusCode;
            _logger.LogInformation("[INF] HTTP {Method} {Url} => {StatusCode} {Duration}ms", method, url, status, sw.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[ERR] HTTP {Method} {Url} => Exception {Type}: {Message}", method, url, ex.GetType().Name, ex.Message);
            throw;
        }
    }
}
