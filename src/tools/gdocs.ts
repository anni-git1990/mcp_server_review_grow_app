import { getDocsClient } from '../auth';

export async function appendTextToDoc(documentId: string, text: string) {
  const docs = getDocsClient();

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
