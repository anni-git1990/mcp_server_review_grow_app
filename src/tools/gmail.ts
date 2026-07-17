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
