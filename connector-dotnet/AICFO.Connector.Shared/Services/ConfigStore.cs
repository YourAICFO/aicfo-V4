using System.Text.Json;
using AICFO.Connector.Shared.Models;

namespace AICFO.Connector.Shared.Services;

public interface IConfigStore
{
    ConnectorConfig? Load();
    void Save(ConnectorConfig config);
}

public sealed class ConfigStore : IConfigStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = null,
        WriteIndented = true
    };

    public ConnectorConfig? Load()
    {
        if (!File.Exists(ConnectorPaths.ConfigFile)) return null;

        var json = File.ReadAllText(ConnectorPaths.ConfigFile);
        var config = JsonSerializer.Deserialize<ConnectorConfig>(json, JsonOptions);
        config?.EnsureCompatibility();
        return config;
    }

    public void Save(ConnectorConfig config)
    {
        config.Validate();
        Directory.CreateDirectory(ConnectorPaths.ConfigDirectory);
        Directory.CreateDirectory(ConnectorPaths.LogsDirectory);

        var json = JsonSerializer.Serialize(config, JsonOptions);
        File.WriteAllText(ConnectorPaths.ConfigFile, json);
    }
}
