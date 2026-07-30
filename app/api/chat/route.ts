import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chats, chatMessages, chatFiles } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";
import type { ChatTurn } from "@/lib/chat/providers";
import { runAgent, agentSystemPrompt } from "@/lib/chat/agent";
import { getArtifact, saveArtifact } from "@/lib/artifacts/store";
import type { Citation } from "@/lib/chat/tools";
import type { MessagePart } from "@/lib/chat/types";
import { resolveUserPrincipals } from "@/lib/rag/groups";

export const maxDuration = 300;

// Download a generated file from the Anthropic Files API and archive its bytes,
// so the in-chat download link survives reloads and file-retention windows.
async function persistChatFile(
  ev: { fileId: string; filename: string; mime: string; size: number },
  chatId: string,
  userId: string,
): Promise<boolean> {
  try {
    const client = new Anthropic();
    const resp = await client.beta.files.download(ev.fileId, {
      betas: ["files-api-2025-04-14"],
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    await db
      .insert(chatFiles)
      .values({
        fileId: ev.fileId,
        chatId,
        userId,
        filename: ev.filename,
        mime: ev.mime,
        size: ev.size || buf.length,
        bytes: buf,
      })
      .onConflictDoNothing();
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  // Claude-only: the other providers have no tools and no ontology access.
  model: z.literal("claude").default("claude"),
  // The document currently open in the panel, as the USER sees it right now —
  // including edits they typed and haven't otherwise saved. Without this the model
  // reasons about a stale copy: its find-and-replace `old_str` wouldn't match what's
  // on screen, so edits would silently fail or clobber the user's work.
  artifact: z
    .object({ id: z.string().min(1), content: z.string() })
    .optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response("Invalid input", { status: 400 });
  }
  const { chatId, message, artifact: openDoc } = parsed.data;

  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  if (!chat || chat.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  await db.insert(chatMessages).values({ chatId, role: "user", text: message });

  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(chatMessages.createdAt);
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role, content: m.text }));

  // ── The open document ──────────────────────────────────────────────────────
  // Conversation history is rebuilt from each message's flat `text`, and a document's
  // body never appears there — it lives in the tool's INPUT. So the model has no memory
  // of what it wrote. (This is why the old "export the draft you just produced" button
  // was a lie: it asked the model to reuse content it could no longer see, and it
  // quietly regenerated from its own summary.) Hand it the real, current text.
  let openDocBlock = "";
  if (openDoc) {
    const stored = await getArtifact(openDoc.id, session.user.id);
    if (stored) {
      // The user may have typed into the panel. Their version is the truth — snapshot
      // it so it isn't lost, then show the model exactly what's on screen.
      if (openDoc.content !== stored.content && openDoc.content.trim()) {
        await saveArtifact({
          id: stored.id,
          userId: session.user.id,
          chatId: stored.chatId,
          title: stored.title,
          kind: stored.kind,
          content: openDoc.content,
          authoredBy: "user",
        });
      }
      openDocBlock = [
        "",
        "<open_document>",
        `The user has this document open in the panel beside the chat. This is its CURRENT text —`,
        `it may include edits THEY made. Treat it as the truth, not your memory of what you wrote.`,
        `When revising it, call update_artifact with id="${stored.id}" and quote from this exactly.`,
        "",
        `id: ${stored.id}`,
        `title: ${stored.title}`,
        `kind: ${stored.kind}`,
        "---",
        openDoc.content,
        "---",
        "</open_document>",
      ].join("\n");
    }
  }

  const staff = isStaff(session.user.role);
  const isAdmin = session.user.role === "admin";
  // Drive ACL principals — a permissions concept for search_drive, NOT an identity.
  // The ontology gets the real session below; conflating the two previously broke
  // every owner-scoped read and every staff write.
  const principals = staff
    ? await resolveUserPrincipals(session.user.email ?? "")
    : [];
  const ontologySession = {
    user: {
      id: session.user.id,
      role: session.user.role ?? null,
      email: session.user.email ?? null,
    },
  };

  const encoder = new TextEncoder();
  let full = "";
  let citations: Citation[] = [];
  // The ordered agent trace, persisted so the timeline survives a reload.
  const parts: MessagePart[] = [];
  const fileIds: string[] = [];

  const appendText = (t: string) => {
    const last = parts[parts.length - 1];
    if (last?.kind === "text") last.text += t;
    else parts.push({ kind: "text", text: t });
  };
  const appendThinking = (t: string) => {
    const last = parts[parts.length - 1];
    if (last?.kind === "thinking") last.text += t;
    else parts.push({ kind: "thinking", text: t });
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // One JSON event per NDJSON line (embedded newlines are escaped by
      // JSON.stringify, so the framing is safe).
      const send = (ev: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        for await (const ev of runAgent({
          messages: turns,
          system: agentSystemPrompt(staff, staff) + openDocBlock,
          principals,
          isAdmin,
          includeDrive: staff,
          includeGoogle: staff,
          session: ontologySession,
          chatId,
        })) {
          switch (ev.type) {
            case "text":
              full += ev.text;
              appendText(ev.text);
              break;
            case "thinking":
              appendThinking(ev.text);
              break;
            case "tool_start":
              parts.push({
                kind: "tool",
                id: ev.id,
                tool: ev.tool,
                label: ev.label,
                input: ev.input,
                done: false,
              });
              break;
            case "tool_end": {
              const p = parts.find((x) => x.kind === "tool" && x.id === ev.id);
              if (p && p.kind === "tool") {
                p.result = { summary: ev.summary, preview: ev.preview, isError: ev.isError };
                p.durationMs = ev.durationMs;
                p.done = true;
              }
              break;
            }
            case "proposal":
              parts.push({
                kind: "proposal",
                id: ev.id,
                action: ev.action,
                params: ev.params,
                summary: ev.summary,
                status: "pending",
              });
              break;
            case "citations":
              citations = ev.citations;
              break;
            case "file": {
              // Archive the bytes; only surface the file if we captured it.
              const ok = await persistChatFile(ev, chatId, session.user.id);
              if (!ok) continue;
              fileIds.push(ev.fileId);
              parts.push({
                kind: "file",
                fileId: ev.fileId,
                filename: ev.filename,
                mime: ev.mime,
                size: ev.size,
              });
              break;
            }
          }
          send(ev);
        }
      } catch (err) {
        // This used to swallow the error and always blame the API key — which sent us
        // chasing config when the real cause (e.g. "credit balance is too low") was
        // right there in the exception. Log it, and tell the user what actually happened.
        const raw = err instanceof Error ? err.message : String(err);
        console.error("[chat] agent stream failed:", raw);

        let note: string;
        if (/credit balance is too low|billing/i.test(raw)) {
          note =
            "\n\n_The AI account is out of credits, so I can't respond right now. " +
            "An admin needs to add credits in the Anthropic console (Plans & Billing)._";
        } else if (/rate limit|429/i.test(raw)) {
          note = "\n\n_The AI is rate-limited right now — give it a moment and try again._";
        } else if (/overloaded|529|503/i.test(raw)) {
          note = "\n\n_The AI is temporarily overloaded. Please try again in a moment._";
        } else if (/401|invalid x-api-key|authentication/i.test(raw)) {
          note = "\n\n_The AI API key looks invalid — an admin should check ANTHROPIC_API_KEY._";
        } else {
          note = `\n\n_I hit an error and couldn't finish: ${raw.slice(0, 200)}_`;
        }

        full += note;
        appendText(note);
        send({ type: "text", text: note });
      } finally {
        // Persist BEFORE `done` so the client gets the real message id — it needs
        // it to approve any pending action proposals against this turn.
        const [row] = await db
          .insert(chatMessages)
          .values({
            chatId,
            role: "assistant",
            text: full,
            model: "claude",
            citations: citations.length ? citations : null,
            parts: parts.length ? parts : null,
          })
          .returning({ id: chatMessages.id });

        if (row && fileIds.length) {
          await db
            .update(chatFiles)
            .set({ messageId: row.id })
            .where(inArray(chatFiles.fileId, fileIds));
        }

        await db
          .update(chats)
          .set({
            lastModel: "claude",
            updatedAt: new Date(),
            title: chat.title === "New chat" ? message.slice(0, 48) : chat.title,
          })
          .where(eq(chats.id, chatId));

        send({ type: "done", messageId: row?.id });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // `text/plain` is compressible, so a proxy (Cloud Run's front end, a CDN) will
      // happily gzip-buffer it and hand us the tokens in bursts — the stream arrives
      // lumpy before React ever sees it, which no amount of client-side pacing can
      // undo. `no-transform` forbids that rewriting; `X-Accel-Buffering: no` tells
      // nginx-style proxies to pass bytes straight through.
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
