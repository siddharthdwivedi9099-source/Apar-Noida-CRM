import type { CookieOptions, Request, Response } from "express";

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        const name = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
        const value = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : "";
        return [name, decodeURIComponent(value)] as const;
      })
  );
}

export function getCookieValue(request: Request, cookieName: string) {
  return parseCookies(request.headers.cookie).get(cookieName) ?? null;
}

export function setRefreshTokenCookie(
  response: Response,
  cookieName: string,
  token: string,
  expiresAt: string,
  options: Pick<CookieOptions, "secure" | "sameSite">
) {
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    expires: new Date(expiresAt),
    path: "/api/v1/auth"
  });
}

export function clearRefreshTokenCookie(
  response: Response,
  cookieName: string,
  options: Pick<CookieOptions, "secure" | "sameSite">
) {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: "/api/v1/auth"
  });
}
