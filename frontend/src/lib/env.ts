const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8080';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function stripApiSuffix(value: string): string {
  return value.endsWith('/api') ? value.slice(0, -4) : value;
}

export function getBackendBaseUrl(): string {
  const backendBase = import.meta.env.VITE_API_BASE_URL;
  const apiBase = import.meta.env.VITE_API_URL;

  if (backendBase) {
    return trimTrailingSlash(backendBase);
  }

  if (apiBase) {
    return trimTrailingSlash(stripApiSuffix(apiBase));
  }

  return DEFAULT_BACKEND_BASE_URL;
}

export function getApiBaseUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase) {
    return trimTrailingSlash(apiBase);
  }

  return `${getBackendBaseUrl()}/api`;
}

export function getConnectorDownloadUrl(): string {
  return `${getBackendBaseUrl()}/download/connector`;
}
