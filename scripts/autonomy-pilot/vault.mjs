import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto";

function keyBytes(key) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) throw new Error("Invalid vault key");
  return bytes;
}
export function seal(value, key, context) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", keyBytes(key), nonce);
  const aad = JSON.stringify(context);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return JSON.stringify({version:1, context, nonce:nonce.toString("base64"), tag:cipher.getAuthTag().toString("base64"), ciphertext:ciphertext.toString("base64")});
}
export function unseal(envelope, key, expected) {
  const box = JSON.parse(envelope);
  if (box.version !== 1 || Object.entries(expected).some(([k,v]) => box.context?.[k] !== v)) throw new Error("Vault provenance mismatch");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), Buffer.from(box.nonce,"base64"));
  decipher.setAAD(Buffer.from(JSON.stringify(box.context)));
  decipher.setAuthTag(Buffer.from(box.tag,"base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.ciphertext,"base64")), decipher.final()]).toString());
}
