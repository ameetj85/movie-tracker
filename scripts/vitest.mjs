// Launches Vitest with a normalized working directory.
//
// On Windows the drive letter's case can differ between the shell's working
// directory ("c:\…", common in VS Code terminals) and Node's resolved module
// paths ("C:\…"). Vitest then loads two copies of itself and every test fails
// with "Vitest failed to find the current suite". Upper-casing the drive letter
// before Vitest starts avoids that. Elsewhere this is a no-op.
import path from "node:path";
import { pathToFileURL } from "node:url";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
process.chdir(cwd);
await import(pathToFileURL(path.join(cwd, "node_modules", "vitest", "vitest.mjs")).href);
