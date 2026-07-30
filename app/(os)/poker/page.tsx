import PokerApp from "@/components/poker/PokerApp";

export default function PokerPage() {
  return (
    <>
      <main className="tool-main">
        <div className="tool-head">
          <div>
            <div className="tool-title">Poker Tournament</div>
            <div className="tool-sub">Live vote tally</div>
          </div>
        </div>
        <PokerApp />
      </main>
    </>
  );
}
