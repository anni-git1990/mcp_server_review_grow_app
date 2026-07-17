# Implementation Plan: Google Workspace MCP Server

This document outlines the step-by-step implementation plan for building a Model Context Protocol (MCP) server that connects to Gmail and Google Docs. This plan can be provided directly to Cursor or used as a guide to write the code.

---

## 1. Project Directory Structure
We will organize the project in a modular way:

```text
google-workspace-mcp/
├── docs/
│   ├── problemStatement.md
│   └── oauth_setup_guide.md       # (Optional) Detailed user steps for OAuth
├── src/
│   ├── index.ts                   # Entry point, initializes MCP server and registers tools
│   ├── auth.ts                    # Google OAuth2 client initialization and client getters
│   └── tools/
│       ├── gmail.ts               # Gmail send & draft handlers
│       └── gdocs.ts               # Google Docs append handlers
├── package.json                   # Project dependencies and build scripts
├── tsconfig.json                  # TypeScript compiler settings
├── .env.example                   # Environment variable templates
└── README.md                      # Setup and run instructions
```

---

## 2. Dependencies Setup

Initialize a Node.js TypeScript project.

### `package.json` Dependencies
```json
{
  "name": "google-workspace-mcp",
  "version": "1.0.0",
  "description": "MCP Server for Google Workspace (Gmail & Google Docs)",
  "main": "dist/index.js",
  "bin": {
    "google-workspace-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "rimraf dist && tsc",
    "start": "node dist/index.js",
    "dev": "tsc -w"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.6.0",
    "google-auth-library": "^9.0.0",
    "googleapis": "^126.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "rimraf": "^5.0.0"
  }
}
```

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

---

## 3. Step-by-Step Code Implementation

### Step 3.1: Google Auth Client (`src/auth.ts`)
Set up OAuth2 authentication using standard environment variables.

```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

let oauth2Client: OAuth2Client | null = null;

export function getOAuth2Client(): OAuth2Client {
  if (oauth2Client) return oauth2Client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing required Google API environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN'
    );
  }

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return oauth2Client;
}

export function getGmailClient() {
  const auth = getOAuth2Client();
  return google.gmail({ version: 'v1', auth });
}

export function getDocsClient() {
  const auth = getOAuth2Client();
  return google.docs({ version: 'v1', auth });
}
```

---

### Step 3.2: Gmail Handlers (`src/tools/gmail.ts`)
Implement the functions for sending emails and creating drafts. Since Gmail requires RFC 2822 formatted emails, we need to construct raw base64url-encoded messages.

```typescript
import { getGmailClient } from '../auth';

// Helper to encode emails to RFC 2822 Base64 format
function makeRawEmail(to: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    '',
    body
  ].join('\r\n');

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(to: string, subject: string, body: string) {
  const gmail = getGmailClient();
  const raw = makeRawEmail(to, subject, body);
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });
  return response.data;
}

export async function createDraft(to: string, subject: string, body: string) {
  const gmail = getGmailClient();
  const raw = makeRawEmail(to, subject, body);
  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw }
    }
  });
  return response.data;
}
```

---

### Step 3.3: Google Docs Handlers (`src/tools/gdocs.ts`)
To append text to a Google Doc, we need to fetch the document first to find its length, then send a `batchUpdate` request with an `insertText` operation targeting the end index (`length - 1`).

```typescript
import { getDocsClient } from '../auth';

export async function appendTextToDoc(documentId: string, text: string) {
  const docs = getDocsClient();

  // Get current document content to determine length
  const doc = await docs.documents.get({ documentId });
  const content = doc.data.body?.content || [];
  
  // Find the last index (subtracting 1 to account for the trailing newline)
  const lastElement = content[content.length - 1];
  const endIndex = lastElement?.endIndex ? lastElement.endIndex - 1 : 1;

  const response = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            text: text,
            location: {
              index: endIndex
            }
          }
        }
      ]
    }
  });

  return response.data;
}
```

---

### Step 3.4: Entry Point & MCP Server Registration (`src/index.ts`)
Set up the MCP server, define the tool schemas, and link request handlers to the tool implementations.

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { sendEmail, createDraft } from './tools/gmail';
import { appendTextToDoc } from './tools/gdocs';

const server = new Server(
  {
    name: 'google-workspace-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'gmail_send_email',
        description: 'Send an email directly to a recipient.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address (e.g. user@example.com)' },
            subject: { type: 'string', description: 'Subject line of the email' },
            body: { type: 'string', description: 'Plain text or HTML body of the email' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
      {
        name: 'gmail_create_draft',
        description: 'Create a draft in the users Gmail account.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address (e.g. user@example.com)' },
            subject: { type: 'string', description: 'Subject line of the email' },
            body: { type: 'string', description: 'Plain text or HTML body of the email' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
      {
        name: 'gdocs_append_text',
        description: 'Append text to the end of a specified Google Document.',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: { type: 'string', description: 'The unique ID of the Google Doc (from the document URL)' },
            text: { type: 'string', description: 'The text content to append to the document' },
          },
          required: ['documentId', 'text'],
        },
      },
    ],
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'gmail_send_email': {
        const { to, subject, body } = args as { to: string; subject: string; body: string };
        const result = await sendEmail(to, subject, body);
        return {
          content: [{ type: 'text', text: `Email sent successfully. Message ID: ${result.id}` }],
        };
      }
      case 'gmail_create_draft': {
        const { to, subject, body } = args as { to: string; subject: string; body: string };
        const result = await createDraft(to, subject, body);
        return {
          content: [{ type: 'text', text: `Draft created successfully. Draft ID: ${result.id}` }],
        };
      }
      case 'gdocs_append_text': {
        const { documentId, text } = args as { documentId: string; text: string };
        await appendTextToDoc(documentId, text);
        return {
          content: [{ type: 'text', text: `Successfully appended text to document ${documentId}` }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message || error}` }],
      isError: true,
    };
  }
});

// Start the server using stdio transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Google Workspace MCP Server running on stdio');
}

run().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
```

---

## 4. Verification & Testing Instructions

### Step 4.1: Local Compilation
Verify that the project builds correctly without compilation issues:
```bash
npm run build
```

### Step 4.2: MCP Inspector Testing
Utilize the `@modelcontextprotocol/inspector` tool to run and interact with the server locally before hooking it up to a complex client:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
Provide the required environment variables during the run command to ensure API authentication succeeds.

### Step 4.3: Configuration inside Cursor
Provide these settings inside the Cursor MCP setup:
1. Open Cursor Settings -> Features -> MCP.
2. Click **+ Add New MCP Server**.
3. Fill in the values:
   - **Name**: `google-workspace-mcp`
   - **Type**: `command`
   - **Command**: `node /absolute/path/to/google-workspace-mcp/dist/index.js`
4. Add environment variables under the tool config:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
