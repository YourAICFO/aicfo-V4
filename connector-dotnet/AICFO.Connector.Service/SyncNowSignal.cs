namespace AICFO.Connector.Service;

public sealed class SyncNowSignal
{
    private readonly SemaphoreSlim _signal = new(0, int.MaxValue);

    public Task WaitAsync(CancellationToken cancellationToken) => _signal.WaitAsync(cancellationToken);

    public void Trigger()
    {
        _signal.Release();
    }
}
