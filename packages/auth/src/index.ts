export const authFoundation = {
  phase: "planned",
  publicRoutes: ["/login"],
  protectedRoutes: [
    "/dashboard",
    "/admin",
    "/leads",
    "/accounts",
    "/opportunities",
    "/campaigns",
    "/support",
    "/customer-success",
    "/ai-assistant"
  ]
} as const;

