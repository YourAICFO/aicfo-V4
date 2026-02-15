using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AICFO.Connector.Shared.Models;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface IAicfoApiClient
{
    Task<Dictionary<string, object>?> GetConnectorStatusAsync(ConnectorConfig config, string token, CancellationToken cancellationToken);
    Task SendHeartbeatAsync(ConnectorConfig config, string token, CancellationToken cancellationToken);
    Task<string?> StartSyncRunAsync(ConnectorConfig config, string token, CancellationToken cancellationToken);
    Task SendSyncPayloadAsync(ConnectorConfig config, string token, CoaContractPayload payload, CancellationToken cancellationToken);
    Task CompleteSyncRunAsync(ConnectorConfig config, string token, string? runId, string status, string? lastError, CancellationToken cancellationToken);
}

public sealed class AicfoApiClient(HttpClient httpClient, ILogger<AicfoApiClient> logger) : IAicfoApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<Dictionary<string, object>?> GetConnectorStatusAsync(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Get, config, "/api/connector/status/connector", token);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<Dictionary<string, object>>(body, JsonOptions);
    }

    public async Task SendHeartbeatAsync(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/heartbeat", token, new { at = DateTime.UtcNow.ToString("O") });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<string?> StartSyncRunAsync(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync/start", token, new { at = DateTime.UtcNow.ToString("O") });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(body);
        if (document.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("runId", out var runIdElement))
        {
            return runIdElement.GetString();
        }

        return null;
    }

    public async Task SendSyncPayloadAsync(ConnectorConfig config, string token, CoaContractPayload payload, CancellationToken cancellationToken)
    {
        var serialized = JsonSerializer.Serialize(payload, JsonOptions);
        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(serialized))).ToLowerInvariant();

        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync", token, payload, payloadHash);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var failureBody = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogError("Sync payload rejected status={StatusCode} body={Body}", response.StatusCode, failureBody);
        }

        response.EnsureSuccessStatusCode();
    }

    public async Task CompleteSyncRunAsync(ConnectorConfig config, string token, string? runId, string status, string? lastError, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(runId)) return;

        using var request = CreateRequest(HttpMethod.Post, config, "/api/connector/sync/complete", token, new
        {
            runId,
            status,
            finishedAt = DateTime.UtcNow.ToString("O"),
            lastError
        });

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, ConnectorConfig config, string path, string token, object? body = null, string? payloadHash = null)
    {
        var baseUri = config.ApiUrl.TrimEnd('/');
        var request = new HttpRequestMessage(method, new Uri($"{baseUri}{path}"));
        request.Headers.Authorization = new("Bearer", token);

        if (!string.IsNullOrWhiteSpace(payloadHash))
        {
            request.Headers.Add("X-Payload-Hash", payloadHash);
        }

        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        return request;
    }
}
