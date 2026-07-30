"use client";

import { signIn } from "next-auth/react";

// Returns the user to this exact authorize URL after Google sign-in, so the
// OAuth flow resumes where it left off (the app's /login hardcodes /dashboard).
export default function GoogleContinue({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { redirectTo: callbackUrl })}
      style={{
        fontFamily: "var(--meta-font, monospace)",
        fontSize: "0.95rem",
        background: "#111",
        color: "#fff",
        border: "1px solid #111",
        borderRadius: 8,
        padding: "12px 20px",
        cursor: "pointer",
      }}
    >
      Continue with Google
    </button>
  );
}
