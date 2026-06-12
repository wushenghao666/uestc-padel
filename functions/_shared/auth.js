const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", textBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textBytes(value));
  return base64Url(new Uint8Array(signature));
}

export function getAdminPassword(env) {
  return env.ADMIN_PASSWORD || "";
}

function getSessionSecret(env) {
  return env.ADMIN_SESSION_SECRET || getAdminPassword(env);
}

export async function createAdminToken(env) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = String(issuedAt);
  const signature = await hmac(getSessionSecret(env), payload);
  return `${payload}.${signature}`;
}

export async function isAdminToken(env, token) {
  if (!token || typeof token !== "string") return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;
  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.floor(Date.now() / 1000) - timestamp > TOKEN_TTL_SECONDS) return false;
  const expected = await hmac(getSessionSecret(env), issuedAt);
  return signature === expected;
}

export function getBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
