import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./providers/auth-provider";
import { TenantConfigProvider } from "./providers/tenant-config-provider";

export function App() {
  return (
    <AuthProvider>
      <TenantConfigProvider>
        <RouterProvider router={router} />
      </TenantConfigProvider>
    </AuthProvider>
  );
}
