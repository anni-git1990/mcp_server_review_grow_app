# mcp_server_review_grow_app

## Railway deployment

This project can be deployed on Railway with a Node.js service.

### Environment variables
Set these in Railway:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `MCP_TRANSPORT=http`

### Start command
Use:
- `npm start`

### Health check
The service exposes a health endpoint at `/health`.
