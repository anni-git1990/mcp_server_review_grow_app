import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

let oauth2Client: OAuth2Client | null = null;

export function getOAuth2Client(): OAuth2Client {
  if (oauth2Client) return oauth2Client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing required Google API environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET'
    );
  }

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  let credentials: any = {};

  if (process.env.GOOGLE_TOKEN_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
    } catch (e: any) {
      console.error('Failed to parse GOOGLE_TOKEN_JSON environment variable:', e.message || e);
    }
  }

  // Fallback to GOOGLE_REFRESH_TOKEN if GOOGLE_TOKEN_JSON was not provided or didn't contain a refresh token
  if (!credentials.refresh_token && process.env.GOOGLE_REFRESH_TOKEN) {
    credentials.refresh_token = process.env.GOOGLE_REFRESH_TOKEN;
  }

  if (!credentials.refresh_token) {
    throw new Error(
      'Missing required credentials. Please provide GOOGLE_REFRESH_TOKEN or GOOGLE_TOKEN_JSON environment variables.'
    );
  }

  oauth2Client.setCredentials(credentials);

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
