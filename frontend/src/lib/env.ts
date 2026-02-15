const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8080';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function stripApiSuffix(value: string): string {
  const trimmed = trimTrailingSlash(value);
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function normalizeUrl(value: string): string {
  return trimTrailingSlash(value.trim());
}

export function getBackendBaseUrl(): string {
  const backendBase = import.meta.env.VITE_API_BASE_URL;
  const apiBase = import.meta.env.VITE_API_URL;

  if (backendBase && backendBase.trim()) {
    return stripApiSuffix(normalizeUrl(backendBase));
  }

  if (apiBase && apiBase.trim()) {
    return stripApiSuffix(normalizeUrl(apiBase));
  }

  return DEFAULT_BACKEND_BASE_URL;
}

export function getApiBaseUrl(): string {
  const safeComputedApiBase = `${getBackendBaseUrl()}/api`;
  const apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase || !apiBase.trim()) return safeComputedApiBase;

  const normalized = normalizeUrl(apiBase);
  if (normalized.endsWith('/api')) return normalized;
  return safeComputedApiBase;
}

export function getConnectorDownloadUrl(): string {
  return `${getBackendBaseUrl()}/download/connector`;
}
