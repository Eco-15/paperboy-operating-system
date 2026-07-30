"use client";

import { useState } from "react";
import type { MessagePart } from "@/lib/chat/types";

type ProposalPart = Extract<MessagePart, { kind: "proposal" }>;

// The agent never writes on its own — it proposes, and the change only happens
// when the user clicks Approve. The server re-reads the proposal from its own
// stored copy, so what gets applied is exactly what's shown here.
export default function ProposalCard({
  part,
  messageId,
  onDecide,
}: {
  part: ProposalPart;
  messageId: string;
  onDecide: (messageId: string, proposalId: string, decision: "approve" | "deny") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const pending = part.status === "pending";

  const decide = async (decision: "approve" | "deny") => {
    setBusy(true);
    await onDecide(messageId, part.id, decision);
    setBusy(false);
  };

  const entries = Object.entries(part.params ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  return (
    <div className={`chat-proposal is-${part.status}`}>
      <div className="chat-proposal-head">
        <span className="chat-proposal-kicker">
          {pending ? "Needs your approval" : part.status === "approved" ? "Applied" : part.status === "denied" ? "Cancelled" : "Failed"}
        </span>
        <span className="chat-proposal-action">{part.action}</span>
      </div>

      {entries.length > 0 && (
        <dl className="chat-proposal-params">
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {part.error && <div className="chat-proposal-error">{part.error}</div>}

      {pending && (
        <div className="chat-proposal-actions">
          <button
            type="button"
            className="chat-btn chat-btn--solid"
            disabled={busy}
            onClick={() => decide("approve")}
          >
            {busy ? "Applying…" : "Approve"}
          </button>
          <button
            type="button"
            className="chat-btn"
            disabled={busy}
            onClick={() => decide("deny")}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
