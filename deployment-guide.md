# Deployment Guide

This guide explains how to deploy the Google Workspace MCP server to Railway.

## 1. Prepare the project
Before deployment, make sure the project builds locally:

```bash
npm install
npm run build
```

If the build succeeds, the project is ready to deploy.

## 2. Create a Railway project
1. Sign in to Railway.
2. Click New Project.
3. Choose Deploy from GitHub repo.
4. Select this repository.
5. Railway will create a new service from the repo.

## 3. Configure the service
In the Railway service settings:

- Set the build command to:
  ```bash
  npm install && npm run build
  ```
- Set the start command to:
  ```bash
  npm start
  ```

## 4. Add environment variables
Add these variables in Railway:

```text
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token (or GOOGLE_TOKEN_JSON)
MCP_TRANSPORT=http
PORT=3000
```

Important:
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are required.
- `GOOGLE_REFRESH_TOKEN` (the raw refresh token string) or `GOOGLE_TOKEN_JSON` (the stringified JSON content of `tokens.json` containing the refresh token) is required for Gmail and Google Docs access. If both are set, `GOOGLE_TOKEN_JSON` takes priority.

## 5. Deploy
1. Click Deploy.
2. Wait for the build and deployment to finish.
3. Open the generated Railway URL.

## 6. Verify the deployment
After deployment, verify the service is running:

- Visit:
  ```text
  /health
  ```
- Expected response:
  ```json
  {"status":"ok","service":"google-workspace-mcp"}
  ```

## 7. Troubleshooting
If deployment fails, check these common issues:

- Missing Google OAuth environment variables.
- Build errors from TypeScript compilation.
- The app not starting because the start command is incorrect.
- Railway not receiving the expected HTTP port.

## 8. Notes
This app now supports an HTTP-based deployment mode for Railway, which is required because the original setup was stdio-based and not suitable for direct hosting.
