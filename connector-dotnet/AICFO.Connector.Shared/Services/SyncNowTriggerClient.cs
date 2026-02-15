using System.IO.Pipes;
using System.Text;

namespace AICFO.Connector.Shared.Services;

public interface ISyncNowTriggerClient
{
    Task TriggerAsync(CancellationToken cancellationToken);
}

public sealed class SyncNowTriggerClient : ISyncNowTriggerClient
{
    public async Task TriggerAsync(CancellationToken cancellationToken)
    {
        using var client = new NamedPipeClientStream(".", ConnectorPaths.SyncNowPipeName, PipeDirection.Out);
        await client.ConnectAsync(5000, cancellationToken);
        var payload = Encoding.UTF8.GetBytes("sync-now");
        await client.WriteAsync(payload, cancellationToken);
        await client.FlushAsync(cancellationToken);
    }
}
