import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient();

export async function extractTextFromImage(base64Image: string): Promise<string> {
  // Vision API expects image as base64 or URI
  const [result] = await client.textDetection({
    image: { content: base64Image },
  });
  const detections = result.textAnnotations || [];
  // The first annotation is the full text
  return detections.length > 0 ? detections[0].description || '' : '';
}
