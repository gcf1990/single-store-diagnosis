import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const validationDir = dirname(fileURLToPath(import.meta.url));
const appDir = dirname(validationDir);

async function filesIn(dir, predicate) {
  return (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

const businessFiles = await filesIn(appDir, (name) => name.endsWith(".js"));
const validationFiles = await filesIn(validationDir, (name) => name.endsWith(".js") || name.endsWith(".mjs"));
const files = [...businessFiles, ...validationFiles];
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures.push({ file, stderr: result.stderr, stdout: result.stdout });
  }
}

if (failures.length) {
  failures.forEach((failure) => {
    console.error(`Syntax check failed: ${failure.file}`);
    if (failure.stdout) console.error(failure.stdout.trim());
    if (failure.stderr) console.error(failure.stderr.trim());
  });
  process.exit(1);
}

console.log(`Syntax check passed: ${files.length} files`);
