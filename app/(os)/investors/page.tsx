import InvestorApp from "@/components/investors/InvestorApp";

export default function InvestorsPage() {
  return (
    <>
      <main className="tool-main">
        <div className="tool-head">
          <div>
            <div className="tool-title">CPG Investor Database</div>
            <div className="tool-sub">460 investors · Angel Groups, VCs &amp; Family Offices · Updated July 2025</div>
          </div>
        </div>
        <InvestorApp />
      </main>
    </>
  );
}
