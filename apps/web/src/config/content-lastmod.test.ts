import { describe, expect, it } from "vitest";
import { CONTENT_PATHS, resolveContentLastModified } from "./content-lastmod";
import type { GitRunner } from "./content-lastmod";

/** A fake git that answers by the first argument. */
const fakeGit =
  (answers: Record<string, string | Error>): GitRunner =>
  (args) => {
    const key = args[0] === "log" && args.includes("--reverse") ? "oldest" : args[0]!;
    const answer = answers[key];
    if (answer instanceof Error) throw answer;
    return answer ?? "";
  };

describe("resolveContentLastModified (sitemap lastmod, C7)", () => {
  it("uses the newest commit that touched the repo page copy", () => {
    const calls: (readonly string[])[] = [];
    const git: GitRunner = (args) => {
      calls.push(args);
      return "2026-10-16T19:04:05+01:00\n";
    };
    expect(resolveContentLastModified(git)).toBe("2026-10-16T18:04:05.000Z");
    expect(calls[0]).toEqual(["log", "-1", "--format=%cI", "--", ...CONTENT_PATHS]);
  });

  it("falls back to the oldest commit of a shallow clone (Vercel) when the commit is missing", () => {
    const git = fakeGit({
      log: "",
      "rev-parse": "true\n",
      oldest: "2026-10-12T08:00:00Z\n2026-10-13T08:00:00Z\n",
    });
    expect(resolveContentLastModified(git)).toBe("2026-10-12T08:00:00.000Z");
  });

  it("leaves the date out in a full clone that never touched the copy, or without git", () => {
    expect(resolveContentLastModified(fakeGit({ log: "", "rev-parse": "false" }))).toBeUndefined();
    expect(resolveContentLastModified(fakeGit({ log: new Error("git: not found") }))).toBeUndefined();
    expect(resolveContentLastModified(fakeGit({ log: "not a date" , "rev-parse": "false"}))).toBeUndefined();
  });
});
