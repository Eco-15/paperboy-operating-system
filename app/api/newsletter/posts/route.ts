import { NextResponse } from "next/server";
import { z } from "zod";
import { listPosts, createPost, testSendPost, sendEnabled } from "@/lib/beehiiv/client";
import { newsletterGate, beehiivErrorResponse } from "@/lib/newsletter/guard";
import { mapPost } from "@/lib/newsletter/types";

export async function GET(req: Request) {
  const gate = await newsletterGate();
  if (gate) return gate;
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || "1");
  try {
    const res = await listPosts({ page, limit: 25 });
    return NextResponse.json({
      posts: (res.data ?? []).map(mapPost),
      sendEnabled: sendEnabled(),
    });
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    bodyHtml: z.string().min(1),
  }),
  z.object({
    action: z.literal("test"),
    postId: z.string().min(1),
    emails: z.array(z.string().email()).min(1),
  }),
]);

export async function POST(req: Request) {
  const gate = await newsletterGate();
  if (gate) return gate;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    if (parsed.data.action === "test") {
      await testSendPost(parsed.data.postId, parsed.data.emails);
      return NextResponse.json({ ok: true });
    }
    // Create a draft post. Beehiiv's create-post (Send API) accepts structured
    // blocks or a raw HTML snippet; we send a minimal draft. This requires the
    // Send API (Enterprise/beta) — beehiivErrorResponse surfaces the gate to the
    // UI (e.g. 402/403) so the user is told to finish the send in Beehiiv.
    const res = await createPost({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      status: "draft",
      content: { free: { web: parsed.data.bodyHtml, email: parsed.data.bodyHtml } },
    });
    return NextResponse.json({ post: mapPost(res.data) }, { status: 201 });
  } catch (e) {
    return beehiivErrorResponse(e);
  }
}
