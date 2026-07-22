import { Packer, type Document } from "docx";

// Packer.toBuffer is Node-only; toBase64String runs everywhere JSZip does.
// Decoding by hand keeps this package free of Buffer/atob platform globals.
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const byteLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);
  let bitBuffer = 0;
  let bitCount = 0;
  let offset = 0;
  for (const char of clean) {
    bitBuffer = (bitBuffer << 6) | BASE64_CHARS.indexOf(char);
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[offset++] = (bitBuffer >> bitCount) & 0xff;
    }
  }
  return bytes;
}

/** Packs a docx Document to bytes in both Node and browser runtimes. */
export async function packDocx(document: Document): Promise<Uint8Array> {
  return base64ToBytes(await Packer.toBase64String(document));
}
