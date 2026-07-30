import { auth } from "@/auth";
import DashHeader from "@/components/dashboard/DashHeader";
import DashCockpit from "@/components/dashboard/DashCockpit";

// Home: a personalized greeting over a calendar-forward cockpit — the signed-in
// user's calendar takes the majority of the view (60%), with industry news
// alongside (40%). The shell (top bar + left rail) is in app/(os)/layout.tsx.
export default async function Dashboard() {
  const session = await auth();
  return (
    <main className="os-main dash-main">
      <DashHeader name={session?.user?.name} />
      <DashCockpit />
    </main>
  );
}
