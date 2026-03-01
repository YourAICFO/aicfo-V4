using System.Security.Cryptography;
using System.Text;

namespace AICFO.Connector.Shared.Services;

internal static class DpapiSecretStore
{
    private static readonly object _lock = new();

    private static string SecretsDir => Path.Combine(ConnectorPaths.StateDirectory, "secrets");
    private static string CompanyFile(string companyId) => Path.Combine(SecretsDir, $"company_{Sanitize(companyId)}.bin");
    private static string MappingFile(string mappingId) => Path.Combine(SecretsDir, $"mapping_{Sanitize(mappingId)}.bin");
    private static string DeviceAuthFile() => Path.Combine(SecretsDir, "device_auth.bin");

    internal static void SaveCompanyToken(string companyId, string token) => Save(CompanyFile(companyId), token);
    internal static string? LoadCompanyToken(string companyId) => Load(CompanyFile(companyId));
    internal static void DeleteCompanyToken(string companyId) => Delete(CompanyFile(companyId));

    internal static void SaveMappingToken(string mappingId, string token) => Save(MappingFile(mappingId), token);
    internal static string? LoadMappingToken(string mappingId) => Load(MappingFile(mappingId));
    internal static void DeleteMappingToken(string mappingId) => Delete(MappingFile(mappingId));

    internal static void SaveDeviceAuthToken(string token) => Save(DeviceAuthFile(), token);
    internal static string? LoadDeviceAuthToken() => Load(DeviceAuthFile());
    internal static void DeleteDeviceAuthToken() => Delete(DeviceAuthFile());

    private static void Save(string path, string value)
    {
        lock (_lock)
        {
            Directory.CreateDirectory(SecretsDir);
            var plain = Encoding.UTF8.GetBytes(value);
            var protectedBytes = ProtectedData.Protect(plain, optionalEntropy: null, DataProtectionScope.LocalMachine);
            File.WriteAllBytes(path, protectedBytes);
        }
    }

    private static string? Load(string path)
    {
        try
        {
            lock (_lock)
            {
                if (!File.Exists(path)) return null;
                var protectedBytes = File.ReadAllBytes(path);
                var plain = ProtectedData.Unprotect(protectedBytes, optionalEntropy: null, DataProtectionScope.LocalMachine);
                return Encoding.UTF8.GetString(plain);
            }
        }
        catch
        {
            // If DPAPI fails (corrupt file / moved machine), behave like missing token.
            return null;
        }
    }

    private static void Delete(string path)
    {
        lock (_lock)
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }

    private static string Sanitize(string s)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
            s = s.Replace(c, '_');
        return s;
    }
}
