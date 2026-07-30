"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribe, type Toast } from "@/lib/notify/toast";

// Mounted once by ConsoleShell. Renders the transient toast stack fired from
// anywhere via toast() — see lib/notify/toast.ts.
export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          role={t.type === "error" ? "alert" : "status"}
        >
          <span className="toast-msg">{t.message}</span>
          <button
            className="toast-x"
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
