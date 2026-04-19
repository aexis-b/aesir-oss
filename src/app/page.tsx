import { ChatShell } from "@/components/chat-shell";
import { getRuntimeMode } from "@/lib/agent-runtime";

export default function Home() {
  return <ChatShell runtimeMode={getRuntimeMode()} />;
}
