"use client";

import CalendarPanel from "./CalendarPanel";
import EmailPanel from "./EmailPanel";
import NewsPanel from "./NewsPanel";

// The dashboard "cockpit" (Today/Assistant panels): the signed-in user's
// Calendar + Inbox in the center with an industry-news right rail. The KPI
// stats strip that used to live here now renders above as <KpiRow />.
export default function DashCockpit() {
  return (
    <section className="dash-cockpit">
      <div className="dash-cockpit-center">
        <CalendarPanel />
        <EmailPanel />
      </div>
      <NewsPanel />
    </section>
  );
}
