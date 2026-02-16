namespace AICFO.Connector.Shared.Services;

public static class DeviceIdentityStore
{
    public static string GetOrCreateDeviceId()
    {
        Directory.CreateDirectory(ConnectorPaths.ConfigDirectory);

        if (File.Exists(ConnectorPaths.DeviceIdFile))
        {
            var existing = File.ReadAllText(ConnectorPaths.DeviceIdFile).Trim();
            if (!string.IsNullOrWhiteSpace(existing))
            {
                return existing;
            }
        }

        var generated = Guid.NewGuid().ToString("N");
        File.WriteAllText(ConnectorPaths.DeviceIdFile, generated);
        return generated;
    }
}

