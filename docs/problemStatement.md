# Problem Statement: Google Workspace (Gmail & Google Docs) MCP Server

## Overview
We need to build a generic **Model Context Protocol (MCP)** server that allows AI agents (such as Cursor, Claude Desktop, or custom agents) to securely interact with Google Workspace APIs. 

Specifically, the server must support two primary capabilities:
1. **Gmail Integration**: Draft and send emails.
2. **Google Docs Integration**: Append content to Google Documents.

The server should be generic, configurable, and easy to run in any MCP-compliant client.

---

## 1. Objectives & Scope

- **Interoperability**: Standardize tool inputs and outputs using the MCP specification so that any LLM agent can understand, discover, and invoke them.
- **Configuration**: Avoid hardcoding credentials. Credentials and user tokens should be provided via environment variables or a configuration file.
- **Security & Scope**: Access should be restricted to the minimum required scopes:
  - Gmail: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.compose`
  - Google Docs: `https://www.googleapis.com/auth/documents` (or `https://www.googleapis.com/auth/drive.file` / `https://www.googleapis.com/auth/documents`)

---

## 2. Technical Stack Recommendation
We recommend building this server using **TypeScript/Node.js** with the official `@modelcontextprotocol/sdk`. 
- **Language**: TypeScript
- **Runtime**: Node.js (v18+)
- **Google APIs**: `@googleapis/gmail`, `@googleapis/docs`, `google-auth-library`
- **MCP SDK**: `@modelcontextprotocol/sdk`

*Alternatively, Python with the `mcp` SDK and `google-api-python-client` is acceptable if it aligns better with the implementation preferences, but TypeScript is preferred for ease of distribution via npm/npx.*

---

## 3. Configuration & Authentication Flow

Since Google APIs require OAuth2 authentication, the server must handle authentication dynamically:

1. **OAuth Credentials**: The client must supply Google OAuth2 Client ID, Client Secret, and Refresh Token via environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
2. **Dynamic Auth Initialization**: On server startup, initialize the Google OAuth2 client using these credentials. The refresh token allows the server to automatically refresh access tokens without user intervention during agent sessions.
3. **Generic Settings Support**: Ensure the server reads these values from either process environment variables or an MCP configuration block if passed by the client.

---

## 4. MCP Tools Specification

The MCP server must expose the following three tools:

### Tool 1: `gmail_send_email`
Sends an email directly to a recipient.

- **Parameters**:
  - `to` (string, required): Recipient's email address.
  - `subject` (string, required): Subject of the email.
  - `body` (string, required): Plain text or HTML body of the email.
- **Expected Output**: A success message along with the Gmail Message ID.

### Tool 2: `gmail_create_draft`
Creates a draft in the user's Gmail account for review.

- **Parameters**:
  - `to` (string, required): Recipient's email address.
  - `subject` (string, required): Subject of the email.
  - `body` (string, required): Plain text or HTML body of the email.
- **Expected Output**: A success message along with the Gmail Draft ID.

### Tool 3: `gdocs_append_text`
Appends text content to the end of a specified Google Document.

- **Parameters**:
  - `documentId` (string, required): The ID of the Google Document (extracted from the Doc's URL).
  - `text` (string, required): The content to append to the document.
- **Expected Output**: A success message confirming the text has been appended.

---

## 5. Implementation Requirements

### Robust Error Handling
- **Authentication Failures**: Return a clear error if the Google API credentials/refresh tokens are invalid or expired.
- **Resource Not Found**: Return clear feedback if a Google Doc ID is incorrect or inaccessible.
- **API Rate Limits**: Handle Google API rate limits gracefully, returning informative errors or implementing basic retries.

### Detailed Tool Descriptions
Ensure all parameters and descriptions in the tool definitions are descriptive. LLMs rely heavily on schema descriptions to decide which tool to call and how to structure parameters.
For example:
- `documentId`: `"The unique ID of the Google Doc, e.g., '1uP_L7Zp...' found in the document's URL."`
- `to`: `"Recipient's email address (e.g., 'recipient@example.com')."`

### Easy Integration / Dev UX
- Provide a `run` or `start` command that prints logs to `stderr` (since MCP uses `stdout` for JSON-RPC communication).
- Provide a clear instruction readme for generating OAuth credentials (creating a Google Cloud Project, enabling Gmail & Docs APIs, configuring OAuth consent screen, and fetching a refresh token).

---

## 6. How to Configure Cursor / Claude Desktop to Test

To test the MCP server, Cursor or Claude Desktop can be configured with:

```json
{
  "mcpServers": {
    "google-workspace-mcp": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REFRESH_TOKEN": "your-refresh-token"
      }
    }
  }
}
```
