import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

//
// One-time mechanical port of docs/parmana-handbook/*.md into
// docs/site/handbook/*.mdx (Mintlify pages), so the book is
// discoverable from the docs site nav, not just as loose repo files.
// Purely mechanical: extracts the existing H1 as the page title, adds
// required Mintlify frontmatter, leaves body content untouched.
//

const sourceDir = path.resolve(process.cwd(), "docs/parmana-handbook");
const targetDir = path.resolve(process.cwd(), "docs/site/handbook");

const files = readdirSync(sourceDir)
  .filter((f) => /^\d{2}-.*\.md$/.test(f))
  .sort();

for (const file of files) {
  const raw = readFileSync(path.join(sourceDir, file), "utf8");
  const lines = raw.split("\n");

  const h1Index = lines.findIndex((l) => l.startsWith("# "));
  const title = h1Index >= 0 ? lines[h1Index].slice(2).trim() : file;

  // First real paragraph under "## What it is" (every chapter starts
  // with that section), as a one-line description.
  let description = "";
  const whatItIsIndex = lines.findIndex((l) =>
    l.trim().toLowerCase().startsWith("## what it is"),
  );
  if (whatItIsIndex >= 0) {
    for (let i = whatItIsIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("## ")) break;
      if (line.length > 0) {
        description = line.replace(/`/g, "").replace(/\*\*/g, "").slice(0, 300);
        break;
      }
    }
  }

  // Body: everything after the H1 line (Mintlify renders the title
  // from frontmatter, so the in-body H1 would be a visible duplicate).
  const body = lines
    .slice(h1Index + 1)
    .join("\n")
    .replace(/^\n+/, "");

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    "---",
    "",
  ].join("\n");

  const outName = file.replace(/\.md$/, ".mdx");
  writeFileSync(path.join(targetDir, outName), frontmatter + body, "utf8");
  console.log(`  ${file} -> handbook/${outName} ("${title}")`);
}

console.log(`\nPorted ${files.length} chapters to docs/site/handbook/.`);
