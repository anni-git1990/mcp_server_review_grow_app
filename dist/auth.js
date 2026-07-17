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
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing required Google API environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    }
    oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
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
