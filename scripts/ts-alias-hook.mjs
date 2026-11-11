// Lets plain `node` run the app's TypeScript files from a script: maps the
// "@/..." import alias to the project folder and adds the missing ".ts".
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = fileURLToPath(new URL(specifier.slice(2), root));
    for (const file of [`${base}.ts`, `${base}/index.ts`, base]) {
      if (existsSync(file)) return next(pathToFileURL(file).href, context);
    }
  }
  return next(specifier, context);
}

// The app imports JSON files without `with { type: "json" }`; add it here.
export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    return next(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: "json" },
    });
  }
  return next(url, context);
}
