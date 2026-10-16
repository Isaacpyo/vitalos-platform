import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import { generateContentTypes, generatedUrl } from "../../../scripts/content-types.mjs";
import type { components, operations } from "./generated/openapi";
import * as schemas from "./schemas";
import { contractSchemas } from "./schemas";
import type { ContractSchemaName } from "./schemas";

const fixturesDir = new URL("../../../../../contracts/content-api/v1/fixtures/", import.meta.url);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, fixturesDir), "utf8"));
const index = fixture("index") as { fixtures: Record<string, string> };

describe("contract fixtures", () => {
  const entries = Object.entries(index.fixtures);

  it("lists every fixture file and names only known schemas", () => {
    expect(entries.length).toBeGreaterThanOrEqual(27);
    for (const [, schemaName] of entries) {
      expect(Object.keys(contractSchemas), schemaName).toContain(schemaName);
    }
  });

  it.each(entries)("%s parses as %s", (name, schemaName) => {
    const schema = contractSchemas[schemaName as ContractSchemaName];
    const result = schema.safeParse(fixture(name));
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
  });

  it("fixture content is obviously fictional", () => {
    for (const [name] of entries) {
      const json = JSON.stringify(fixture(name));
      expect(json, name).not.toMatch(/@vitalos\.co\.uk/);
    }
  });
});

describe("mutated fixtures fail", () => {
  const clone = <T>(value: T): T => structuredClone(value);
  const cases: [string, keyof typeof contractSchemas, (value: Record<string, unknown>) => void][] =
    [
      ["unknown key on a post", "PostDetail", (v) => (v["draftNotes"] = "internal")],
      [
        "unknown key in a nested author",
        "PostDetail",
        (v) => {
          ((v["authors"] as Record<string, unknown>[])[0] as Record<string, unknown>)["email"] =
            "someone@example.test";
        },
      ],
      ["uppercase slug", "PostDetail", (v) => (v["slug"] = "Example-Post")],
      [
        "javascript: cover url",
        "PostDetail",
        (v) => {
          (v["cover"] as Record<string, unknown>)["url"] = "javascript:alert(1)";
        },
      ],
      ["missing required body", "PostDetail", (v) => delete v["bodyMarkdown"]],
      ["string boolean", "SiteState", (v) => (v["insightsOpen"] = "yes")],
      ["bad date", "SiteState", (v) => (v["nextDueAt"] = "tomorrow")],
      ["bad tag", "RevalidateRequest", (v) => (v["tags"] = ["Insights"])],
      ["empty tags", "RevalidateRequest", (v) => (v["tags"] = [])],
      ["unknown kind", "RevalidateRequest", (v) => (v["kind"] = "purge")],
      ["closed state on an open role", "RoleDetail", (v) => (v["state"] = "closed")],
      ["unknown render context", "RenderRequest", (v) => (v["context"] = "email")],
      ["page size other than 12", "PostPage", (v) => (v["pageSize"] = 20)],
      ["consent false", "ApplicationRequest", (v) => (v["consent"] = false)],
    ];
  const fixtureFor: Record<string, string> = {
    PostDetail: "post-detail",
    SiteState: "site-state",
    RevalidateRequest: "revalidate-request",
    RoleDetail: "role-open",
    RenderRequest: "render-request",
    PostPage: "post-page",
    ApplicationRequest: "application-request",
  };

  it.each(cases)("%s", (_label, schemaName, mutate) => {
    const value = clone(fixture(fixtureFor[schemaName] as string)) as Record<string, unknown>;
    mutate(value);
    expect(contractSchemas[schemaName].safeParse(value).success).toBe(false);
  });

  it("the union responses keep their branches apart", () => {
    expect(schemas.PostResponse.parse(fixture("redirect"))).toEqual({ redirect: "example-post-1" });
    expect(schemas.RoleResponse.parse(fixture("role-closed"))).toMatchObject({ state: "closed" });
    expect(schemas.RoleResponse.parse(fixture("role-open"))).toMatchObject({ state: "open" });
    expect(
      schemas.PostResponse.safeParse({ ...(fixture("redirect") as object), title: "x" }).success,
    ).toBe(false);
  });
});

