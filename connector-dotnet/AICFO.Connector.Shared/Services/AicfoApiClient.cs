using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AICFO.Connector.Shared.Models;
using Microsoft.Extensions.Logging;

namespace AICFO.Connector.Shared.Services;

public interface IAicfoApiClient
{
    Task<LoginResponse> LoginAsync(string email, string password, CancellationToken cancellationToken);
    Task<List<WebCompany>> GetCompaniesAsync(string userJwt, CancellationToken cancellationToken);
    Task<RegisterDeviceResponse> RegisterDeviceAsync(string userJwt, string companyId, string deviceId, string deviceName, CancellationToken cancellationToken);
    Task<bool> TestBackendReachableAsync(string apiUrl, CancellationToken cancellationToken);
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

    public async Task<bool> TestBackendReachableAsync(string apiUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(apiUrl)) return false;
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"{apiUrl.TrimEnd('/')}/health"));
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

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

    private static string GetConfiguredApiBaseUrl()
    {
        var config = new ConfigStore().Load();
        var apiUrl = config?.ApiUrl?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(apiUrl))
        {
            throw new InvalidOperationException($"api_url is required in {ConnectorPaths.ConfigFile} before using connector onboarding.");
        }
        return apiUrl;
    }

    private static T? ReadEnvelopeData<T>(string body)
    {
        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("data", out var data))
        {
            return default;
        }
        return JsonSerializer.Deserialize<T>(data.GetRawText(), JsonOptions);
    }
}
    public async Task<LoginResponse> LoginAsync(string email, string password, CancellationToken cancellationToken)
    {
        var baseUri = GetConfiguredApiBaseUrl();
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri($"{baseUri}/api/connector/login"))
        {
            Content = JsonContent.Create(new { email, password })
        };
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return ReadEnvelopeData<LoginResponse>(body) ?? throw new InvalidOperationException("Invalid login response from backend.");
    }

    public async Task<List<WebCompany>> GetCompaniesAsync(string userJwt, CancellationToken cancellationToken)
    {
        var baseUri = GetConfiguredApiBaseUrl();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"{baseUri}/api/connector/companies"));
        request.Headers.Authorization = new("Bearer", userJwt);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return ReadEnvelopeData<List<WebCompany>>(body) ?? [];
    }

    public async Task<RegisterDeviceResponse> RegisterDeviceAsync(string userJwt, string companyId, string deviceId, string deviceName, CancellationToken cancellationToken)
    {
        var baseUri = GetConfiguredApiBaseUrl();
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri($"{baseUri}/api/connector/register-device"))
        {
            Content = JsonContent.Create(new { companyId, deviceId, deviceName })
        };
        request.Headers.Authorization = new("Bearer", userJwt);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return ReadEnvelopeData<RegisterDeviceResponse>(body) ?? throw new InvalidOperationException("Invalid register-device response from backend.");
    }
