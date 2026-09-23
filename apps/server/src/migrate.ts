import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "./db";

// Minimal, dependency-free migration runner: applies every .sql file in
// migrations/ in filename order, inside its own transaction. Good enough
// for this project; swap for a real migration tool (drizzle-kit, umzug,
// node-pg-migrate) on a bigger codebase.
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

async function main() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const path = join(migrationsDir, file);
    const contents = readFileSync(path, "utf-8");
    console.log(`Applying ${file}...`);
    await sql.unsafe(contents);
  }

  console.log(`Applied ${files.length} migration file(s).`);
  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
