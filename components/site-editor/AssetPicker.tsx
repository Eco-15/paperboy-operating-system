"use client";

// Image chooser for the Site Editor: upload a new image (downscaled
// client-side so bytea rows stay small), pick from previously uploaded
// assets, or type a public/ path for art that ships with the repo.

import { useEffect, useRef, useState } from "react";

type Asset = {
  id: string;
  url: string;
  filename: string | null;
  alt: string | null;
  createdAt: string;
};

const MAX_DIMENSION = 2000;

async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    if (scale >= 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.9),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function AssetPicker({
  onPick,
  onClose,
}: {
  onPick: (src: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"upload" | "library" | "path">("upload");
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== "library" || assets !== null) return;
    fetch("/api/site-editor/assets")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((data) => setAssets(data.assets ?? []))
      .catch(() => setError("Could not load the image library."));
  }, [tab, assets]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.append(
        "file",
        new File([blob], file.name, { type: blob.type || file.type }),
      );
      const res = await fetch("/api/site-editor/assets", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
      onPick(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <div className="tool-modal-backdrop" onClick={onClose}>
      <div
        className="tool-modal se-asset-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="tool-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="tool-modal-meta">Choose an image</div>

        <div className="se-tabs">
          {(["upload", "library", "path"] as const).map((t) => (
            <button
              key={t}
              className={`se-tab${tab === t ? " se-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "upload" ? "Upload" : t === "library" ? "Library" : "Path"}
            </button>
          ))}
        </div>

        {error ? <div className="se-error">{error}</div> : null}

        {tab === "upload" ? (
          <div className="se-upload">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <button
              className="tool-btn tool-btn--solid"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Uploading…" : "Choose an image…"}
            </button>
            <p className="se-hint">
              Large photos are resized automatically. The engraved-newspaper
              look works best with high-contrast images.
            </p>
          </div>
        ) : null}

        {tab === "library" ? (
          <div className="se-asset-grid">
            {assets === null ? (
              <div className="se-hint">Loading…</div>
            ) : assets.length === 0 ? (
              <div className="se-hint">No uploads yet.</div>
            ) : (
              assets.map((a) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <button
                  key={a.id}
                  className="se-asset"
                  title={a.filename ?? a.id}
                  onClick={() => onPick(a.url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.alt ?? a.filename ?? ""} />
                </button>
              ))
            )}
          </div>
        ) : null}

        {tab === "path" ? (
          <div className="se-upload">
            <input
              className="tool-input"
              placeholder="/front-page/cuts/example.jpg"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
            <div className="tool-modal-actions">
              <button
                className="tool-btn tool-btn--solid"
                disabled={!path.trim()}
                onClick={() => onPick(path.trim())}
              >
                Use this path
              </button>
            </div>
            <p className="se-hint">
              For art already shipped with the site (public/ folder).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
