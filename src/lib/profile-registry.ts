import { getHermesInstallStatus, type HermesInstallStatus } from "@/lib/hermes-install";

const DARK_ACCENTS = ["#c5a6ff", "#8fd1a1", "#85b6ff", "#ff9f6b", "#d6b58e", "#f17ecb"];
const LIGHT_ACCENTS = ["#9270cf", "#6f9b7b", "#5b8fd7", "#cf7d50", "#b28a64", "#c058a0"];
const GLYPHS = ["◉", "◌", "△", "□", "◇", "✦", "✳", "⬡", "◎"];

export interface ChatProfile {
  id: string;
  name: string;
  displayName: string;
  accent: string;
  lightAccent: string;
  glyph: string;
  shortcut: string | null;
  home: string;
  sessionsPath: string;
  root: boolean;
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hash(value: string) {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
}

function shortcutForIndex(index: number) {
  return index < 9 ? `⌥${index + 1}` : null;
}

function toProfile(
  input: HermesInstallStatus["rootProfile"] | HermesInstallStatus["namedProfiles"][number],
  index: number,
): ChatProfile {
  const token = hash(input.id);
  return {
    id: input.id,
    name: input.name,
    displayName: input.root ? "Hermes" : titleCase(input.name),
    accent: DARK_ACCENTS[token % DARK_ACCENTS.length]!,
    lightAccent: LIGHT_ACCENTS[token % LIGHT_ACCENTS.length]!,
    glyph: GLYPHS[token % GLYPHS.length]!,
    shortcut: shortcutForIndex(index),
    home: input.home,
    sessionsPath: input.sessionsPath,
    root: input.root,
  };
}

export async function listChatProfiles(): Promise<ChatProfile[]> {
  const install = await getHermesInstallStatus();
  const rawProfiles = [install.rootProfile, ...install.namedProfiles].filter((profile) => profile.exists);
  return rawProfiles.map((profile, index) => toProfile(profile, index));
}

export async function getChatProfile(profileId: string) {
  const profiles = await listChatProfiles();
  return profiles.find((profile) => profile.id === profileId) ?? null;
}

export async function getProfileMap() {
  const profiles = await listChatProfiles();
  return new Map(profiles.map((profile) => [profile.id, profile]));
}
