import { useEffect, useState } from "react";
import type {
  CreateRoleRequestBody,
  RbacCatalogResponse,
  RbacRolesResponse,
  RbacUserSummary,
  RbacUsersResponse,
  RoleDetail,
  RoleTemplateSummary
} from "@crm/types";
import { ShieldCheck, UserCog, WandSparkles } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { adminMutationPermissions, hasAnyPermission } from "@/lib/rbac";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CreateRoleFormState {
  name: string;
  slug: string;
  description: string;
  templateKey: string;
}

interface RoleDraftState {
  name: string;
  slug: string;
  description: string;
}

function slugifyRoleName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}

const textareaClassName =
  "flex min-h-[112px] w-full rounded-[1.25rem] border border-input bg-background px-4 py-3 text-sm shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function AdminPage() {
  const { accessToken, user, hasAnyPermission: authHasAnyPermission } = useAuth();
  const [catalog, setCatalog] = useState<RbacCatalogResponse | null>(null);
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [users, setUsers] = useState<RbacUserSummary[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createRoleForm, setCreateRoleForm] = useState<CreateRoleFormState>({
    name: "",
    slug: "",
    description: "",
    templateKey: ""
  });
  const [roleDraft, setRoleDraft] = useState<RoleDraftState>({
    name: "",
    slug: "",
    description: ""
  });
  const [editablePermissionCodes, setEditablePermissionCodes] = useState<string[]>([]);
  const [editableUserRoleIds, setEditableUserRoleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;
  const selectedUser = users.find((entry) => entry.id === selectedUserId) ?? users[0] ?? null;
  const roleTemplates = catalog?.roleTemplates ?? [];
  const permissionGroups =
    catalog?.modules
      .map((moduleSummary) => ({
        module: moduleSummary,
        permissions: catalog.permissions.filter((permission) => permission.moduleKey === moduleSummary.key)
      }))
      .filter((entry) => entry.permissions.length > 0) ?? [];

  const canViewAdmin = authHasAnyPermission(adminMutationPermissions.viewAdmin);
  const canCreateRole = authHasAnyPermission(adminMutationPermissions.createRole);
  const canEditRole = authHasAnyPermission(adminMutationPermissions.editRole);
  const canDeleteRole = authHasAnyPermission(adminMutationPermissions.deleteRole);
  const canAssignPermissions = authHasAnyPermission(adminMutationPermissions.assignPermissions);

  async function loadAdminWorkspace() {
    if (!accessToken || !canViewAdmin) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [catalogResponse, roleResponse, userResponse] = await Promise.all([
        apiRequest<RbacCatalogResponse>("/rbac/catalog", {
          method: "GET",
          accessToken
        }),
        apiRequest<RbacRolesResponse>("/rbac/roles", {
          method: "GET",
          accessToken
        }),
        apiRequest<RbacUsersResponse>("/rbac/users", {
          method: "GET",
          accessToken
        })
      ]);

      setCatalog(catalogResponse);
      setRoles(roleResponse.roles);
      setUsers(userResponse.users);
      setSelectedRoleId((currentValue) =>
        currentValue && roleResponse.roles.some((role) => role.id === currentValue)
          ? currentValue
          : roleResponse.roles[0]?.id ?? null
      );
      setSelectedUserId((currentValue) =>
        currentValue && userResponse.users.some((entry) => entry.id === currentValue)
          ? currentValue
          : userResponse.users.find((entry) => entry.id === user?.id)?.id ?? userResponse.users[0]?.id ?? null
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminWorkspace();
  }, [accessToken, canViewAdmin]);

  useEffect(() => {
    if (!selectedRole) {
      setRoleDraft({
        name: "",
        slug: "",
        description: ""
      });
      setEditablePermissionCodes([]);
      return;
    }

    setRoleDraft({
      name: selectedRole.name,
      slug: selectedRole.slug,
      description: selectedRole.description ?? ""
    });
    setEditablePermissionCodes(selectedRole.permissionCodes);
  }, [selectedRoleId, roles]);

  useEffect(() => {
    if (!selectedUser) {
      setEditableUserRoleIds([]);
      return;
    }

    setEditableUserRoleIds(selectedUser.roles.map((role) => role.id));
  }, [selectedUserId, users]);

  function applyTemplateToCreateForm(template: RoleTemplateSummary) {
    setCreateRoleForm({
      name: template.name,
      slug: template.slug,
      description: template.description,
      templateKey: template.key
    });
  }

  async function handleCreateRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !canCreateRole) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: CreateRoleRequestBody = {
        name: createRoleForm.name.trim(),
        slug: createRoleForm.slug.trim(),
        description: createRoleForm.description.trim() || undefined,
        templateKey: createRoleForm.templateKey || undefined
      };
      const response = await apiRequest<{ role: RoleDetail }>("/rbac/roles", {
        method: "POST",
        accessToken,
        body: payload
      });

      setSuccessMessage(`Created role "${response.role.name}".`);
      setCreateRoleForm({
        name: "",
        slug: "",
        description: "",
        templateKey: ""
      });
      await loadAdminWorkspace();
      setSelectedRoleId(response.role.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveRoleDetails() {
    if (!accessToken || !selectedRole || !canEditRole) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<{ role: RoleDetail }>(`/rbac/roles/${selectedRole.id}`, {
        method: "PATCH",
        accessToken,
        body: {
          name: roleDraft.name.trim(),
          slug: roleDraft.slug.trim(),
          description: roleDraft.description.trim() || null
        }
      });

      setSuccessMessage(`Updated role "${response.role.name}".`);
      await loadAdminWorkspace();
      setSelectedRoleId(response.role.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveRolePermissions() {
    if (!accessToken || !selectedRole || !canAssignPermissions) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<{ role: RoleDetail }>(`/rbac/roles/${selectedRole.id}/permissions`, {
        method: "PUT",
        accessToken,
        body: {
          permissionCodes: editablePermissionCodes
        }
      });

      setSuccessMessage(`Saved permissions for "${response.role.name}".`);
      await loadAdminWorkspace();
      setSelectedRoleId(response.role.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteRole() {
    if (!accessToken || !selectedRole || !canDeleteRole || selectedRole.isSystemRole) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest<{ success: true }>(`/rbac/roles/${selectedRole.id}`, {
        method: "DELETE",
        accessToken
      });

      setSuccessMessage(`Deleted role "${selectedRole.name}".`);
      setSelectedRoleId(null);
      await loadAdminWorkspace();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveUserRoles() {
    if (!accessToken || !selectedUser || !canAssignPermissions) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<{ user: RbacUserSummary }>(`/rbac/users/${selectedUser.id}/roles`, {
        method: "PUT",
        accessToken,
        body: {
          roleIds: editableUserRoleIds
        }
      });

      setSuccessMessage(`Updated role assignments for ${response.user.displayName}.`);
      await loadAdminWorkspace();
      setSelectedUserId(response.user.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function togglePermissionCode(permissionCode: string) {
    setEditablePermissionCodes((currentPermissionCodes) =>
      currentPermissionCodes.includes(permissionCode)
        ? currentPermissionCodes.filter((entry) => entry !== permissionCode)
        : [...currentPermissionCodes, permissionCode]
    );
  }

  function toggleUserRole(roleId: string) {
    setEditableUserRoleIds((currentRoleIds) =>
      currentRoleIds.includes(roleId)
        ? currentRoleIds.filter((entry) => entry !== roleId)
        : [...currentRoleIds, roleId]
    );
  }

  if (isLoading && !catalog) {
    return (
      <div className="space-y-6">
        <section className="glass-panel rounded-[2rem] p-8 lg:p-10">
          <Badge>Admin workspace</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold">Loading RBAC controls for your tenant.</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Roles, permissions, and user assignments are being loaded from the Phase 4 backend.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-6 p-8 lg:grid-cols-[1.4fr_1fr] lg:p-10">
          <div className="space-y-5">
            <Badge>Role governance</Badge>
            <div className="space-y-3">
              <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight">
                Manage tenant roles, permission bundles, and user assignments.
              </h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                Phase 4 turns the admin area into a working RBAC control plane with seeded role templates,
                permission assignment, API-backed role CRUD, and permission-aware frontend behavior.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                label: "Roles",
                value: String(roles.length),
                icon: ShieldCheck
              },
              {
                label: "Templates",
                value: String(roleTemplates.length),
                icon: WandSparkles
              },
              {
                label: "Users",
                value: String(users.length),
                icon: UserCog
              }
            ].map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-semibold">{stat.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create role</CardTitle>
            <CardDescription>
              Start from a template or create a tenant-specific role from scratch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleCreateRole}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="templateKey">
                  Role template
                </label>
                <select
                  id="templateKey"
                  className="flex h-12 w-full rounded-[1.25rem] border border-input bg-background px-4 text-sm shadow-sm"
                  value={createRoleForm.templateKey}
                  disabled={!canCreateRole || isSaving}
                  onChange={(event) => {
                    const nextTemplateKey = event.target.value;
                    const selectedTemplate = roleTemplates.find((template) => template.key === nextTemplateKey);

                    if (selectedTemplate) {
                      applyTemplateToCreateForm(selectedTemplate);
                      return;
                    }

                    setCreateRoleForm((currentValue) => ({
                      ...currentValue,
                      templateKey: nextTemplateKey
                    }));
                  }}
                >
                  <option value="">Custom role</option>
                  {roleTemplates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="createRoleName">
                  Role name
                </label>
                <Input
                  id="createRoleName"
                  disabled={!canCreateRole || isSaving}
                  value={createRoleForm.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setCreateRoleForm((currentValue) => ({
                      ...currentValue,
                      name: nextName,
                      slug:
                        currentValue.slug === "" || currentValue.slug === slugifyRoleName(currentValue.name)
                          ? slugifyRoleName(nextName)
                          : currentValue.slug
                    }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="createRoleSlug">
                  Role slug
                </label>
                <Input
                  id="createRoleSlug"
                  disabled={!canCreateRole || isSaving}
                  value={createRoleForm.slug}
                  onChange={(event) =>
                    setCreateRoleForm((currentValue) => ({
                      ...currentValue,
                      slug: slugifyRoleName(event.target.value)
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="createRoleDescription">
                  Description
                </label>
                <textarea
                  id="createRoleDescription"
                  className={textareaClassName}
                  disabled={!canCreateRole || isSaving}
                  value={createRoleForm.description}
                  onChange={(event) =>
                    setCreateRoleForm((currentValue) => ({
                      ...currentValue,
                      description: event.target.value
                    }))
                  }
                />
              </div>

              <Button className="w-full" type="submit" disabled={!canCreateRole || isSaving}>
                {isSaving ? "Saving role..." : "Create role"}
              </Button>
            </form>

            <div className="space-y-3">
              <p className="text-sm font-medium">Seeded templates</p>
              <div className="grid gap-3">
                {roleTemplates.slice(0, 6).map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4 text-left transition hover:border-primary/40 hover:bg-background"
                    onClick={() => applyTemplateToCreateForm(template)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{template.name}</p>
                      <Badge variant="muted">{template.permissions.length} permissions</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant roles</CardTitle>
            <CardDescription>
              Seeded defaults are editable, and custom roles can be added as the tenant evolves.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`rounded-[1.25rem] border p-5 text-left transition ${
                  role.id === selectedRole?.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/70 bg-background/70 hover:border-primary/35"
                }`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold">{role.name}</p>
                  {role.isSystemRole ? <Badge variant="success">system</Badge> : null}
                  {role.templateKey ? <Badge variant="muted">{role.templateKey}</Badge> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {role.description ?? "No description provided yet."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span>{role.permissionCodes.length} permissions</span>
                  <span>{role.userCount} users</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Role details</CardTitle>
            <CardDescription>
              Update names and slugs first, then save the permission bundle separately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedRole ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="roleDraftName">
                      Name
                    </label>
                    <Input
                      id="roleDraftName"
                      disabled={!canEditRole || isSaving}
                      value={roleDraft.name}
                      onChange={(event) =>
                        setRoleDraft((currentValue) => ({
                          ...currentValue,
                          name: event.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="roleDraftSlug">
                      Slug
                    </label>
                    <Input
                      id="roleDraftSlug"
                      disabled={!canEditRole || isSaving}
                      value={roleDraft.slug}
                      onChange={(event) =>
                        setRoleDraft((currentValue) => ({
                          ...currentValue,
                          slug: slugifyRoleName(event.target.value)
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="roleDraftDescription">
                    Description
                  </label>
                  <textarea
                    id="roleDraftDescription"
                    className={textareaClassName}
                    disabled={!canEditRole || isSaving}
                    value={roleDraft.description}
                    onChange={(event) =>
                      setRoleDraft((currentValue) => ({
                        ...currentValue,
                        description: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button disabled={!canEditRole || isSaving} onClick={() => void handleSaveRoleDetails()}>
                    Save role details
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canDeleteRole || isSaving || selectedRole.isSystemRole}
                    onClick={() => void handleDeleteRole()}
                  >
                    {selectedRole.isSystemRole ? "System role protected" : "Delete role"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a role to manage its metadata and permissions.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected role snapshot</CardTitle>
            <CardDescription>
              Quick context before you change access for users or modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRole ? (
              <>
                <div className="rounded-[1.25rem] bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Role</p>
                  <p className="mt-2 text-lg font-semibold">{selectedRole.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedRole.slug}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Permissions</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedRole.permissionCodes.length}</p>
                  </div>
                  <div className="rounded-[1.25rem] bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Assigned users</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedRole.userCount}</p>
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                  {selectedRole.isSystemRole
                    ? "This role is protected from deletion so the tenant keeps a stable administrative baseline."
                    : "This role can be tailored or retired as tenant operations change."}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No role selected.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Permission matrix</CardTitle>
          <CardDescription>
            Permission changes are grouped by module and action to mirror the RBAC catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedRole ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Editing permissions for <span className="font-medium text-foreground">{selectedRole.name}</span>
                </div>
                <Button disabled={!canAssignPermissions || isSaving} onClick={() => void handleSaveRolePermissions()}>
                  Save permissions
                </Button>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {permissionGroups.map((group) => (
                  <div key={group.module.key} className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold">{group.module.label}</p>
                      <Badge variant="muted">{group.permissions.length} actions</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.code}
                          className="flex cursor-pointer gap-3 rounded-[1rem] border border-transparent bg-background/70 p-3 transition hover:border-primary/25"
                        >
                          <input
                            className="mt-1 h-4 w-4 rounded border-input"
                            type="checkbox"
                            checked={editablePermissionCodes.includes(permission.code)}
                            disabled={!canAssignPermissions || isSaving}
                            onChange={() => togglePermissionCode(permission.code)}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{permission.actionLabel}</p>
                              <code className="rounded bg-secondary px-2 py-1 text-xs">{permission.code}</code>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{permission.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a role to edit its permission bundle.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User role assignment</CardTitle>
          <CardDescription>
            Assign roles to tenant users. The API blocks self-demotion from the active admin session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {users.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
                    entry.id === selectedUser?.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/70 bg-background/70 hover:border-primary/35"
                  }`}
                  onClick={() => setSelectedUserId(entry.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{entry.displayName}</p>
                    {entry.id === user?.id ? <Badge variant="success">current user</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.roles.map((role) => (
                      <Badge key={role.id} variant="muted">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
              {selectedUser ? (
                <div className="space-y-5">
                  <div>
                    <p className="font-display text-2xl font-semibold">{selectedUser.displayName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedUser.email}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedUser.teamName ?? "No team"} · {selectedUser.departmentName ?? "No department"}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex cursor-pointer gap-3 rounded-[1rem] border border-transparent bg-background p-4 transition hover:border-primary/25"
                      >
                        <input
                          className="mt-1 h-4 w-4 rounded border-input"
                          type="checkbox"
                          checked={editableUserRoleIds.includes(role.id)}
                          disabled={!canAssignPermissions || isSaving}
                          onChange={() => toggleUserRole(role.id)}
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{role.name}</p>
                            {role.isSystemRole ? <Badge variant="success">system</Badge> : null}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {role.description ?? "No description provided yet."}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <Button disabled={!canAssignPermissions || isSaving} onClick={() => void handleSaveUserRoles()}>
                    Save user roles
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a user to manage role assignments.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
