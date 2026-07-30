import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import MobileShell from "@/components/mobile/MobileShell";

// /m — one screen, one client shell: the Investment CRM. The optional
// catch-all survives only so home-screen shortcuts saved against the old tab
// URLs (/m/pipeline, /m/network, /m/desk) land somewhere real instead of 404ing.
export default async function MobilePage({
  params,
}: {
  params: Promise<{ tab?: string[] }>;
}) {
  // Staff-only, like the rest of the OS pages (middleware already required a
  // session; this enforces the role server-side).
  const user = await requireRole(["admin", "internal"]);

  const { tab } = await params;
  if (tab?.length) redirect("/m");

  return <MobileShell user={{ name: user.name ?? null, email: user.email ?? null }} />;
}
