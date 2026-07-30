"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function AcceptForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    fetch(`/api/invites/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        setValid(!!d.valid);
        setEmail(d.email ?? null);
      })
      .catch(() => setValid(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: name.trim(), password }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong.");
    }
  }

  if (valid === false) {
    return (
      <div style={card}>
        <div style={brand}>Paperboy OS</div>
        <p style={{ color: "#b23b3b" }}>This invitation is invalid or has expired.</p>
      </div>
    );
  }
  if (done) {
    return (
      <div style={card}>
        <div style={brand}>Paperboy OS</div>
        <p>Your account is ready.</p>
        <a href="/login" style={submitBtn}>Go to sign in</a>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={brand}>Paperboy OS</div>
      <p style={{ color: "#6b6453", marginTop: 4, marginBottom: 20 }}>
        You&apos;ve been invited{email ? ` as ${email}` : ""}. Set a password to finish.
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={label}>
          Your name
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label style={label}>
          Password (min 8 characters)
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p style={{ color: "#b23b3b", fontSize: 13, margin: 0 }}>{error}</p>}
        <button type="submit" style={submitBtn} disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <main style={wrap}>
      <Suspense fallback={<div style={card}>Loading…</div>}>
        <AcceptForm />
      </Suspense>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#F5F2E8",
  padding: 24,
};
const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 380,
  background: "#fff",
  border: "1px solid #e5e0d0",
  borderRadius: 12,
  padding: 32,
};
const brand: React.CSSProperties = {
  fontFamily: "Georgia, serif",
  fontSize: 26,
  fontWeight: 700,
};
const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  color: "#6b6453",
};
const input: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #d9d3c2",
  borderRadius: 8,
  fontSize: 15,
};
const submitBtn: React.CSSProperties = {
  padding: "11px 14px",
  border: "none",
  borderRadius: 8,
  background: "#1a1a1a",
  color: "#fff",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
  textAlign: "center",
  textDecoration: "none",
};
