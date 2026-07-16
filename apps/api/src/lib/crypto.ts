import crypto from "crypto";

const ALGO = "aes-256-gcm";
let warnedNoKey = false;

function getKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (secret) {
    return crypto.createHash("sha256").update(secret).digest();
  }
  // Falls back to a key derived from DATABASE_URL so encrypted values still survive a
  // restart even without a dedicated secret configured. Set CREDENTIAL_ENCRYPTION_KEY in
  // production — this fallback is not safe if an attacker can read DATABASE_URL too.
  if (!warnedNoKey) {
    console.warn(
      "[lib/crypto] CREDENTIAL_ENCRYPTION_KEY is not set — provider API keys entered via the " +
        "admin UI will be encrypted with a key derived from DATABASE_URL instead. Set " +
        "CREDENTIAL_ENCRYPTION_KEY in your .env for real secret-at-rest protection."
    );
    warnedNoKey = true;
  }
  return crypto.createHash("sha256").update(process.env.DATABASE_URL ?? "insecure-default").digest();
}

/** AES-256-GCM encrypt, returning "iv.authTag.ciphertext" (each base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("malformed encrypted payload");
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
