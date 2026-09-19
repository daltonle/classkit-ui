import { describe, expect, it } from "vitest";

import { parseEnvironment } from "@/shared/lib/environment";

describe("parseEnvironment", () => {
  it("accepts a configured Google client ID", () => {
    expect(
      parseEnvironment({
        VITE_GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
      }),
    ).toEqual({ VITE_GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com" });
  });

  it.each([{}, { VITE_GOOGLE_CLIENT_ID: "" }, { VITE_GOOGLE_CLIENT_ID: "  " }])(
    "rejects missing or blank configuration",
    (values) => {
      expect(() => parseEnvironment(values)).toThrow(
        "Classkit is missing required configuration",
      );
    },
  );
});
