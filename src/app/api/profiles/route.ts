import { getHermesInstallStatus } from "@/lib/hermes-install";
import { listChatProfiles } from "@/lib/profile-registry";

export const runtime = "nodejs";

export async function GET() {
  let install = await getHermesInstallStatus();
  let profiles = await listChatProfiles();

  if (!install.cliAvailable && install.homeExists) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    install = await getHermesInstallStatus();
    profiles = await listChatProfiles();
  }

  const status = profiles.length > 0 && install.homeExists
    ? "ready"
    : install.homeExists || install.cliAvailable
      ? "needs-setup"
      : "missing-hermes";

  return Response.json({
    status,
    install: {
      hermesHome: install.hermesHome,
      cliAvailable: install.cliAvailable,
      homeExists: install.homeExists,
      hermesBin: install.hermesBin,
    },
    profiles,
  });
}
