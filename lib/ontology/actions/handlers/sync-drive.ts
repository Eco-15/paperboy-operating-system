import type { ActionHandler } from "../../types";

export const syncDrive: ActionHandler = async (_params, _ctx) => {
  const { ingestSharedDrive } = await import("@/lib/rag/ingest");
  const summary = await ingestSharedDrive();
  return {
    ok: true,
    data: summary,
    edits: [{ objectType: "DriveFile", objectId: "all", operation: "update" }],
  };
};
