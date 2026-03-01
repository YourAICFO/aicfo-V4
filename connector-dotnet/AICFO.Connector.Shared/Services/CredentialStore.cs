namespace AICFO.Connector.Shared.Services;

public interface ICredentialStore
{
    void SaveConnectorToken(string companyId, string token);
    string? LoadConnectorToken(string companyId);
    void DeleteConnectorToken(string companyId);
    void SaveMappingToken(string mappingId, string token);
    string? LoadMappingToken(string mappingId);
    void DeleteMappingToken(string mappingId);
    void SaveDeviceAuthToken(string token);
    string? LoadDeviceAuthToken();
    void DeleteDeviceAuthToken();
}

public sealed class CredentialStore : ICredentialStore
{
    public void SaveConnectorToken(string companyId, string token)
    {
        try
        {
            DpapiSecretStore.SaveCompanyToken(companyId, token);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to store connector token.", ex);
        }
    }

    public string? LoadConnectorToken(string companyId) => DpapiSecretStore.LoadCompanyToken(companyId);

    public void DeleteConnectorToken(string companyId) => DpapiSecretStore.DeleteCompanyToken(companyId);

    public void SaveMappingToken(string mappingId, string token)
    {
        try
        {
            DpapiSecretStore.SaveMappingToken(mappingId, token);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to store mapping token.", ex);
        }
    }

    public string? LoadMappingToken(string mappingId) => DpapiSecretStore.LoadMappingToken(mappingId);

    public void DeleteMappingToken(string mappingId) => DpapiSecretStore.DeleteMappingToken(mappingId);

    public void SaveDeviceAuthToken(string token)
    {
        try
        {
            DpapiSecretStore.SaveDeviceAuthToken(token);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to store device auth token.", ex);
        }
    }

    public string? LoadDeviceAuthToken() => DpapiSecretStore.LoadDeviceAuthToken();

    public void DeleteDeviceAuthToken() => DpapiSecretStore.DeleteDeviceAuthToken();
}
