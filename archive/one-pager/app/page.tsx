import Header from "@/components/Header";
import OnePagerApp from "@/components/one-pager/OnePagerApp";

export default function OnePagerPage() {
  return (
    <>
      <Header subtitle="One-Pager Studio" />
      <main className="tool-main">
        <div className="tool-head">
          <div>
            <div className="tool-title">Investment Applications</div>
            <div className="tool-sub">Airtable inbound · AI one-pager generator</div>
          </div>
        </div>
        <OnePagerApp />
      </main>
    </>
  );
}
