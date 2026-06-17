export const authFoundation = {
  phase: "implemented",
  publicRoutes: ["/login"],
  protectedRoutes: [
    "/dashboard",
    "/admin",
    "/leads",
    "/sales/sdr",
    "/sales/inside-sales",
    "/accounts",
    "/contacts",
    "/opportunities",
    "/campaigns",
    "/support",
    "/customer-success",
    "/ai-assistant"
  ]
} as const;

export const authRouting = {
  login: "/login",
  defaultAuthenticatedRoute: "/dashboard"
} as const;
