import { Mail, Phone } from "lucide-react";
import { buildClickToCallHref, defaultTenantTelephonySettings } from "@crm/types";
import { cn } from "@/lib/utils";
import { useTenantConfig } from "@/providers/tenant-config-provider";

const linkClassName =
  "inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline";

/**
 * Click-to-call: renders a phone number as a dial link using the tenant's
 * configurable telephony settings (tel/callto/sip or a custom dialer URL).
 * Falls back to plain text when click-to-call is disabled for the tenant.
 */
export function PhoneLink({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const { settings } = useTenantConfig();

  if (!phone) {
    return null;
  }

  // Fall back to defaults when the provider serves a pre-telephony settings shape.
  const href = buildClickToCallHref(phone, settings.telephony ?? defaultTenantTelephonySettings);

  if (!href) {
    return <span className={className}>{phone}</span>;
  }

  return (
    <a href={href} title={`Call ${phone}`} onClick={(event) => event.stopPropagation()} className={cn(linkClassName, className)}>
      <Phone className="h-3.5 w-3.5" />
      {phone}
    </a>
  );
}

/** Renders an email address as a mailto: link so the user's configured mail client (Outlook, Gmail, …) opens. */
export function EmailLink({ email, className }: { email: string | null | undefined; className?: string }) {
  if (!email) {
    return null;
  }

  return (
    <a
      href={`mailto:${email}`}
      title={`Email ${email}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(linkClassName, className)}
    >
      <Mail className="h-3.5 w-3.5" />
      {email}
    </a>
  );
}
