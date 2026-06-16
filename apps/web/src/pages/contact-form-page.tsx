import { useEffect, useState } from "react";
import type {
  ContactOptionsResponse,
  ContactResponse,
  CreateContactRequestBody,
  UpdateContactRequestBody
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { selectClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

interface ContactFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  roleKey: string;
  ownerId: string;
  accountId: string;
}

const defaultFormState: ContactFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  roleKey: "",
  ownerId: "",
  accountId: ""
};

export function ContactFormPage() {
  const { contactId } = useParams();
  const isEditMode = Boolean(contactId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const contactLabel = getModuleLabel("contacts", "singular");
  const [options, setOptions] = useState<ContactOptionsResponse | null>(null);
  const [formState, setFormState] = useState<ContactFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const optionsResponse = await apiRequest<ContactOptionsResponse>("/contacts/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        if (!isEditMode || !contactId) {
          setFormState((currentValue) => ({
            ...currentValue,
            roleKey: optionsResponse.roles.find((option) => option.isDefault)?.key ?? ""
          }));
          return;
        }

        const contactResponse = await apiRequest<ContactResponse>(`/contacts/${contactId}`, {
          method: "GET",
          accessToken
        });
        const { contact } = contactResponse;

        setFormState({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          linkedinUrl: contact.linkedinUrl ?? "",
          roleKey: contact.role?.key ?? "",
          ownerId: contact.owner?.id ?? "",
          accountId: contact.account?.id ?? ""
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, contactId, isEditMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      firstName: formState.firstName,
      lastName: formState.lastName,
      email: formState.email || null,
      phone: formState.phone || null,
      linkedinUrl: formState.linkedinUrl || null,
      roleKey: formState.roleKey || null,
      ownerId: formState.ownerId || null,
      accountId: formState.accountId || null
    } satisfies CreateContactRequestBody & UpdateContactRequestBody;

    try {
      const response = isEditMode && contactId
        ? await apiRequest<ContactResponse>(`/contacts/${contactId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<ContactResponse>("/contacts", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/contacts/${response.contact.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={isEditMode ? `Loading ${contactLabel.toLowerCase()} for editing` : `Preparing ${contactLabel.toLowerCase()} form`}
        description="The page is loading tenant-backed owners, roles, and account relationships."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow={isEditMode ? "Contact maintenance" : "Contact creation"}
        title={isEditMode ? `Update this ${contactLabel.toLowerCase()} while keeping account relationships and audit history intact.` : `Create a new ${contactLabel.toLowerCase()} with stakeholder role, owner, and account mapping from day one.`}
        summary="This form is the bridge between individual stakeholder records and the shared account context layer."
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && contactId ? `/contacts/${contactId}` : "/contacts"}>{isEditMode ? "Back to detail" : "Back to list"}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${contactLabel}` : `Create ${contactLabel}`}</CardTitle>
          <CardDescription>
            Establish the stakeholder profile, related account, and contact role that later workflows can build on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2">
              <span className="text-sm font-medium">First name</span>
              <Input
                required
                value={formState.firstName}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, firstName: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Last name</span>
              <Input
                required
                value={formState.lastName}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, lastName: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Email</span>
              <Input
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, email: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Phone</span>
              <Input
                value={formState.phone}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, phone: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">LinkedIn</span>
              <Input
                type="url"
                value={formState.linkedinUrl}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, linkedinUrl: event.target.value }))}
                placeholder="https://linkedin.com/in/example"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Contact role</span>
              <select
                className={selectClassName}
                value={formState.roleKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, roleKey: event.target.value }))}
              >
                <option value="">No role yet</option>
                {options?.roles.map((role) => (
                  <option key={role.id} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Owner</span>
              <select
                className={selectClassName}
                value={formState.ownerId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, ownerId: event.target.value }))}
              >
                <option value="">Unassigned</option>
                {options?.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Related account</span>
              <select
                className={selectClassName}
                value={formState.accountId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, accountId: event.target.value }))}
              >
                <option value="">No account yet</option>
                {options?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? `Save ${contactLabel}` : `Create ${contactLabel}`}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
