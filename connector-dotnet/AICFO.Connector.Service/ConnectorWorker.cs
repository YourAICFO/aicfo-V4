using System.Collections.Concurrent;
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
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _mappingLocks = new(StringComparer.OrdinalIgnoreCase);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("AICFO Connector service booting");

        var heartbeatTask = RunHeartbeatLoop(stoppingToken);
        var scheduledSyncTask = RunScheduledSyncLoop(stoppingToken);
        var manualSyncTask = RunManualSyncLoop(stoppingToken);

        await Task.WhenAll(heartbeatTask, scheduledSyncTask, manualSyncTask);
    }

    private async Task RunHeartbeatLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var (config, mappings) = LoadReadyMappings();
            if (config is not null)
            {
                foreach (var mapping in mappings)
                {
                    await RunSafeAsync(
                        mapping,
                        "heartbeat",
                        async () =>
                        {
                            var token = GetTokenForMapping(mapping);
                            if (string.IsNullOrWhiteSpace(token))
                            {
                                throw new InvalidOperationException($"Connector token missing for mapping {mapping.Id}.");
                            }

                            await apiClient.SendHeartbeatAsync(config, token, cancellationToken);
                            await PersistMappingState(mapping.Id, m =>
                            {
                                m.LastHeartbeatAt = DateTimeOffset.UtcNow;
                                m.LastError = null;
                            });
                        },
                        cancellationToken);
                }
            }

            var delaySeconds = config?.HeartbeatIntervalSeconds >= 10 ? config.HeartbeatIntervalSeconds : 30;
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), cancellationToken);
        }
    }

    private async Task RunScheduledSyncLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var config = configStore.Load();
            if (config is null)
            {
                await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
                continue;
            }

            config.EnsureCompatibility();
            var delayMinutes = config.SyncIntervalMinutes >= 1 ? config.SyncIntervalMinutes : 15;
            await Task.Delay(TimeSpan.FromMinutes(delayMinutes), cancellationToken);

            var (_, mappings) = LoadReadyMappings();
            foreach (var mapping in mappings)
            {
                await PerformSyncForMapping(config, mapping, "scheduled", cancellationToken);
            }
        }
    }

    private async Task RunManualSyncLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var mappingId = await syncNowSignal.WaitAsync(cancellationToken);
            var (config, mappings) = LoadReadyMappings();
            if (config is null) continue;

            var targetMappings = string.IsNullOrWhiteSpace(mappingId)
                ? mappings
                : mappings.Where(m => string.Equals(m.Id, mappingId, StringComparison.OrdinalIgnoreCase)).ToList();

            foreach (var mapping in targetMappings)
            {
                await PerformSyncForMapping(config, mapping, "manual", cancellationToken);
            }
        }
    }

    private async Task PerformSyncForMapping(ConnectorConfig config, ConnectorMapping mapping, string reason, CancellationToken cancellationToken)
    {
        await RunSafeAsync(
            mapping,
            "sync",
            async () =>
            {
                var token = GetTokenForMapping(mapping);
                if (string.IsNullOrWhiteSpace(token))
                {
                    throw new InvalidOperationException($"Connector token missing for mapping {mapping.Id}.");
                }

                logger.LogInformation(
                    "Sync started reason={Reason} mapping={MappingId} companyId={CompanyId} tallyCompany={TallyCompany}",
                    reason,
                    mapping.Id,
                    mapping.CompanyId,
                    mapping.TallyCompanyName);

                var tallyAvailable = await tallyClient.TestConnectionAsync(config, cancellationToken);
                if (!tallyAvailable)
                {
                    throw new InvalidOperationException(
                        $"Tally is not reachable at {config.TallyHost}:{config.TallyPort}. Ensure Tally is running and XML over HTTP is enabled.");
                }

                var runId = await apiClient.StartSyncRunAsync(config, token, cancellationToken);
                try
                {
                    var snapshot = await tallyClient.FetchSnapshotAsync(config, mapping.TallyCompanyName, cancellationToken);
                    var payload = payloadBuilder.BuildPayload(snapshot);
                    await apiClient.SendSyncPayloadAsync(config, token, payload, cancellationToken);
                    var hasMissingMonths = snapshot.MissingClosedMonths.Count > 0;
                    var completionStatus = hasMissingMonths ? "partial" : "success";
                    var completionError = hasMissingMonths
                        ? $"Historical months missing: {string.Join(", ", snapshot.MissingClosedMonths)}"
                        : null;
                    await apiClient.CompleteSyncRunAsync(config, token, runId, completionStatus, completionError, cancellationToken);

                    await PersistMappingState(mapping.Id, m =>
                    {
                        m.LastSyncAt = DateTimeOffset.UtcNow;
                        m.LastSyncResult = hasMissingMonths ? "Partial" : "Success";
                        m.LastError = completionError;
                    });

                    logger.LogInformation(
                        "Sync completed reason={Reason} mapping={MappingId} companyId={CompanyId} ledgers={LedgerCount} closedMonths={ClosedMonths} missingMonths={MissingMonths}",
                        reason,
                        mapping.Id,
                        mapping.CompanyId,
                        snapshot.Ledgers.Count,
                        snapshot.ClosedMonths.Count,
                        snapshot.MissingClosedMonths.Count);
                }
                catch (Exception ex)
                {
                    await apiClient.CompleteSyncRunAsync(config, token, runId, "failed", ex.Message, cancellationToken);
                    await PersistMappingState(mapping.Id, m =>
                    {
                        m.LastSyncAt = DateTimeOffset.UtcNow;
                        m.LastSyncResult = "Failed";
                        m.LastError = ex.Message;
                    });
                    throw;
                }
            },
            cancellationToken);
    }

    private async Task RunSafeAsync(ConnectorMapping mapping, string operationName, Func<Task> operation, CancellationToken cancellationToken)
    {
        var mappingLock = _mappingLocks.GetOrAdd(mapping.Id, _ => new SemaphoreSlim(1, 1));
        await mappingLock.WaitAsync(cancellationToken);
        try
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
                    await PersistMappingState(mapping.Id, m => m.LastError = ex.Message);
                    var cappedAttempt = Math.Min(attempts, 8);
                    var jitterMs = Random.Shared.Next(100, 900);
                    var delay = TimeSpan.FromMilliseconds(Math.Min(Math.Pow(2, cappedAttempt) * 1000, TimeSpan.FromMinutes(10).TotalMilliseconds) + jitterMs);
                    logger.LogWarning(
                        ex,
                        "Connector {Operation} failed mapping={MappingId} companyId={CompanyId} attempt={Attempt}; retrying in {Delay}",
                        operationName,
                        mapping.Id,
                        mapping.CompanyId,
                        attempts,
                        delay);
                    await Task.Delay(delay, cancellationToken);
                }
            }
        }
        finally
        {
            mappingLock.Release();
        }
    }

    private (ConnectorConfig? Config, List<ConnectorMapping> Mappings) LoadReadyMappings()
    {
        var config = configStore.Load();
        if (config is null)
        {
            logger.LogWarning("Connector config missing at {Path}; waiting", ConnectorPaths.ConfigFile);
            return (null, []);
        }

        try
        {
            config.EnsureCompatibility();
            config.Validate();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Invalid connector configuration");
            return (null, []);
        }

        var mappings = config.Mappings
            .Where(m => !string.IsNullOrWhiteSpace(m.CompanyId) && !string.IsNullOrWhiteSpace(m.TallyCompanyName))
            .ToList();

        return (config, mappings);
    }

    private string? GetTokenForMapping(ConnectorMapping mapping)
    {
        var mappingToken = credentialStore.LoadMappingToken(mapping.Id);
        if (!string.IsNullOrWhiteSpace(mappingToken)) return mappingToken;

        var legacyToken = credentialStore.LoadConnectorToken(mapping.CompanyId);
        if (!string.IsNullOrWhiteSpace(legacyToken))
        {
            credentialStore.SaveMappingToken(mapping.Id, legacyToken);
            return legacyToken;
        }

        return null;
    }

    private Task PersistMappingState(string mappingId, Action<ConnectorMapping> apply)
    {
        var config = configStore.Load();
        if (config is null) return Task.CompletedTask;

        config.EnsureCompatibility();
        var mapping = config.Mappings.FirstOrDefault(m => string.Equals(m.Id, mappingId, StringComparison.OrdinalIgnoreCase));
        if (mapping is null) return Task.CompletedTask;

        apply(mapping);
        configStore.Save(config);
        return Task.CompletedTask;
    }
}
