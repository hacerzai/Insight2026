import { build } from "esbuild";
import { cp, mkdir, readdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";

const outputRoot = "go-live";
const assetsDir = join(outputRoot, "assets");

await rm(assetsDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

await build({
  entryPoints: ["go-live-src/main.tsx"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: assetsDir,
  platform: "browser",
  target: "es2022",
  minify: true,
  entryNames: "main",
  chunkNames: "chunk-[hash]",
});

await Promise.all([
  copyFile("app/globals.css", join(assetsDir, "globals.css")),
  copyFile("app/science-platform.css", join(assetsDir, "science-platform.css")),
]);

for (const entry of await readdir("public", { withFileTypes: true })) {
  await cp(
    join("public", entry.name),
    join(outputRoot, entry.name),
    { recursive: entry.isDirectory(), force: true },
  );
}

console.log("Go Live output is self-contained in go-live/");
