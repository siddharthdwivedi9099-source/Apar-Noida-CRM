import { describe, expect, it } from "vitest";
import { createTokenNonce, signJwt, verifyJwt } from "../../src/common/auth/jwt";

const secret = "unit-test-access-secret-please-change";

function sign(overrides: Partial<Parameters<typeof signJwt>[0]> = {}) {
  return signJwt({
    subject: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    email: "user@example.test",
    secret,
    expiresInSeconds: 900,
    type: "access",
    nonce: createTokenNonce(),
    ...overrides
  });
}

describe("Auth: JWT signing and verification", () => {
  it("round-trips a signed access token back to its claims", () => {
    const { token } = sign();
    const claims = verifyJwt(token, secret, "access");
    expect(claims.sub).toBe("user-1");
    expect(claims.tenantId).toBe("tenant-1");
    expect(claims.sessionId).toBe("session-1");
    expect(claims.type).toBe("access");
  });

  it("rejects a token signed with a different secret", () => {
    const { token } = sign();
    expect(() => verifyJwt(token, "a-completely-different-secret", "access")).toThrow();
  });

  it("rejects a token verified as the wrong type", () => {
    const { token } = sign({ type: "access" });
    expect(() => verifyJwt(token, secret, "refresh")).toThrow(/token type/i);
  });

  it("rejects a tampered token body", () => {
    const { token } = sign();
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
    expect(() => verifyJwt(`${header}.${forgedPayload}.${signature}`, secret, "access")).toThrow();
  });

  it("rejects an expired token", () => {
    const { token } = sign({ expiresInSeconds: -10 });
    expect(() => verifyJwt(token, secret, "access")).toThrow(/expired/i);
  });
});
