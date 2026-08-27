import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress the photo.'));
    }, type, quality);
  });
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo.'));
    };
    img.src = url;
  });
}

export async function fileToCompressedBase64(file, maxEdge = 1280) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  if (typeof image.close === 'function') image.close();
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    imageBase64: btoa(binary),
    mimeType: 'image/jpeg',
  };
}

export async function readReceiptWithAi(imageFile) {
  const payload = await fileToCompressedBase64(imageFile);
  const callable = httpsCallable(functions, 'readReceiptImage', { timeout: 60000 });
  const result = await callable(payload);
  if (!result.data || !result.data.content) {
    throw new Error('OpenAI returned an empty read.');
  }
  return result.data.content;
}
