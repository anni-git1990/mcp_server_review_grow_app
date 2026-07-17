const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

// Scopes required by the MCP server tools (Gmail send/draft, Google Docs append)
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/documents'
];

const TOKEN_PATH = path.join(__dirname, 'tokens.json');
const ENV_PATH = path.join(__dirname, '.env');
const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');

// If client_secret.json doesn't exist locally, try copying it from the downloads folder
if (!fs.existsSync(CLIENT_SECRET_PATH)) {
  const downloadedPath = 'c:/Users/Anita/Downloads/client_secret.json';
  if (fs.existsSync(downloadedPath)) {
    console.log(`Copying client_secret.json from ${downloadedPath}...`);
    fs.copyFileSync(downloadedPath, CLIENT_SECRET_PATH);
  } else {
    console.error('Error: client_secret.json not found in root or downloads folder.');
    process.exit(1);
  }
}

// Load client secrets from local file.
const content = fs.readFileSync(CLIENT_SECRET_PATH, 'utf8');
const credentials = JSON.parse(content);
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// Check if we have previously stored a token.
if (fs.existsSync(TOKEN_PATH)) {
  console.log('tokens.json already exists! If you want to regenerate, delete it and run again.');
  process.exit(0);
}

getNewToken(oAuth2Client);

function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  console.log('Authorize this app by visiting this url:');
  console.log('\x1b[36m%s\x1b[0m', authUrl);
  console.log('\nAfter authorizing, you will be redirected to a page (e.g. localhost/?code=...).');
  console.log('Copy the "code" query parameter from the address bar and paste it below.');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code here: ', (code) => {
    rl.close();
    // Google codes might be URL-encoded, let's decode to be safe
    const decodedCode = decodeURIComponent(code.trim());
    oAuth2Client.getToken(decodedCode, (err, token) => {
      if (err) {
        console.error('Error retrieving access token', err);
        return;
      }
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program access
      fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('Token stored to', TOKEN_PATH);
        
        // Also update .env file with client id, client secret, and refresh token
        updateEnvFile(client_id, client_secret, token.refresh_token);
      });
    });
  });
}

function updateEnvFile(clientId, clientSecret, refreshToken) {
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  }

  // Update or append environment variables
  const vars = {
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REFRESH_TOKEN: refreshToken
  };

  let lines = envContent.split('\n');
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`^${key}=.*`);
    let found = false;
    lines = lines.map(line => {
      if (regex.test(line.trim())) {
        found = true;
        return `${key}=${val}`;
      }
      return line;
    });
    if (!found) {
      lines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf8');
  console.log('.env file successfully updated with credentials!');
}
