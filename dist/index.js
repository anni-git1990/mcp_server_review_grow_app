#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const gmail_1 = require("./tools/gmail");
const gdocs_1 = require("./tools/gdocs");
function createMcpServer() {
    const server = new index_js_1.Server({
        name: 'google-workspace-mcp',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
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
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case 'gmail_send_email': {
                    const { to, subject, body } = args;
                    const result = await (0, gmail_1.sendEmail)(to, subject, body);
                    return {
                        content: [{ type: 'text', text: `Email sent successfully. Message ID: ${result.id}` }],
                    };
                }
                case 'gmail_create_draft': {
                    const { to, subject, body } = args;
                    const result = await (0, gmail_1.createDraft)(to, subject, body);
                    return {
                        content: [{ type: 'text', text: `Draft created successfully. Draft ID: ${result.id}` }],
                    };
                }
                case 'gdocs_append_text': {
                    const { documentId, text } = args;
                    await (0, gdocs_1.appendTextToDoc)(documentId, text);
                    return {
                        content: [{ type: 'text', text: `Successfully appended text to document ${documentId}` }],
                    };
                }
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        }
        catch (error) {
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
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('Google Workspace MCP Server running on stdio');
}
const sseSessions = new Map();
async function runHttpServer() {
    const port = Number(process.env.PORT || 3000);
    const httpServer = node_http_1.default.createServer(async (req, res) => {
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
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
            });
            const transport = new sse_js_1.SSEServerTransport('/messages', res);
            const server = createMcpServer();
            await server.connect(transport);
            await transport.start();
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
