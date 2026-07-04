import { describe, expect, it } from "vitest";
import { resolveCommissionStatus } from "@crm/types";

describe("resolveCommissionStatus", () => {
  it("is pending before approval", () => {
    expect(resolveCommissionStatus("registered", false)).toMatchObject({ status: "pending", eligible: false, closed: false });
    expect(resolveCommissionStatus("in_progress", false).status).toBe("pending");
  });

  it("is eligible once the deal is approved", () => {
    expect(resolveCommissionStatus("approved", false)).toMatchObject({ status: "eligible", eligible: true, closed: false });
  });

  it("shows payout status after closure, gated by finance approval", () => {
    expect(resolveCommissionStatus("won", false)).toMatchObject({ status: "payout_pending", closed: true });
    expect(resolveCommissionStatus("won", true)).toMatchObject({ status: "payout_approved", eligible: true, closed: true });
  });

  it("is not eligible when rejected or lost", () => {
    expect(resolveCommissionStatus("rejected", false).status).toBe("not_eligible");
    expect(resolveCommissionStatus("lost", true).status).toBe("not_eligible");
  });
});
