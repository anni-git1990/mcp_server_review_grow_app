"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.createDraft = createDraft;
const auth_1 = require("../auth");
// Helper to encode emails to RFC 2822 Base64 format
function makeRawEmail(to, subject, body) {
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
async function sendEmail(to, subject, body) {
    const gmail = (0, auth_1.getGmailClient)();
    const raw = makeRawEmail(to, subject, body);
    const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
    });
    return response.data;
}
async function createDraft(to, subject, body) {
    const gmail = (0, auth_1.getGmailClient)();
    const raw = makeRawEmail(to, subject, body);
    const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
            message: { raw }
        }
    });
    return response.data;
}
