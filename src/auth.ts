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
