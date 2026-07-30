"use client";

import { useEffect, useState } from "react";

// A small personalized dashboard hero: a time-of-day greeting + today's date.
// Computed on the client so the greeting matches the viewer's local time.
export default function DashHeader({ name }: { name?: string | null }) {
  const [greeting, setGreeting] = useState("Welcome back");
  const [date, setDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setDate(
      now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  const first = (name ?? "").trim().split(/\s+/)[0];

  return (
    <header className="dash-hero">
      <h1 className="dash-hero-title">
        {greeting}
        {first ? `, ${first}` : ""}
      </h1>
      <p className="dash-hero-sub">{date}</p>
    </header>
  );
}
