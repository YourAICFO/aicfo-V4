using System.Threading.Channels;

namespace AICFO.Connector.Service;

public sealed class SyncNowSignal
{
    private readonly Channel<string?> _channel = Channel.CreateUnbounded<string?>();

    public async Task<string?> WaitAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.ReadAsync(cancellationToken);
    }

    public void Trigger(string? mappingId = null)
    {
        _channel.Writer.TryWrite(mappingId);
    }
}
