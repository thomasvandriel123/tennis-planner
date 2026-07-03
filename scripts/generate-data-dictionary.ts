/**
 * Renders prisma/schema.prisma's `///` doc comments into docs/data-dictionary.md.
 *
 * The schema is the single source of truth for what each model/field means
 * (see the header comment in schema.prisma); this script just makes that
 * documentation readable without opening the schema file. Run via
 * `npm run dictionary`, and re-run whenever the schema changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.join(process.cwd(), "prisma/schema.prisma");
const OUTPUT_PATH = path.join(process.cwd(), "docs/data-dictionary.md");

interface DocField {
  name: string;
  type: string;
  doc: string;
}

interface DocBlock {
  kind: "model" | "enum";
  name: string;
  doc: string;
  fields: DocField[];
}

export function parseSchema(source: string): DocBlock[] {
  const lines = source.split("\n");
  const blocks: DocBlock[] = [];

  let pendingBlockDoc: string[] = [];
  let pendingFieldDoc: string[] = [];
  let current: DocBlock | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("///")) {
      const text = line.slice(3).trim();
      if (current) pendingFieldDoc.push(text);
      else pendingBlockDoc.push(text);
      continue;
    }

    const blockStart = line.match(/^(model|enum)\s+(\w+)\s*\{$/);
    if (blockStart) {
      current = {
        kind: blockStart[1] as "model" | "enum",
        name: blockStart[2],
        doc: pendingBlockDoc.join(" "),
        fields: [],
      };
      pendingBlockDoc = [];
      continue;
    }

    if (current && line === "}") {
      blocks.push(current);
      current = null;
      pendingFieldDoc = [];
      continue;
    }

    if (!current) continue; // outside any block (generator/datasource config, blank lines, plain comments)

    if (line === "" || line.startsWith("//") || line.startsWith("@@")) {
      // Blank lines and block-level attributes (@@unique, @@index, ...)
      // don't describe a single field, so they don't consume pendingFieldDoc.
      continue;
    }

    if (current.kind === "enum") {
      const name = line.split(/\s+/)[0];
      current.fields.push({ name, type: "", doc: pendingFieldDoc.join(" ") });
      pendingFieldDoc = [];
      continue;
    }

    // model field line, e.g. `phone String? // trailing comment`
    const fieldMatch = line.match(/^(\w+)\s+([^\s]+(?:\s*\[\])?)/);
    if (fieldMatch) {
      current.fields.push({
        name: fieldMatch[1],
        type: fieldMatch[2],
        doc: pendingFieldDoc.join(" "),
      });
      pendingFieldDoc = [];
    }
  }

  return blocks;
}

export function renderMarkdown(blocks: DocBlock[]): string {
  const models = blocks.filter((b) => b.kind === "model");
  const enums = blocks.filter((b) => b.kind === "enum");

  const lines: string[] = [
    "# Data Dictionary",
    "",
    "Generated from `prisma/schema.prisma` by `npm run dictionary`. Do not",
    "edit this file directly — edit the doc comments in the schema instead",
    "and regenerate.",
    "",
    "## Models",
    "",
  ];

  for (const model of models) {
    lines.push(`### ${model.name}`, "");
    if (model.doc) lines.push(model.doc, "");
    lines.push("| Field | Type | Description |", "|---|---|---|");
    for (const field of model.fields) {
      lines.push(`| ${field.name} | \`${field.type}\` | ${field.doc || "—"} |`);
    }
    lines.push("");
  }

  lines.push("## Enums", "");
  for (const e of enums) {
    lines.push(`### ${e.name}`, "");
    if (e.doc) lines.push(e.doc, "");
    lines.push("| Value | Description |", "|---|---|");
    for (const field of e.fields) {
      lines.push(`| ${field.name} | ${field.doc || "—"} |`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

// Only run when executed directly (`npm run dictionary`), not when the
// pure functions above are imported into a test.
if (import.meta.url === `file://${process.argv[1]}`) {
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  const blocks = parseSchema(schema);
  writeFileSync(OUTPUT_PATH, renderMarkdown(blocks));
  console.log(`Wrote ${blocks.length} model/enum definitions to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}
