"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuth2Client = getOAuth2Client;
exports.getGmailClient = getGmailClient;
exports.getDocsClient = getDocsClient;
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let oauth2Client = null;
function getOAuth2Client() {
    if (oauth2Client)
        return oauth2Client;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('Missing required Google API environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
    }
    oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret);
    let credentials = {};
    if (process.env.GOOGLE_TOKEN_JSON) {
        try {
            credentials = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
        }
        catch (e) {
            console.error('Failed to parse GOOGLE_TOKEN_JSON environment variable:', e.message || e);
        }
    }
    // Fallback to GOOGLE_REFRESH_TOKEN if GOOGLE_TOKEN_JSON was not provided or didn't contain a refresh token
    if (!credentials.refresh_token && process.env.GOOGLE_REFRESH_TOKEN) {
        credentials.refresh_token = process.env.GOOGLE_REFRESH_TOKEN;
    }
    if (!credentials.refresh_token) {
        throw new Error('Missing required credentials. Please provide GOOGLE_REFRESH_TOKEN or GOOGLE_TOKEN_JSON environment variables.');
    }
    oauth2Client.setCredentials(credentials);
    return oauth2Client;
}
function getGmailClient() {
    const auth = getOAuth2Client();
    return googleapis_1.google.gmail({ version: 'v1', auth });
}
function getDocsClient() {
    const auth = getOAuth2Client();
    return googleapis_1.google.docs({ version: 'v1', auth });
}
