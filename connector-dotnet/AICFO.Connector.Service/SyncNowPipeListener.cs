using System.IO.Pipes;
using System.Text;
using AICFO.Connector.Shared.Services;

namespace AICFO.Connector.Service;

public sealed class SyncNowPipeListener(ILogger<SyncNowPipeListener> logger, SyncNowSignal signal) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var server = new NamedPipeServerStream(ConnectorPaths.SyncNowPipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);

            try
            {
                await server.WaitForConnectionAsync(stoppingToken);
                var buffer = new byte[64];
                var bytesRead = await server.ReadAsync(buffer, stoppingToken);
                var message = Encoding.UTF8.GetString(buffer, 0, bytesRead).Trim();

                if (string.Equals(message, "sync-now", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogInformation("Manual sync-now signal received from tray");
                    signal.Trigger();
                }
                else if (string.Equals(message, "sync-all", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogInformation("Manual sync-all signal received from tray");
                    signal.Trigger(null);
                }
                else if (message.StartsWith("sync-now:", StringComparison.OrdinalIgnoreCase))
                {
                    var mappingId = message["sync-now:".Length..].Trim();
                    if (!string.IsNullOrWhiteSpace(mappingId))
                    {
                        logger.LogInformation("Manual sync-now signal received for mapping {MappingId}", mappingId);
                        signal.Trigger(mappingId);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Named pipe listener iteration failed");
            }
        }
    }
}
