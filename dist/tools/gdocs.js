"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendTextToDoc = appendTextToDoc;
const auth_1 = require("../auth");
async function appendTextToDoc(documentId, text) {
    const docs = (0, auth_1.getDocsClient)();
    // Get current document content to determine length
    const doc = await docs.documents.get({ documentId });
    const content = doc.data.body?.content || [];
    // Find the last index (subtracting 1 to account for the trailing newline)
    const lastElement = content[content.length - 1];
    const endIndex = lastElement?.endIndex ? lastElement.endIndex - 1 : 1;
    const response = await docs.documents.batchUpdate({
        documentId,
        requestBody: {
            requests: [
                {
                    insertText: {
                        text: text,
                        location: {
                            index: endIndex
                        }
                    }
                }
            ]
        }
    });
    return response.data;
}
