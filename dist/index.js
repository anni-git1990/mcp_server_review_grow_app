#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const gmail_1 = require("./tools/gmail");
const gdocs_1 = require("./tools/gdocs");
const server = new index_js_1.Server({
    name: 'google-workspace-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Define tool schemas
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
    };
});
// Handle tool executions
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
// Start the server using stdio transport
async function run() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('Google Workspace MCP Server running on stdio');
}
run().catch((error) => {
    console.error('Fatal error running server:', error);
    process.exit(1);
});
