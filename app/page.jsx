// This is the only Server Component in the chain.
// It does nothing except mount the Client Component.
// This keeps the door open for future RSC data-fetching (Supabase etc.)
// without touching the UI code.

import MorningBaseRoutine from "@/components/MorningBaseRoutine";

export default function HomePage() {
  return <MorningBaseRoutine />;
}
