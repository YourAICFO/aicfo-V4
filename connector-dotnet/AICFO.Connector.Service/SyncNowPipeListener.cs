using System.IO.Pipes;
using System.Text;
using System.Security.AccessControl;
using System.Security.Principal;
using AICFO.Connector.Shared.Services;

namespace AICFO.Connector.Service;

public sealed class SyncNowPipeListener(ILogger<SyncNowPipeListener> logger, SyncNowSignal signal) : BackgroundService
{
    private static PipeSecurity CreatePipeSecurityForTrayAccess()
    {
        var security = new PipeSecurity();
        var sid = new SecurityIdentifier(WellKnownSidType.AuthenticatedUserSid, null);
        security.AddAccessRule(new PipeAccessRule(sid, PipeAccessRights.ReadWrite, AccessControlType.Allow));
        var worldSid = new SecurityIdentifier(WellKnownSidType.WorldSid, null);
        security.AddAccessRule(new PipeAccessRule(worldSid, PipeAccessRights.ReadWrite, AccessControlType.Allow));
        return security;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pipeSecurity = CreatePipeSecurityForTrayAccess();
        while (!stoppingToken.IsCancellationRequested)
        {
            using var server = new NamedPipeServerStream(ConnectorPaths.SyncNowPipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
            try
            {
                try
                {
                    PipesAclExtensions.SetAccessControl(server, pipeSecurity);
                }
                catch (Exception ex)
                {
                    logger.LogDebug(ex, "Could not set pipe ACL (tray may need to run as same user or admin); continuing");
                }
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
