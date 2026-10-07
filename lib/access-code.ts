import { randomBytes } from "node:crypto";

const ACCESS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ACCEPTED_BYTE_LIMIT =
  Math.floor(256 / ACCESS_CODE_ALPHABET.length) * ACCESS_CODE_ALPHABET.length;
const ACCESS_CODE_LENGTH = 16;

export function generateAccessCode() {
  let code = "";

  while (code.length < ACCESS_CODE_LENGTH) {
    for (const byte of randomBytes(32)) {
      if (byte >= ACCEPTED_BYTE_LIMIT) continue;
      code += ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length];
      if (code.length === ACCESS_CODE_LENGTH) break;
    }
  }

  return code;
}
