import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";

export interface HermesProfileInstall {
  id: string;
  name: string;
  home: string;
  configPath: string;
  authPath: string;
  sessionsPath: string;
  exists: boolean;
  root: boolean;
}

export interface HermesInstallStatus {
  hermesHome: string;
  hermesBin: string | null;
  cliAvailable: boolean;
  homeExists: boolean;
  profilesRoot: string;
  rootProfile: HermesProfileInstall;
  namedProfiles: HermesProfileInstall[];
}

const DEFAULT_HERMES_CANDIDATES = [
  "/opt/homebrew/bin/hermes",
  "/usr/local/bin/hermes",
  join(homedir(), ".local", "bin", "hermes"),
];

function normalizeProfileId(value: string) {
  return value.trim().toLowerCase();
}

export function getHermesHome() {
  const explicit = process.env.HERMES_HOME?.trim();
  if (!explicit) {
    return join(homedir(), ".hermes");
  }

  const parent = dirname(explicit);
  if (basename(parent) === "profiles") {
    return dirname(parent);
  }

  return explicit;
}

export function getProfileInstall(home: string, id: string, root = false): HermesProfileInstall {
  const profileHome = root ? home : join(home, "profiles", id);
  const normalizedId = normalizeProfileId(id);
  return {
    id: normalizedId,
    name: root ? "Hermes" : id,
    home: profileHome,
    configPath: join(profileHome, "config.yaml"),
    authPath: join(profileHome, "auth.json"),
    sessionsPath: join(profileHome, "sessions"),
    exists: existsSync(profileHome),
    root,
  };
}

export function resolveHermesBinary() {
  const explicit = process.env.HERMES_BIN?.trim();
  const candidates = [explicit, ...DEFAULT_HERMES_CANDIDATES].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const result = spawnSync("hermes", ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
    timeout: 1000,
  });

  return result.status === 0 ? "hermes" : null;
}

export async function getHermesInstallStatus(): Promise<HermesInstallStatus> {
  const hermesHome = getHermesHome();
  const profilesRoot = join(hermesHome, "profiles");
  const rootProfile = getProfileInstall(hermesHome, "hermes", true);
  const hermesBin = resolveHermesBinary();

  let namedProfiles: HermesProfileInstall[] = [];
  try {
    const entries = await readdir(profilesRoot, { withFileTypes: true });
    const directories = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map(async (entry) => {
          const fullPath = join(profilesRoot, entry.name);
          const metadata = await stat(fullPath).catch(() => null);
          return metadata?.isDirectory() ? entry.name : null;
        }),
    );

    namedProfiles = directories
      .filter((entry): entry is string => Boolean(entry))
      .map((profileName) => getProfileInstall(hermesHome, profileName))
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    namedProfiles = [];
  }

  return {
    hermesHome,
    hermesBin,
    cliAvailable: Boolean(hermesBin),
    homeExists: existsSync(hermesHome),
    profilesRoot,
    rootProfile,
    namedProfiles,
  };
}

export async function listInstalledProfileIds() {
  const install = await getHermesInstallStatus();
  return [install.rootProfile.id, ...install.namedProfiles.map((profile) => profile.id)];
}

export async function getProfileInstallById(profileId: string) {
  const normalized = normalizeProfileId(profileId);
  const install = await getHermesInstallStatus();
  if (normalized === install.rootProfile.id) {
    return install.rootProfile;
  }

  return install.namedProfiles.find((profile) => profile.id === normalized) ?? null;
}
