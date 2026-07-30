import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artifacts, artifactVersions } from "@/lib/db/schema";

export type ArtifactKind = "document" | "deck" | "sheet" | "html";

export interface Artifact {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  version: number;
  chatId: string | null;
  updatedAt: Date;
}

export interface Edit {
  old_str: string;
  new_str: string;
}

/** Every artifact read is scoped to its owner — ids are model-chosen slugs, so
 *  without this a guessed id ("fon-memo") would read someone else's document. */
export async function getArtifact(id: string, userId: string): Promise<Artifact | null> {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
    .limit(1);
  return row ? (row as Artifact) : null;
}

export async function listArtifacts(userId: string): Promise<Artifact[]> {
  return (await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.userId, userId))
    .orderBy(desc(artifacts.updatedAt))) as Artifact[];
}

export async function listVersions(id: string, userId: string) {
  const owned = await getArtifact(id, userId);
  if (!owned) return [];
  return db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, id))
    .orderBy(desc(artifactVersions.version));
}

/** Create, or replace the body wholesale. Always snapshots a version. */
export async function saveArtifact(a: {
  id: string;
  userId: string;
  chatId: string | null;
  title: string;
  kind: ArtifactKind;
  content: string;
  authoredBy: "assistant" | "user";
}): Promise<Artifact> {
  const existing = await getArtifact(a.id, a.userId);
  const version = (existing?.version ?? 0) + 1;

  if (existing) {
    await db
      .update(artifacts)
      .set({ title: a.title, kind: a.kind, content: a.content, version, updatedAt: new Date() })
      .where(and(eq(artifacts.id, a.id), eq(artifacts.userId, a.userId)));
  } else {
    await db.insert(artifacts).values({
      id: a.id,
      userId: a.userId,
      chatId: a.chatId,
      title: a.title,
      kind: a.kind,
      content: a.content,
      version,
    });
  }

  await db.insert(artifactVersions).values({
    artifactId: a.id,
    version,
    content: a.content,
    authoredBy: a.authoredBy,
  });

  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    content: a.content,
    version,
    chatId: a.chatId,
    updatedAt: new Date(),
  };
}

export interface EditResult {
  ok: boolean;
  artifact?: Artifact;
  /** Why it failed, phrased for the MODEL to recover from. */
  error?: string;
}

/**
 * Apply targeted string replacements.
 *
 * This is the whole game for "revise in place": it's cheap, and — crucially — it
 * leaves everything the user typed themselves untouched, because we only rewrite the
 * spans the model actually named.
 *
 * It fails LOUDLY. A silently-missed edit is the failure mode that makes this feel
 * broken: the user asks for a change, the model says "done!", and nothing moved.
 */
export async function applyEdits(
  id: string,
  userId: string,
  edits: Edit[],
): Promise<EditResult> {
  const current = await getArtifact(id, userId);
  if (!current) {
    return { ok: false, error: `No artifact "${id}" exists. Create it first with create_artifact.` };
  }
  if (!edits.length) return { ok: false, error: "No edits were supplied." };

  let content = current.content;

  for (const [i, e] of edits.entries()) {
    if (!e.old_str) {
      return { ok: false, error: `Edit ${i + 1}: old_str is empty. It must quote existing text exactly.` };
    }
    if (e.old_str === e.new_str) continue;

    const first = content.indexOf(e.old_str);
    if (first === -1) {
      return {
        ok: false,
        error:
          `Edit ${i + 1} did NOT match: old_str was not found in the document. The document may have ` +
          `been edited by the user since you last saw it — do not guess. Re-read the current content ` +
          `(it is provided to you above) and quote it exactly, including whitespace.`,
      };
    }
    const second = content.indexOf(e.old_str, first + e.old_str.length);
    if (second !== -1) {
      return {
        ok: false,
        error:
          `Edit ${i + 1} is AMBIGUOUS: old_str appears more than once, so replacing it could change the ` +
          `wrong part of the document. Include more surrounding context to make it unique.`,
      };
    }

    content = content.slice(0, first) + e.new_str + content.slice(first + e.old_str.length);
  }

  if (content === current.content) {
    return { ok: false, error: "The edits produced no change to the document." };
  }

  const saved = await saveArtifact({
    id,
    userId,
    chatId: current.chatId,
    title: current.title,
    kind: current.kind,
    content,
    authoredBy: "assistant",
  });
  return { ok: true, artifact: saved };
}

/** Roll back to an earlier version — as a NEW version, so nothing is ever destroyed. */
export async function restoreVersion(
  id: string,
  userId: string,
  version: number,
): Promise<Artifact | null> {
  const current = await getArtifact(id, userId);
  if (!current) return null;

  const [v] = await db
    .select()
    .from(artifactVersions)
    .where(and(eq(artifactVersions.artifactId, id), eq(artifactVersions.version, version)))
    .limit(1);
  if (!v) return null;

  return saveArtifact({
    id,
    userId,
    chatId: current.chatId,
    title: current.title,
    kind: current.kind,
    content: v.content,
    authoredBy: "user",
  });
}
