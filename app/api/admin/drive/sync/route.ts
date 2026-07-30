import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { driveFiles, docChunks } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";

// Allow a long-running sync (large drives). Proper scale = a Cloud Run Job
// running `npm run ingest`; this route is the convenient manual trigger.
export const maxDuration = 300;

// Index stats.
export async function GET() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [{ files }] = await db
    .select({ files: sql<number>`count(*)::int` })
    .from(driveFiles);
  const [{ chunks }] = await db
    .select({ chunks: sql<number>`count(*)::int` })
    .from(docChunks);
  return NextResponse.json({ files, chunks });
}

// Trigger a Drive → pgvector sync by EXECUTING the `drive-ingest` Cloud Run Job.
//
// This used to call ingestSharedDrive() inline. Ingest buffers whole files into
// memory, so a 204 MB PDF OOM'd this 1 GB container and 504'd the request — the file
// was never indexed and the error was swallowed, which is precisely how the FON
// Series A memo went missing. The Job has 4 GB and an hour; this just kicks it off.
export async function POST() {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const region = process.env.DRIVE_INGEST_REGION ?? "us-central1";
  const job = process.env.DRIVE_INGEST_JOB ?? "drive-ingest";
  if (!project) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_CLOUD_PROJECT is not set" },
      { status: 500 },
    );
  }

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const url = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}:run`;
    const res = await client.request<{ name?: string }>({ url, method: "POST" });

    return NextResponse.json({
      ok: true,
      started: true,
      operation: res.data?.name ?? null,
      message:
        "Drive ingest started in the drive-ingest Cloud Run Job. It runs in the background — " +
        "check the job's logs for the per-file summary (including anything it could not index).",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to start the ingest job" },
      { status: 500 },
    );
  }
}
