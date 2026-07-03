import { describe, expect, it } from "vitest";
import { parseSchema, renderMarkdown } from "./generate-data-dictionary";

const SAMPLE_SCHEMA = `
generator client {
  provider = "prisma-client"
}

/// A club member.
model User {
  id   String @id @default(cuid())
  /// Full display name.
  name String

  @@index([name])
}

/// A day of the week.
enum Weekday {
  /// The first day of the working week.
  MONDAY
  TUESDAY
}
`;

describe("parseSchema", () => {
  it("extracts models with field docs and skips block-level attributes", () => {
    const blocks = parseSchema(SAMPLE_SCHEMA);
    const user = blocks.find((b) => b.name === "User");

    expect(user?.kind).toBe("model");
    expect(user?.doc).toBe("A club member.");
    expect(user?.fields).toEqual([
      { name: "id", type: "String", doc: "" },
      { name: "name", type: "String", doc: "Full display name." },
    ]);
  });

  it("extracts enum values and their docs", () => {
    const blocks = parseSchema(SAMPLE_SCHEMA);
    const weekday = blocks.find((b) => b.name === "Weekday");

    expect(weekday?.kind).toBe("enum");
    expect(weekday?.fields).toEqual([
      { name: "MONDAY", type: "", doc: "The first day of the working week." },
      { name: "TUESDAY", type: "", doc: "" },
    ]);
  });
});

describe("renderMarkdown", () => {
  it("renders a table per block with a placeholder for missing docs", () => {
    const markdown = renderMarkdown(parseSchema(SAMPLE_SCHEMA));

    expect(markdown).toContain("### User");
    expect(markdown).toContain("| name | `String` | Full display name. |");
    expect(markdown).toContain("| id | `String` | — |");
    expect(markdown).toContain("### Weekday");
  });
});
