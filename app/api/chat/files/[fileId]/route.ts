import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatFiles } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";

// Serve an archived generated file. Staff-gated, and scoped to the owner —
// Anthropic file ids are org-scoped, so ownership must be enforced here.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { fileId } = await params;

  const [row] = await db
    .select()
    .from(chatFiles)
    .where(and(eq(chatFiles.fileId, fileId), eq(chatFiles.userId, session.user.id)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const safeName = row.filename.replace(/["\r\n]/g, "").slice(0, 200) || "document";

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Content-Length": String(row.size || row.bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
