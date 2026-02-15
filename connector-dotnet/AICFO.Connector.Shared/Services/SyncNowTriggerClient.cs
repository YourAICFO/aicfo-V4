using System.IO.Pipes;
using System.Text;

namespace AICFO.Connector.Shared.Services;

public interface ISyncNowTriggerClient
{
    Task TriggerAsync(CancellationToken cancellationToken);
    Task TriggerMappingAsync(string mappingId, CancellationToken cancellationToken);
    Task TriggerAllAsync(CancellationToken cancellationToken);
}

public sealed class SyncNowTriggerClient : ISyncNowTriggerClient
{
    public async Task TriggerAsync(CancellationToken cancellationToken)
    {
        await SendAsync("sync-now", cancellationToken);
    }

    public async Task TriggerMappingAsync(string mappingId, CancellationToken cancellationToken)
    {
        await SendAsync($"sync-now:{mappingId}", cancellationToken);
    }

    public async Task TriggerAllAsync(CancellationToken cancellationToken)
    {
        await SendAsync("sync-all", cancellationToken);
    }

    private static async Task SendAsync(string message, CancellationToken cancellationToken)
    {
        using var client = new NamedPipeClientStream(".", ConnectorPaths.SyncNowPipeName, PipeDirection.Out);
        await client.ConnectAsync(5000, cancellationToken);
        var payload = Encoding.UTF8.GetBytes(message);
        await client.WriteAsync(payload, cancellationToken);
        await client.FlushAsync(cancellationToken);
    }
}
