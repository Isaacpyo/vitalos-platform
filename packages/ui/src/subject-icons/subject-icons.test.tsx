import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { iconNames } from "../primitives/Icon";
import { SubjectIcon, SubjectIconTile, subjectIconNames } from "./index";

describe("subject icons", () => {
  it("are drawn apart from the core set, so client islands never ship them", () => {
    const core = new Set<string>(iconNames);
    expect(subjectIconNames.filter((name) => core.has(name))).toEqual([]);
  });

  it("draw every subject glyph on the core frame, decorative by default", () => {
    for (const name of subjectIconNames) {
      const { container, unmount } = render(<SubjectIcon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden"), name).toBe("true");
      expect(svg?.getAttribute("stroke-width"), name).toBe("1.5");
      expect(svg?.children.length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it("fall back to the core set and sit on the shared tile", () => {
    const { container } = render(<SubjectIconTile name="check" size="sm" />);
    expect(container.querySelector("span[aria-hidden='true'] svg")).not.toBeNull();
  });
});
