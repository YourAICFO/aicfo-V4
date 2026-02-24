# Connector Download (backend)

This folder is used for **local development** only. Production does not serve MSI from the repo.

## Production (Railway / deployed backend)

- **No MSI binaries** are stored in the repo or required at deploy time.
- Set the env var **`CONNECTOR_DOWNLOAD_URL`** to the URL of the connector MSI (e.g. a GitHub Release asset or CDN URL).
- `GET /download/connector` responds with **HTTP 302 redirect** to that URL.
- If `CONNECTOR_DOWNLOAD_URL` is not set in production, the download route returns **500** with a JSON error.

## Local development

- If `CONNECTOR_DOWNLOAD_URL` is **not** set and this file exists: **`AICFOConnectorSetup.msi`**
- then `GET /download/connector` serves that file as a download (`Content-Type: application/octet-stream`, `Content-Disposition: attachment`).
- To get the MSI here, build the connector on Windows and place/copy it:

### Option 1: Use the place script (Windows)

From the **repository root** (or from `backend`), run:

```powershell
.\backend\build-and-place-connector.ps1
```

This copies the MSI from the connector build output into `backend/downloads/AICFOConnectorSetup.msi` (if found).

### Option 2: Manual copy

1. On Windows, build the connector (see `connector-dotnet/README.md`):
   - e.g. `cd connector-dotnet; .\build-release-local.ps1` or `.\build.ps1`
2. Copy the built MSI into this folder:
   - From: `connector-dotnet\out\release\AICFOConnectorSetup.msi` or `connector-dotnet\out\AICFOConnectorSetup.msi` or `connector-dotnet\installer\bin\Release\AICFOConnectorSetup.msi`
   - To: **`backend/downloads/AICFOConnectorSetup.msi`**

## Git

- **`backend/downloads/*.msi`** is in `.gitignore`; do not commit MSI files.
- This README is tracked so the flow stays documented.
