import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocumentForDownload } from "@/lib/portal/data";

// Serve a data-room document to an LP (or staff). Access is fail-closed —
// getDocumentForDownload returns null unless the doc is shared with this LP.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const doc = await getDocumentForDownload(
    { id: session.user.id, email: session.user.email, role: session.user.role },
    id,
  );
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.externalUrl) {
    return NextResponse.redirect(doc.externalUrl);
  }
  if (!doc.bytes) {
    return NextResponse.json({ error: "No file attached" }, { status: 404 });
  }

  const filename = doc.filename ?? `${doc.title}.pdf`;
  return new NextResponse(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": doc.mime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
