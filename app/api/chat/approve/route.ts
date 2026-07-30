import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chats, chatMessages } from "@/lib/db/schema";
import { actionTypes } from "@/lib/ontology/actions";
import { executeAction } from "@/lib/ontology/actions/execute";
import "@/lib/ontology/actions/register"; // side-effect: wire action handlers
import { canAct } from "@/lib/ontology/auth";
import type { MessagePart } from "@/lib/chat/types";

export const maxDuration = 120;

const schema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  proposalId: z.string().min(1),
  decision: z.enum(["approve", "deny"]),
});

// Human-in-the-loop for agent writes. The agent never applies a change itself; it
// proposes one, and this route applies it after the user clicks Approve.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const { chatId, messageId, proposalId, decision } = parsed.data;

  // Ownership: the chat (and therefore the proposal) must belong to the caller.
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  if (!chat || chat.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const [msg] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .limit(1);
  if (!msg || msg.chatId !== chatId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parts = (msg.parts ?? []) as MessagePart[];
  const idx = parts.findIndex((p) => p.kind === "proposal" && p.id === proposalId);
  if (idx === -1) {
    return Response.json({ error: "Proposal not found" }, { status: 404 });
  }
  const proposal = parts[idx] as Extract<MessagePart, { kind: "proposal" }>;
  if (proposal.status !== "pending") {
    return Response.json({ error: `Already ${proposal.status}` }, { status: 409 });
  }

  const ontologySession = {
    user: {
      id: session.user.id,
      role: session.user.role ?? null,
      email: session.user.email ?? null,
    },
  };

  const persist = () =>
    db.update(chatMessages).set({ parts }).where(eq(chatMessages.id, messageId));

  if (decision === "deny") {
    proposal.status = "denied";
    await persist();
    return Response.json({ ok: true, status: "denied" });
  }

  // Re-check permission at execution time — never trust the earlier proposal.
  const actionDef = actionTypes[proposal.action];
  if (!actionDef) {
    proposal.status = "failed";
    proposal.error = "Unknown action";
    await persist();
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!canAct(actionDef, ontologySession)) {
    proposal.status = "failed";
    proposal.error = "Not permitted";
    await persist();
    return Response.json({ error: "Not permitted" }, { status: 403 });
  }

  try {
    // Params come from the SERVER-stored proposal, never from the request body —
    // a forged approval can't smuggle different arguments past the card.
    const result = await executeAction(proposal.action, proposal.params, {
      session: ontologySession,
    });
    proposal.status = result.ok ? "approved" : "failed";
    proposal.result = result;
    if (!result.ok) proposal.error = result.error;
    await persist();
    return Response.json({ ok: result.ok, status: proposal.status, result });
  } catch (e) {
    proposal.status = "failed";
    proposal.error = (e as Error).message;
    await persist();
    return Response.json({ error: proposal.error }, { status: 500 });
  }
}
