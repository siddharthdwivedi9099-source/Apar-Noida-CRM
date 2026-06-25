import { describe, expect, it } from "vitest";
import {
  CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
  canTransitionConfigurationVersion,
  configurationVersionStatuses,
  defaultTenantCoreSettings,
  defaultTenantThemeSettings,
  nextConfigurationVersionNumber,
  summarizeConfigurationSnapshot,
  type ConfigurationSnapshot
} from "@crm/types";

describe("configuration version lifecycle", () => {
  it("allows draft to be published or archived", () => {
    expect(canTransitionConfigurationVersion("draft", "published")).toBe(true);
    expect(canTransitionConfigurationVersion("draft", "archived")).toBe(true);
  });

  it("does not allow re-publishing or editing terminal states", () => {
    expect(canTransitionConfigurationVersion("published", "draft")).toBe(false);
    expect(canTransitionConfigurationVersion("published", "published")).toBe(false);
    expect(canTransitionConfigurationVersion("archived", "published")).toBe(false);
    expect(canTransitionConfigurationVersion("archived", "draft")).toBe(false);
  });

  it("allows a published version to be archived (superseded)", () => {
    expect(canTransitionConfigurationVersion("published", "archived")).toBe(true);
  });

  it("knows the full set of statuses", () => {
    expect([...configurationVersionStatuses]).toEqual(["draft", "published", "archived"]);
  });

  it("computes the next monotonic version number", () => {
    expect(nextConfigurationVersionNumber([])).toBe(1);
    expect(nextConfigurationVersionNumber([1, 2, 3])).toBe(4);
    expect(nextConfigurationVersionNumber([3, 1, 2])).toBe(4);
    expect(nextConfigurationVersionNumber([5])).toBe(6);
  });
});

describe("configuration snapshot summary", () => {
  it("counts modules, enabled modules, and config objects", () => {
    const snapshot: ConfigurationSnapshot = {
      schemaVersion: CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
      settings: defaultTenantCoreSettings,
      theme: defaultTenantThemeSettings,
      modules: [
        { moduleKey: "leads", label: "Leads", description: "", defaultEnabled: true, locked: false, enabled: true },
        { moduleKey: "social", label: "Social", description: "", defaultEnabled: true, locked: false, enabled: false }
      ],
      terminology: [],
      optionSets: [],
      customFields: [],
      formLayouts: []
    };
    const summary = summarizeConfigurationSnapshot(snapshot);
    expect(summary.moduleCount).toBe(2);
    expect(summary.enabledModuleCount).toBe(1);
    expect(summary.optionSetCount).toBe(0);
  });
});
