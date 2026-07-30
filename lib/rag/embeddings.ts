import { GoogleAuth } from "google-auth-library";

// Vertex AI text-embeddings. Uses Application Default Credentials — the
// paperboy-app service account on Cloud Run, or `gcloud auth application-default
// login` locally. 768-dimensional (matches the doc_chunk vector column).
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

// Vertex throttles hard during a bulk ingest (429 RESOURCE_EXHAUSTED). With no retry,
// a single throttle threw straight out of embedText, killed the whole ingest run, and
// every file after it was silently never indexed. Back off and retry — a rate limit is
// a "wait", not a "give up".
const MAX_ATTEMPTS = 6;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function embedText(
  texts: string[],
  taskType: TaskType = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_LOCATION ?? "us-central1";
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-005";
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not set");
  if (texts.length === 0) return [];

  const client = await auth.getClient();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await client.request<{
        predictions: { embeddings: { values: number[] } }[];
      }>({
        url,
        method: "POST",
        data: {
          instances: texts.map((content) => ({ content, task_type: taskType })),
        },
      });
      return res.data.predictions.map((p) => p.embeddings.values);
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number; code?: number }).status ?? (e as { code?: number }).code;
      if (!RETRYABLE.has(Number(status)) || attempt === MAX_ATTEMPTS) throw e;
      // Exponential backoff with jitter: ~1s, 2s, 4s, 8s, 16s.
      const delay = 2 ** (attempt - 1) * 1000 + Math.floor(Math.random() * 500);
      console.warn(
        `[embeddings] ${status} from Vertex — retrying in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Serialize a vector for a pgvector literal: [0.1,0.2,...]. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
