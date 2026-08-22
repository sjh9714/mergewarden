import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

const encoder = new TextEncoder();

export function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function utf8Prefix(value: string, maxBytes: number): string {
  let bytes = 0;
  let codeUnitEnd = 0;

  for (const codePoint of value) {
    const codePointBytes = utf8ByteLength(codePoint);
    if (bytes + codePointBytes > maxBytes) {
      break;
    }

    bytes += codePointBytes;
    codeUnitEnd += codePoint.length;
  }

  return value.slice(0, codeUnitEnd);
}
