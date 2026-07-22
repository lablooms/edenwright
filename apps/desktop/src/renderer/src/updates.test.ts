import { describe, expect, it } from "vitest";

import { isNewer } from "./updates";

describe("isNewer (update check, notify-only)", () => {
  it("orders releases against the running version", () => {
    expect(isNewer("v0.2.0", "0.1.0-beta")).toBe(true);
    expect(isNewer("0.1.0", "0.1.0-beta")).toBe(true); // release > pre-release
    expect(isNewer("v0.1.0-beta", "0.1.0-beta")).toBe(false);
    expect(isNewer("0.1.0-beta", "0.1.0")).toBe(false);
    expect(isNewer("1.10.0", "1.2.0")).toBe(true);
    expect(isNewer("0.1.0-rc.1", "0.1.0-beta")).toBe(true);
  });
});
