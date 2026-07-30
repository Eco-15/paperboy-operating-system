"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PENDING_LS_KEY } from "@/lib/chat/types";

// Top-bar "Ask Paperboy" entry. Collapsed it's a pill; clicking expands an
// inline input that stashes the prompt and opens /chat (same behavior the old
// floating AssistantBar had).
export default function AskLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  function openChat(seed?: string) {
    if (seed && seed.trim()) {
      try {
        localStorage.setItem(PENDING_LS_KEY, seed.trim());
      } catch {
        /* ignore */
      }
    }
    router.push("/chat");
  }

  if (!open) {
    return (
      <button
        className="os-ask"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask Paperboy"
      >
        <span className="os-ask-mark" aria-hidden="true">
          ✦
        </span>
        Ask Paperboy
      </button>
    );
  }

  return (
    <form
      className="os-ask-form"
      onSubmit={(e) => {
        e.preventDefault();
        openChat(prompt);
      }}
    >
      <input
        className="os-ask-input"
        type="text"
        autoFocus
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => !prompt && setOpen(false)}
        placeholder="Ask about a brand, a deal, your content…"
      />
      <button className="os-ask" type="submit">
        Send
      </button>
    </form>
  );
}
