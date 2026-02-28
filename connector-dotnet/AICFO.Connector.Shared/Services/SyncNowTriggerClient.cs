using System.IO.Pipes;
using System.Text;

namespace AICFO.Connector.Shared.Services;

public sealed record SyncTriggerResult(bool Success, string? ErrorMessage, bool IsPermissionMismatch);

public interface ISyncNowTriggerClient
{
    Task TriggerAsync(CancellationToken cancellationToken);
    Task TriggerMappingAsync(string mappingId, CancellationToken cancellationToken);
    Task TriggerAllAsync(CancellationToken cancellationToken);
    Task<SyncTriggerResult> TryTriggerAsync(CancellationToken cancellationToken);
    Task<SyncTriggerResult> TryTriggerMappingAsync(string mappingId, CancellationToken cancellationToken);
    Task<SyncTriggerResult> TryTriggerAllAsync(CancellationToken cancellationToken);
}

public sealed class SyncNowTriggerClient : ISyncNowTriggerClient
{
    public async Task TriggerAsync(CancellationToken cancellationToken)
    {
        var result = await TryTriggerAsync(cancellationToken);
        if (!result.Success)
            throw new InvalidOperationException(result.ErrorMessage ?? "Sync trigger failed.");
    }

    public async Task TriggerMappingAsync(string mappingId, CancellationToken cancellationToken)
    {
        var result = await TryTriggerMappingAsync(mappingId, cancellationToken);
        if (!result.Success)
            throw new InvalidOperationException(result.ErrorMessage ?? "Sync trigger failed.");
    }

    public async Task TriggerAllAsync(CancellationToken cancellationToken)
    {
        var result = await TryTriggerAllAsync(cancellationToken);
        if (!result.Success)
            throw new InvalidOperationException(result.ErrorMessage ?? "Sync trigger failed.");
    }

    public async Task<SyncTriggerResult> TryTriggerAsync(CancellationToken cancellationToken)
    {
        return await SendWithResultAsync("sync-now", cancellationToken);
    }

    public async Task<SyncTriggerResult> TryTriggerMappingAsync(string mappingId, CancellationToken cancellationToken)
    {
        return await SendWithResultAsync($"sync-now:{mappingId}", cancellationToken);
    }

    public async Task<SyncTriggerResult> TryTriggerAllAsync(CancellationToken cancellationToken)
    {
        return await SendWithResultAsync("sync-all", cancellationToken);
    }

    private static async Task<SyncTriggerResult> SendWithResultAsync(string message, CancellationToken cancellationToken)
    {
        const int connectTimeoutMs = 5000;
        const string permissionHint = "The connector worker may be running with different privileges (e.g. as a Windows Service). Try: 1) Restart the connector from the tray, or 2) Run the connector as Administrator, or 3) Restart the AICFO Connector Service from services.msc.";

        try
        {
            using var client = new NamedPipeClientStream(".", ConnectorPaths.SyncNowPipeName, PipeDirection.Out);
            await client.ConnectAsync(connectTimeoutMs, cancellationToken);
            var payload = Encoding.UTF8.GetBytes(message);
            await client.WriteAsync(payload, cancellationToken);
            await client.FlushAsync(cancellationToken);
            return new SyncTriggerResult(Success: true, null, false);
        }
        catch (UnauthorizedAccessException ex)
        {
            return new SyncTriggerResult(
                Success: false,
                $"Sync trigger failed: access denied. {permissionHint} ({ex.Message})",
                IsPermissionMismatch: true);
        }
        catch (System.IO.IOException ex)
        {
            var isPermission = ex.Message.Contains("access", StringComparison.OrdinalIgnoreCase)
                || ex.Message.Contains("denied", StringComparison.OrdinalIgnoreCase)
                || ex.Message.Contains("5", StringComparison.Ordinal); // ERROR_ACCESS_DENIED = 5
            return new SyncTriggerResult(
                Success: false,
                isPermission ? $"{ex.Message}. {permissionHint}" : ex.Message,
                IsPermissionMismatch: isPermission);
        }
        catch (TimeoutException ex)
        {
            return new SyncTriggerResult(
                Success: false,
                $"Sync trigger failed: connector worker did not respond in time. Ensure the AICFO Connector Service is running. ({ex.Message})",
                IsPermissionMismatch: false);
        }
        catch (OperationCanceledException)
        {
            return new SyncTriggerResult(Success: false, "Sync trigger was cancelled.", IsPermissionMismatch: false);
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            var isPermission = msg.Contains("access", StringComparison.OrdinalIgnoreCase) || msg.Contains("denied", StringComparison.OrdinalIgnoreCase);
            return new SyncTriggerResult(
                Success: false,
                isPermission ? $"{msg}. {permissionHint}" : msg,
                IsPermissionMismatch: isPermission);
        }
    }
}
