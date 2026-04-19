import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const standaloneRoot = path.join(root, ".next", "standalone");
const staticRoot = path.join(root, ".next", "static");
const publicRoot = path.join(root, "public");
const desktopRoot = path.join(root, "dist-electron", "server");
const buildRoot = path.join(root, "build");
const iconSourceRoot = path.join(root, "aesir.icon");
const iconTargetRoot = path.join(buildRoot, "icon.icon");

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standaloneRoot))) {
    throw new Error("Missing .next/standalone. Run `next build` first.");
  }

  if (!(await exists(staticRoot))) {
    throw new Error("Missing .next/static. Run `next build` first.");
  }

  if (!(await exists(iconSourceRoot))) {
    throw new Error("Missing aesir.icon source asset.");
  }

  await rm(desktopRoot, { recursive: true, force: true });
  await mkdir(path.dirname(desktopRoot), { recursive: true });
  await cp(standaloneRoot, desktopRoot, { recursive: true });

  for (const redundantPath of [
    "build",
    "desktop-dist",
    "dist-electron",
    "electron",
    "aesir.icon",
    "data",
    "src",
  ]) {
    await rm(path.join(desktopRoot, redundantPath), {
      recursive: true,
      force: true,
    });
  }

  await mkdir(path.join(desktopRoot, ".next"), { recursive: true });
  await cp(staticRoot, path.join(desktopRoot, ".next", "static"), {
    recursive: true,
  });

  if (await exists(publicRoot)) {
    await cp(publicRoot, path.join(desktopRoot, "public"), { recursive: true });
  }

  await rm(iconTargetRoot, { recursive: true, force: true });
  await mkdir(buildRoot, { recursive: true });
  await cp(iconSourceRoot, iconTargetRoot, { recursive: true });

  console.log(`Prepared desktop server bundle at ${desktopRoot}`);
  console.log(`Prepared macOS icon asset at ${iconTargetRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
