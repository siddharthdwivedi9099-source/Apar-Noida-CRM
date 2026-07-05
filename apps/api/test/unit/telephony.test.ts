import { describe, expect, it } from "vitest";
import { buildClickToCallHref, defaultTenantTelephonySettings, type TenantTelephonySettings } from "@crm/types";

const enabled = (overrides: Partial<TenantTelephonySettings> = {}): TenantTelephonySettings => ({
  ...defaultTenantTelephonySettings,
  ...overrides
});

describe("buildClickToCallHref (configurable click-to-call)", () => {
  it("builds a tel: href from a user-entered number with formatting characters", () => {
    expect(buildClickToCallHref("+91 (120) 456-7890", enabled())).toBe("tel:+911204567890");
  });

  it("supports callto and sip protocols for softphone/IVR bridges", () => {
    expect(buildClickToCallHref("1204567890", enabled({ protocol: "callto" }))).toBe("callto:1204567890");
    expect(buildClickToCallHref("1204567890", enabled({ protocol: "sip" }))).toBe("sip:1204567890");
  });

  it("substitutes the sanitized number into a custom dialer URL template", () => {
    const telephony = enabled({
      protocol: "custom",
      customUrlTemplate: "https://dialer.example.com/call?to={number}"
    });

    expect(buildClickToCallHref("+91 120-456", telephony)).toBe("https://dialer.example.com/call?to=%2B91120456");
  });

  it("returns null for a custom protocol without a usable template", () => {
    expect(buildClickToCallHref("1204567890", enabled({ protocol: "custom", customUrlTemplate: null }))).toBeNull();
    expect(
      buildClickToCallHref("1204567890", enabled({ protocol: "custom", customUrlTemplate: "https://dialer.example.com" }))
    ).toBeNull();
  });

  it("returns null when click-to-call is disabled for the tenant", () => {
    expect(buildClickToCallHref("1204567890", enabled({ clickToCallEnabled: false }))).toBeNull();
  });

  it("returns null for missing or non-dialable input", () => {
    expect(buildClickToCallHref(null, enabled())).toBeNull();
    expect(buildClickToCallHref("   ", enabled())).toBeNull();
    expect(buildClickToCallHref("call me", enabled())).toBeNull();
  });
});