describe("generated types", () => {
  it("are up to date with the contract (drift check)", async () => {
    const committed = readFileSync(generatedUrl, "utf8").replace(/\r\n/g, "\n");
    expect(committed === (await generateContentTypes()), "run `pnpm content:types`").toBe(true);
  }, 30_000);

  it("agree with the zod schemas", () => {
    // Flattens `allOf` intersections (`A & B`) into one object type, recursively, keeping
    // optional modifiers, so structural equality can be asserted on both sides.
    type Flat<T> = T extends readonly unknown[]
      ? { [K in keyof T]: Flat<T[K]> }
      : T extends object
        ? { [K in keyof T]: Flat<T[K]> }
        : T;
    type S = { [K in keyof components["schemas"]]: Flat<components["schemas"][K]> };
    type Out<T extends z.ZodType> = Flat<z.output<T>>;
    type Json<O extends keyof operations> = Flat<
      operations[O]["responses"] extends { 200: { content: { "application/json": infer R } } }
        ? R
        : never
    >;

    expectTypeOf<Out<typeof schemas.Choice>>().toEqualTypeOf<S["Choice"]>();
    expectTypeOf<Out<typeof schemas.FormatChoice>>().toEqualTypeOf<S["FormatChoice"]>();
    expectTypeOf<Out<typeof schemas.PracticeChoice>>().toEqualTypeOf<S["PracticeChoice"]>();
    expectTypeOf<Out<typeof schemas.DateValue>>().toEqualTypeOf<S["DateValue"]>();
    expectTypeOf<Out<typeof schemas.Image>>().toEqualTypeOf<S["Image"]>();
    expectTypeOf<Out<typeof schemas.AuthorRef>>().toEqualTypeOf<S["AuthorRef"]>();
    expectTypeOf<Out<typeof schemas.AuthorDetail>>().toEqualTypeOf<S["AuthorDetail"]>();
    expectTypeOf<Out<typeof schemas.TopicRef>>().toEqualTypeOf<S["TopicRef"]>();
    expectTypeOf<Out<typeof schemas.TopicDetail>>().toEqualTypeOf<S["TopicDetail"]>();
    expectTypeOf<Out<typeof schemas.PostSummary>>().toEqualTypeOf<S["PostSummary"]>();
    expectTypeOf<Out<typeof schemas.PostDetail>>().toEqualTypeOf<S["PostDetail"]>();
    expectTypeOf<Out<typeof schemas.PostPage>>().toEqualTypeOf<S["PostPage"]>();
    expectTypeOf<Out<typeof schemas.Redirect>>().toEqualTypeOf<S["Redirect"]>();
    expectTypeOf<Out<typeof schemas.InsightsCopy>>().toEqualTypeOf<S["InsightsCopy"]>();
    expectTypeOf<Out<typeof schemas.SalaryValue>>().toEqualTypeOf<S["SalaryValue"]>();
    expectTypeOf<Out<typeof schemas.RoleSummary>>().toEqualTypeOf<S["RoleSummary"]>();
    expectTypeOf<Out<typeof schemas.RoleDetail>>().toEqualTypeOf<S["RoleDetail"]>();
    expectTypeOf<Out<typeof schemas.ClosedRole>>().toEqualTypeOf<S["ClosedRole"]>();
    expectTypeOf<Out<typeof schemas.CareersCopy>>().toEqualTypeOf<S["CareersCopy"]>();
    expectTypeOf<Out<typeof schemas.CareersPage>>().toEqualTypeOf<S["CareersPage"]>();
    expectTypeOf<Out<typeof schemas.HomeInsights>>().toEqualTypeOf<S["HomeInsights"]>();
    expectTypeOf<Out<typeof schemas.HomeCareers>>().toEqualTypeOf<S["HomeCareers"]>();
    expectTypeOf<Out<typeof schemas.Home>>().toEqualTypeOf<S["Home"]>();
    expectTypeOf<Out<typeof schemas.SiteState>>().toEqualTypeOf<S["SiteState"]>();
    expectTypeOf<Out<typeof schemas.Sitemap>>().toEqualTypeOf<S["Sitemap"]>();
    expectTypeOf<Out<typeof schemas.Preview>>().toEqualTypeOf<S["Preview"]>();
    expectTypeOf<Out<typeof schemas.RevalidateRequest>>().toEqualTypeOf<S["RevalidateRequest"]>();
    expectTypeOf<Out<typeof schemas.RevalidateResponse>>().toEqualTypeOf<S["RevalidateResponse"]>();
    expectTypeOf<Out<typeof schemas.RenderRequest>>().toEqualTypeOf<S["RenderRequest"]>();
    expectTypeOf<Out<typeof schemas.RenderWarning>>().toEqualTypeOf<S["RenderWarning"]>();
    expectTypeOf<Out<typeof schemas.RenderResponse>>().toEqualTypeOf<S["RenderResponse"]>();
    expectTypeOf<Out<typeof schemas.UploadTicketRequest>>().toEqualTypeOf<
      S["UploadTicketRequest"]
    >();
    expectTypeOf<Out<typeof schemas.UploadTicket>>().toEqualTypeOf<S["UploadTicket"]>();
    expectTypeOf<Out<typeof schemas.ApplicationRequest>>().toEqualTypeOf<S["ApplicationRequest"]>();
    expectTypeOf<Out<typeof schemas.ApplicationAccepted>>().toEqualTypeOf<
      S["ApplicationAccepted"]
    >();
    expectTypeOf<Out<typeof schemas.ApplicationErrors>>().toEqualTypeOf<S["ApplicationErrors"]>();
    expectTypeOf<Out<typeof schemas.ErrorBody>>().toEqualTypeOf<S["Error"]>();

    expectTypeOf<Out<typeof schemas.AuthorOrRedirect>>().toEqualTypeOf<Json<"getAuthor">>();
    expectTypeOf<Out<typeof schemas.TopicsResponse>>().toEqualTypeOf<Json<"listTopics">>();
    expectTypeOf<Out<typeof schemas.TopicResponse>>().toEqualTypeOf<Json<"getTopic">>();
    expectTypeOf<Out<typeof schemas.FeedResponse>>().toEqualTypeOf<Json<"getFeed">>();
    expectTypeOf<Out<typeof schemas.TickResponse>>().toEqualTypeOf<Json<"tick">>();
    expectTypeOf<Out<typeof schemas.HealthResponse>>().toEqualTypeOf<Json<"getHealth">>();
    expectTypeOf<Out<typeof schemas.PostResponse>>().toEqualTypeOf<Json<"getPost">>();
    expectTypeOf<Out<typeof schemas.RoleResponse>>().toEqualTypeOf<Json<"getRole">>();
    expect(true).toBe(true);
  });
});
