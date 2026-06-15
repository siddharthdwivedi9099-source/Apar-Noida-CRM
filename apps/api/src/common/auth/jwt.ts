import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

interface JwtPayloadBase {
  sub: string;
  tenantId: string;
  sessionId: string;
  type: "access" | "refresh";
  email: string;
  nonce?: string;
  iat: number;
  exp: number;
}

export interface JwtClaims extends JwtPayloadBase {}

interface SignJwtInput {
  subject: string;
  tenantId: string;
  sessionId: string;
  email: string;
  secret: string;
  expiresInSeconds: number;
  type: "access" | "refresh";
  nonce?: string;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function createSignature(headerSegment: string, payloadSegment: string, secret: string) {
  return createHmac("sha256", secret).update(`${headerSegment}.${payloadSegment}`).digest("base64url");
}

function compareSignatures(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createTokenNonce() {
  return randomBytes(24).toString("base64url");
}

export function signJwt({
  subject,
  tenantId,
  sessionId,
  email,
  secret,
  expiresInSeconds,
  type,
  nonce
}: SignJwtInput) {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = {
    sub: subject,
    tenantId,
    sessionId,
    email,
    type,
    nonce,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + expiresInSeconds
  };

  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT"
  };

  const headerSegment = encodeBase64Url(JSON.stringify(header));
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signature = createSignature(headerSegment, payloadSegment, secret);
  const token = `${headerSegment}.${payloadSegment}.${signature}`;

  return {
    token,
    claims: payload,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

export function verifyJwt(token: string, secret: string, expectedType: JwtClaims["type"]) {
  const [headerSegment, payloadSegment, signature] = token.split(".");

  if (!headerSegment || !payloadSegment || !signature) {
    throw new Error("Invalid token format.");
  }

  const expectedSignature = createSignature(headerSegment, payloadSegment, secret);

  if (!compareSignatures(expectedSignature, signature)) {
    throw new Error("Invalid token signature.");
  }

  const payload = JSON.parse(decodeBase64Url(payloadSegment)) as JwtClaims;

  if (payload.type !== expectedType) {
    throw new Error("Unexpected token type.");
  }

  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("Token has expired.");
  }

  return payload;
}
