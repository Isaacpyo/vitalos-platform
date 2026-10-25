import { describe, expect, it } from "vitest";
import { enquiryDetailsFor, preselectedNeeds } from "./healthcare";

describe("Health & Care enquiries (Website Build Pack, 25 Oct 2026)", () => {
  it("preselects the first three needs for an audit and Design partner for a partner", () => {
    expect(preselectedNeeds("healthcare-audit")).toEqual([
      "inbox-and-referrals",
      "letters",
      "coding-and-billing",
    ]);
    expect(preselectedNeeds("healthcare-partner")).toEqual(["design-partner"]);
  });

  it("preselects the offer's own need when the enquiry comes from a Health & Care offer", () => {
    expect(preselectedNeeds("healthcare-audit", "nhs-assurance-readiness")).toEqual([
      "nhs-assurance",
    ]);
    expect(preselectedNeeds("healthcare-audit", "medical-logistics-digitisation")).toEqual([
      "medical-logistics",
    ]);
    expect(preselectedNeeds("healthcare-audit", "clinic-admin-audit")).toHaveLength(3);
  });

  it("tags every healthcare enquiry on the server, and nothing else", () => {
    expect(enquiryDetailsFor({ intent: "healthcare-partner" })).toEqual({ tags: ["healthcare"] });
    expect(enquiryDetailsFor({ intent: "healthcare-audit", healthcare: { sites: 2 } })).toEqual({
      tags: ["healthcare"],
      healthcare: { sites: 2 },
    });
    expect(enquiryDetailsFor({ intent: "project", healthcare: { sites: 2 } })).toEqual({});
  });
});
