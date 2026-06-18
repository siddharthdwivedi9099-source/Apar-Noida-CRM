import {
  buildPermissionCode,
  permissionActionKeys,
  type PermissionActionKey,
  type PermissionModuleKey
} from "@crm/types";

export function hasAnyPermission(currentPermissionCodes: string[], requiredPermissionCodes: string[]) {
  return requiredPermissionCodes.some((permissionCode) => currentPermissionCodes.includes(permissionCode));
}

export function hasAllPermissions(currentPermissionCodes: string[], requiredPermissionCodes: string[]) {
  return requiredPermissionCodes.every((permissionCode) => currentPermissionCodes.includes(permissionCode));
}

export function getModuleAccessPermissionCodes(moduleKey: PermissionModuleKey) {
  return permissionActionKeys.map((actionKey) => buildPermissionCode(moduleKey, actionKey));
}

export function getSpecificPermissionCodes(
  moduleKey: PermissionModuleKey,
  actionKeys: PermissionActionKey[]
) {
  return actionKeys.map((actionKey) => buildPermissionCode(moduleKey, actionKey));
}

export const routePermissionRequirements = {
  dashboard: getSpecificPermissionCodes("dashboards", ["view", "view_dashboard"]),
  admin: getModuleAccessPermissionCodes("admin"),
  leads: getModuleAccessPermissionCodes("leads"),
  salesWorkspaces: Array.from(
    new Set([...getModuleAccessPermissionCodes("leads"), ...getModuleAccessPermissionCodes("sales")])
  ),
  accounts: getModuleAccessPermissionCodes("accounts"),
  contacts: getModuleAccessPermissionCodes("contacts"),
  opportunities: getModuleAccessPermissionCodes("opportunities"),
  businessDevelopment: getModuleAccessPermissionCodes("business_development"),
  presales: getModuleAccessPermissionCodes("presales"),
  partners: getModuleAccessPermissionCodes("partners"),
  resellers: getModuleAccessPermissionCodes("resellers"),
  campaigns: getModuleAccessPermissionCodes("campaigns"),
  social: getModuleAccessPermissionCodes("social"),
  support: getModuleAccessPermissionCodes("support"),
  customerSuccess: getModuleAccessPermissionCodes("customer_success"),
  training: getModuleAccessPermissionCodes("training"),
  aiAssistant: getModuleAccessPermissionCodes("ai"),
  customerQuery: getModuleAccessPermissionCodes("customer_query")
} as const;

export const adminMutationPermissions = {
  createRole: getSpecificPermissionCodes("admin", ["create", "configure"]),
  editRole: getSpecificPermissionCodes("admin", ["edit", "configure"]),
  deleteRole: getSpecificPermissionCodes("admin", ["delete", "configure"]),
  assignPermissions: getSpecificPermissionCodes("admin", ["assign", "configure"]),
  viewAdmin: getSpecificPermissionCodes("admin", ["view", "configure"])
} as const;
