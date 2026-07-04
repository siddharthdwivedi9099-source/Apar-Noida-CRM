import { describe, expect, it } from "vitest";
import {
  notificationRuleCatalog,
  findNotificationRule,
  notificationRuleForEvent,
  defaultNotificationRuleConfigurationDefinitions,
  notificationTypes,
  notificationChannels,
  notificationFrequencies
} from "@crm/types";

describe("Section 14: required notifications catalogue", () => {
  it("defines all 30 required notifications with unique keys and events", () => {
    expect(notificationRuleCatalog.length).toBe(30);
    const keys = notificationRuleCatalog.map((r) => r.key);
    const events = notificationRuleCatalog.map((r) => r.event);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(events).size).toBe(events.length);
  });

  it("maps every rule to a valid notification type, channel and frequency", () => {
    for (const r of notificationRuleCatalog) {
      expect(notificationTypes as readonly string[]).toContain(r.notificationType);
      expect(notificationChannels as readonly string[]).toContain(r.channel);
      expect(notificationFrequencies as readonly string[]).toContain(r.frequency);
      expect(["info", "warning", "critical"]).toContain(r.severity);
      expect(["service", "workflow", "policy"]).toContain(r.emission);
      expect(r.emittedBy.trim().length).toBeGreaterThan(0);
    }
  });

  it("looks rules up by key and event", () => {
    expect(findNotificationRule("ticket_closed")?.notificationType).toBe("record_assignment");
    expect(findNotificationRule("nope")).toBeUndefined();
    expect(notificationRuleForEvent("partner.conflict_detected")?.key).toBe("partner_conflict_detected");
  });

  it("emits the majority today (service + workflow) and honestly marks the rest policy", () => {
    const service = notificationRuleCatalog.filter((r) => r.emission === "service").length;
    const workflow = notificationRuleCatalog.filter((r) => r.emission === "workflow").length;
    const policy = notificationRuleCatalog.filter((r) => r.emission === "policy").length;
    expect(service + workflow + policy).toBe(30);
    // At least two-thirds are actually emitted today; none is left undocumented.
    expect(service + workflow).toBeGreaterThanOrEqual(20);
    expect(policy).toBeGreaterThan(0);
  });

  it("seeds 30 governed notification_rule configuration definitions", () => {
    expect(defaultNotificationRuleConfigurationDefinitions.length).toBe(30);
    for (const def of defaultNotificationRuleConfigurationDefinitions) {
      expect(def.definitionType).toBe("notification_rule");
      for (const key of ["event", "audience", "channel", "template", "frequency"]) {
        expect(def.definition[key]).toBeDefined();
      }
      expect(notificationChannels as readonly string[]).toContain(def.definition.channel);
      expect(notificationFrequencies as readonly string[]).toContain(def.definition.frequency);
    }
  });
});
