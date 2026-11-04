import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "@xtanbot/config";

let token = "";
let expiresAt = 0;

/**
 * Access token for Vertex AI, signed in as the service account in GOOGLE_APPLICATION_CREDENTIALS.
 * Reused until a minute before it expires, so only one request an hour pays for the sign-in.
 */
export async function vertexToken(): Promise<string> {
  if (Date.now() < expiresAt) return token;
  const account = JSON.parse(await readFile(config.GOOGLE_APPLICATION_CREDENTIALS, "utf8")) as {
    client_email: string;
    private_key: string;
  };
  const now = Math.floor(Date.now() / 1000);
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`Vertex sign-in failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  token = data.access_token;
  expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}
