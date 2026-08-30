import { MAX_UPLOAD_IMAGE_BYTES } from './limits';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function matches(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectImageMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && matches(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytes.length >= 8 && matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

export async function validateImageFile(file: Blob & { type?: string; name?: string }): Promise<{ mimeType: string }> {
  if (file.size <= 0) throw new Error('The selected image is empty.');
  if (file.size > MAX_UPLOAD_IMAGE_BYTES) throw new Error('Images must be 10 MB or smaller.');
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = detectImageMimeType(header);
  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected)) {
    throw new Error('Unsupported image contents. Use JPEG, PNG, WebP, or AVIF.');
  }
  if (file.type && file.type !== detected) {
    throw new Error(`The declared image type ${file.type} does not match its ${detected} contents.`);
  }
  return { mimeType: detected };
}

export async function validatePdfFile(file: Blob & { type?: string }): Promise<void> {
  if (file.size <= 0) throw new Error('The selected document is empty.');
  if (file.type && file.type !== 'application/pdf') throw new Error('Only PDF documents are supported.');
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (ascii(header, 0, 5) !== '%PDF-') throw new Error('The selected file does not contain a valid PDF signature.');
}
