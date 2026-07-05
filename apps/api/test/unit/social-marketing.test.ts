import { describe, expect, it } from "vitest";
import {
  campaignOutcomes,
  defaultCampaignApprovalPolicy,
  isCampaignApprovalRequired,
  mapSocialChannelToLeadSource,
  socialInteractionTypes
} from "@crm/types";

describe("mapSocialChannelToLeadSource (SM-002)", () => {
  const sourceKeys = ["website", "campaign", "linkedin", "instagram", "social_other"];

  it("marks the lead source as the post's social channel when configured", () => {
    expect(mapSocialChannelToLeadSource("linkedin", sourceKeys)).toBe("linkedin");
    expect(mapSocialChannelToLeadSource("instagram", sourceKeys)).toBe("instagram");
  });

  it("falls back to the configurable social_other source for unmapped channels", () => {
    expect(mapSocialChannelToLeadSource("tiktok", sourceKeys)).toBe("social_other");
    expect(mapSocialChannelToLeadSource(null, sourceKeys)).toBe("social_other");
  });

  it("falls back to website when even social_other is not configured", () => {
    expect(mapSocialChannelToLeadSource("tiktok", ["website", "campaign"])).toBe("website");
  });

  it("exposes the supported interaction types", () => {
    expect(socialInteractionTypes).toEqual(["comment", "dm", "mention", "social_form"]);
  });
});

describe("isCampaignApprovalRequired (CM-004)", () => {
  it("requires approval at or above the configured budget threshold", () => {
    const policy = { budgetThreshold: 50000, requiredForTypeKeys: [] };
    expect(isCampaignApprovalRequired(50000, "email", policy)).toBe(true);
    expect(isCampaignApprovalRequired(49999, "email", policy)).toBe(false);
  });

  it("always requires approval for configured campaign types regardless of budget", () => {
    const policy = { budgetThreshold: 50000, requiredForTypeKeys: ["event"] };
    expect(isCampaignApprovalRequired(0, "event", policy)).toBe(true);
    expect(isCampaignApprovalRequired(null, "event", policy)).toBe(true);
  });

  it("never requires approval when the threshold is disabled (0) and the type is not listed", () => {
    const policy = { budgetThreshold: 0, requiredForTypeKeys: [] };
    expect(isCampaignApprovalRequired(10_000_000, "email", policy)).toBe(false);
  });

  it("ships a sane default policy", () => {
    expect(defaultCampaignApprovalPolicy.budgetThreshold).toBeGreaterThan(0);
    expect(isCampaignApprovalRequired(defaultCampaignApprovalPolicy.budgetThreshold, null, defaultCampaignApprovalPolicy)).toBe(true);
  });
});

describe("campaign closure (CM-005)", () => {
  it("supports the three closure outcomes", () => {
    expect(campaignOutcomes).toEqual(["successful", "partially_successful", "unsuccessful"]);
  });
});
