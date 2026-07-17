#!/usr/bin/env node
import http from 'node:http';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { sendEmail, createDraft } from './tools/gmail';
import { appendTextToDoc } from './tools/gdocs';

function createMcpServer() {
  const server = new McpServer(
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
        description: 'Create a draft in the user\'s Gmail account.',
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
  }));

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

  return server;
}

async function runStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Google Workspace MCP Server running on stdio');
}

const sseSessions = new Map<string, { server: McpServer; transport: SSEServerTransport }>();

async function runHttpServer() {
  const port = Number(process.env.PORT || 3000);

  const httpServer = http.createServer(async (req, res) => {
    // Add CORS headers for wider client compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Authorization');

    // Handle CORS preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!req.url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing URL' }));
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && (requestUrl.pathname === '/health' || requestUrl.pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'google-workspace-mcp' }));
      return;
    }

    if (req.method === 'GET' && (requestUrl.pathname === '/sse' || requestUrl.pathname === '/mcp')) {
      // Set headers on response object (SSEServerTransport will call writeHead internally)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for reverse proxies like Nginx/Railway

      const transport = new SSEServerTransport('/messages', res);
      const server = createMcpServer();
      await server.connect(transport);

      const sessionId = transport.sessionId;
      sseSessions.set(sessionId, { server, transport });

      req.on('close', async () => {
        sseSessions.delete(sessionId);
        await transport.close();
      });
      return;
    }

    if (req.method === 'POST' && (requestUrl.pathname === '/messages' || requestUrl.pathname === '/mcp')) {
      const sessionId = requestUrl.searchParams.get('sessionId') || req.headers['mcp-session-id']?.toString();
      const session = sessionId ? sseSessions.get(sessionId) : undefined;

      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      await session.transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  httpServer.listen(port, () => {
    console.log(`Google Workspace MCP Server listening on port ${port}`);
  });
}

async function run() {
  const transportMode = process.env.MCP_TRANSPORT || (process.env.PORT ? 'http' : 'stdio');

  if (transportMode === 'http') {
    await runHttpServer();
    return;
  }

  await runStdioServer();
}

run().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
