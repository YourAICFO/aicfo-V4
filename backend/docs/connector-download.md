# Connector Download Configuration

`GET /download/connector` and `GET /api/download/connector` now use this behavior:

1. If `CONNECTOR_DOWNLOAD_URL` is set:
   - returns `302` redirect to that URL
   - sets `Cache-Control: no-store`
2. If `CONNECTOR_DOWNLOAD_URL` is not set:
   - serves local file `backend/downloads/AICFOConnectorSetup.msi`
3. If neither exists:
   - returns `404` JSON with setup guidance

## Railway setup

Set environment variable:

- `CONNECTOR_DOWNLOAD_URL=https://github.com/<org>/<repo>/releases/download/<tag>/AICFOConnectorSetup.msi`

If you do not set this variable, upload local fallback file:

- `backend/downloads/AICFOConnectorSetup.msi`

## Connector discovery (Windows connector)

`GET /.well-known/aicfo-connector.json` returns JSON (no auth) so the connector can resolve the API URL:

- **apiBaseUrl:** from `API_BASE_URL` or `BACKEND_URL` (default: Railway production URL).
- **latestConnectorVersion**, **minConnectorVersion**, **downloadUrl**, **timestamp**.

Set `API_BASE_URL` (or `BACKEND_URL`) in production if your backend URL differs from the default.
