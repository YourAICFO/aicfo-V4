using AICFO.Connector.Service;
using AICFO.Connector.Shared.Services;
using Serilog;

Directory.CreateDirectory(ConnectorPaths.LogsDirectory);
Directory.CreateDirectory(ConnectorPaths.ConfigDirectory);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .Enrich.WithProperty("service", "aicfo-connector-service")
    .WriteTo.File(
        path: Path.Combine(ConnectorPaths.LogsDirectory, "agent.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        shared: true)
    .CreateLogger();

try
{
    var host = Host.CreateDefaultBuilder(args)
        .UseWindowsService(options =>
        {
            options.ServiceName = "AICFO Connector Service";
        })
        .UseSerilog()
        .ConfigureServices(services =>
        {
            services.AddHttpClient<ITallyXmlClient, TallyXmlClient>(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(15);
            });

            services.AddHttpClient<IAicfoApiClient, AicfoApiClient>(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(20);
            });

            services.AddSingleton<IConfigStore, ConfigStore>();
            services.AddSingleton<ICredentialStore, CredentialStore>();
            services.AddSingleton<ITallyPayloadBuilder, TallyPayloadBuilder>();
            services.AddSingleton<SyncNowSignal>();
            services.AddHostedService<SyncNowPipeListener>();
            services.AddHostedService<ConnectorWorker>();
        })
        .Build();

    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Connector service terminated unexpectedly");
}
finally
{
    await Log.CloseAndFlushAsync();
}
