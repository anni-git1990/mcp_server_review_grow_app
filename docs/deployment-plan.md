# Deployment Plan: Railway

## Goal
Deploy the Google Workspace MCP server on Railway so it can run as a managed Node.js service and securely use Gmail and Google Docs APIs.

## Important Note
The current server entrypoint uses stdio transport, which is appropriate for local MCP clients but not for direct hosting on Railway. For Railway, the server should be adapted to expose an HTTP-based MCP endpoint (or be wrapped by a small bridge that exposes a health endpoint and forwards MCP requests).

## Recommended Deployment Architecture
- Run the service as a Node.js app on Railway.
- Expose a health endpoint such as `/health`.
- Use an HTTP-based MCP transport (recommended) or a small adapter service that accepts HTTP requests and forwards them to the MCP server.
- Store Google OAuth credentials as Railway environment variables.

## Prerequisites
- A Railway account and a connected GitHub repository.
- A Google Cloud project with OAuth credentials.
- A Google refresh token for Gmail and Google Docs access.
- A Node.js runtime version compatible with the project (recommended: Node 20).

## Deployment Steps

### 1. Prepare the app for Railway
- Ensure the app builds successfully locally:
  - `npm install`
  - `npm run build`
- Confirm the runtime entrypoint is Railway-compatible.
- Add a production start command that listens on the Railway-provided port.

### 2. Adapt the server for HTTP hosting
Because the current implementation uses stdio, make the following change before deployment:
- Replace or wrap the stdio-based MCP server with an HTTP-capable transport.
- Expose a health endpoint for Railway monitoring.
- Read the port from `process.env.PORT`.

Suggested production behavior:
- `GET /health` returns `200 OK` with a simple JSON payload.
- MCP requests are handled over HTTP at a route such as `/mcp`.

### 3. Configure environment variables in Railway
Set these variables in the Railway project dashboard:
- `NODE_ENV=production`
- `PORT=3000` (Railway usually injects this automatically)
- `GOOGLE_CLIENT_ID=<your-google-client-id>`
- `GOOGLE_CLIENT_SECRET=<your-google-client-secret>`
- `GOOGLE_REFRESH_TOKEN=<your-google-refresh-token>`
- Optional: `MCP_AUTH_TOKEN=<shared-secret>` for basic protection

### 4. Configure the Railway service
- Create a new Railway service from the GitHub repository.
- Use the repository root as the service root.
- Set the build command to:
  - `npm install && npm run build`
- Set the start command to:
  - `npm start`
- Enable automatic deploys from the main branch.

### 5. Verify deployment
After deployment:
- Open the Railway generated URL and confirm `/health` returns success.
- Test the MCP endpoint with a client that supports HTTP MCP transport.
- Review logs for OAuth initialization or missing environment variable issues.

## Suggested Project Changes
The following changes are typically required before deployment:
1. Add an HTTP transport layer for the MCP server.
2. Add a health check route.
3. Update `package.json` scripts if needed.
4. Ensure the app exits cleanly and logs useful startup information.

## Example Runtime Notes
- Railway expects a long-running process.
- The service should not depend on local files for runtime state unless they are persisted.
- OAuth credentials should never be hardcoded in source control.

## Rollout Checklist
- [ ] App builds locally
- [ ] HTTP transport is available
- [ ] Health endpoint works
- [ ] Railway environment variables are set
- [ ] Service deploys successfully
- [ ] MCP endpoint is reachable
- [ ] Gmail and Google Docs tools work in production

## Recommended Next Step
Implement the HTTP-based MCP server entrypoint and health endpoint first, then deploy to Railway and verify the production endpoint end to end.
