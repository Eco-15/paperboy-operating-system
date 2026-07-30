"use client";

import { useEffect, useRef, type RefObject } from "react";
import s from "./mobile.module.css";

/**
 * Pull-to-refresh. Translates `innerRef` while `paneRef` sits at scrollTop 0 and
 * the finger drags down; past 70px it calls onRefresh. Touch-only by
 * construction, smooth (direct style writes, no re-renders), and cancelable —
 * drag back up and it springs home.
 */
export function usePullToRefresh(
  paneRef: RefObject<HTMLElement | null>,
  innerRef: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
) {
  // Held in a ref so the listeners below are attached exactly once.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const refreshing = useRef(false);

  useEffect(() => {
    const el = paneRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;

    let startY = 0;
    let pulling = false;
    let dist = 0;

    const settle = (y: number, animate: boolean) => {
      inner.style.transition = animate ? "transform .3s var(--spring)" : "none";
      inner.style.transform = y ? `translateY(${y}px)` : "";
      if (!y) inner.style.setProperty("--pull", "0");
    };

    const onStart = (e: globalThis.TouchEvent) => {
      if (el.scrollTop > 0 || refreshing.current) return;
      startY = e.touches[0].clientY;
      pulling = true;
      dist = 0;
    };
    const onMove = (e: globalThis.TouchEvent) => {
      if (!pulling || refreshing.current) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || el.scrollTop > 0) {
        if (dist !== 0) settle(0, false);
        dist = 0;
        return;
      }
      e.preventDefault();
      dist = Math.min(110, dy * 0.45);
      inner.style.transition = "none";
      inner.style.transform = `translateY(${dist}px)`;
      inner.style.setProperty("--pull", String(Math.min(1, dist / 70)));
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      if (refreshing.current) return;
      if (dist >= 70) {
        refreshing.current = true;
        inner.classList.add(s.pullSpinning);
        settle(52, true);
        void onRefreshRef.current().finally(() => {
          refreshing.current = false;
          inner.classList.remove(s.pullSpinning);
          settle(0, true);
        });
      } else {
        settle(0, true);
      }
      dist = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [paneRef, innerRef]);
}
