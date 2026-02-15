using AICFO.Connector.Shared.Models;
using AICFO.Connector.Shared.Services;

namespace AICFO.Connector.Service;

public sealed class ConnectorWorker(
    ILogger<ConnectorWorker> logger,
    IConfigStore configStore,
    ICredentialStore credentialStore,
    ITallyXmlClient tallyClient,
    ITallyPayloadBuilder payloadBuilder,
    IAicfoApiClient apiClient,
    SyncNowSignal syncNowSignal) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("AICFO Connector service booting");

        while (!stoppingToken.IsCancellationRequested)
        {
            var config = configStore.Load();
            if (config is null)
            {
                logger.LogWarning("Connector config missing at {Path}; waiting", ConnectorPaths.ConfigFile);
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                continue;
            }

            string? token;
            try
            {
                config.Validate();
                token = credentialStore.LoadConnectorToken(config.CompanyId);
                if (string.IsNullOrWhiteSpace(token))
                {
                    logger.LogWarning("Connector token missing in Windows Credential Manager for company {CompanyId}", config.CompanyId);
                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                    continue;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Invalid connector configuration");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                continue;
            }

            var heartbeatTask = RunHeartbeatLoop(config, token!, stoppingToken);
            var scheduledSyncTask = RunScheduledSyncLoop(config, token!, stoppingToken);
            var manualSyncTask = RunManualSyncLoop(config, token!, stoppingToken);

            await Task.WhenAny(heartbeatTask, scheduledSyncTask, manualSyncTask);

            if (heartbeatTask.IsFaulted || scheduledSyncTask.IsFaulted || manualSyncTask.IsFaulted)
            {
                logger.LogError("One of connector loops faulted; restarting loops");
            }

            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }

    private async Task RunHeartbeatLoop(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(config.HeartbeatIntervalSeconds));
        while (await timer.WaitForNextTickAsync(cancellationToken))
        {
            await WithBackoff(async () =>
            {
                await apiClient.SendHeartbeatAsync(config, token, cancellationToken);
                config.LastHeartbeatAt = DateTimeOffset.UtcNow;
                config.LastError = null;
                configStore.Save(config);
                logger.LogInformation("Heartbeat OK companyId={CompanyId}", config.CompanyId);
            }, "heartbeat", cancellationToken);
        }
    }

    private async Task RunScheduledSyncLoop(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(config.SyncIntervalMinutes));
        while (await timer.WaitForNextTickAsync(cancellationToken))
        {
            await PerformSync(config, token, "scheduled", cancellationToken);
        }
    }

    private async Task RunManualSyncLoop(ConnectorConfig config, string token, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            await syncNowSignal.WaitAsync(cancellationToken);
            await PerformSync(config, token, "manual", cancellationToken);
        }
    }

    private async Task PerformSync(ConnectorConfig config, string token, string reason, CancellationToken cancellationToken)
    {
        await WithBackoff(async () =>
        {
            logger.LogInformation("Sync started reason={Reason} companyId={CompanyId}", reason, config.CompanyId);

            var tallyAvailable = await tallyClient.TestConnectionAsync(config, cancellationToken);
            if (!tallyAvailable)
            {
                throw new InvalidOperationException($"Tally is not reachable at {config.TallyHost}:{config.TallyPort}. Ensure Tally is running and XML over HTTP is enabled.");
            }

            var runId = await apiClient.StartSyncRunAsync(config, token, cancellationToken);
            try
            {
                var snapshot = await tallyClient.FetchSnapshotAsync(config, cancellationToken);
                var payload = payloadBuilder.BuildPayload(snapshot);
                await apiClient.SendSyncPayloadAsync(config, token, payload, cancellationToken);
                await apiClient.CompleteSyncRunAsync(config, token, runId, "success", null, cancellationToken);

                config.LastSyncAt = DateTimeOffset.UtcNow;
                config.LastError = null;
                configStore.Save(config);

                logger.LogInformation("Sync completed reason={Reason} companyId={CompanyId} ledgers={LedgerCount}", reason, config.CompanyId, snapshot.Ledgers.Count);
            }
            catch (Exception ex)
            {
                await apiClient.CompleteSyncRunAsync(config, token, runId, "failed", ex.Message, cancellationToken);
                throw;
            }
        }, "sync", cancellationToken);
    }

    private async Task WithBackoff(Func<Task> operation, string operationName, CancellationToken cancellationToken)
    {
        var attempts = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            attempts++;
            try
            {
                await operation();
                return;
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                var cappedAttempt = Math.Min(attempts, 8);
                var jitterMs = Random.Shared.Next(100, 900);
                var delay = TimeSpan.FromMilliseconds(Math.Min(Math.Pow(2, cappedAttempt) * 1000, TimeSpan.FromMinutes(10).TotalMilliseconds) + jitterMs);
                logger.LogWarning(ex, "Connector {Operation} failed attempt={Attempt}; retrying in {Delay}", operationName, attempts, delay);
                await Task.Delay(delay, cancellationToken);
            }
        }
    }
}
