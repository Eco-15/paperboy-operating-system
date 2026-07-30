"use client";

// Bottom sheet with native-app behavior:
//  • slides up from the bottom, backdrop tap closes, drag the handle down to
//    dismiss (>90px), content scrolls internally (max 88dvh);
//  • CRITICAL: opening pushes a history entry, so the iOS back-swipe (and the
//    Android back button) closes the sheet instead of leaving the app. Sheets
//    can stack (person → deal): each entry carries a depth so popping one
//    entry only closes the topmost sheet.
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import s from "./mobile.module.css";

// Module-level depth counter shared by every stacked sheet instance.
let sheetDepth = 0;

export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount → next frame slide up; close → slide down, unmount after the
  // transition so the exit animation is visible.
  useEffect(() => {
    if (open) {
      setRender(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setRender(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  // History integration.
  useEffect(() => {
    if (!open) return;
    sheetDepth += 1;
    const myDepth = sheetDepth;
    let popped = false;
    try {
      window.history.pushState({ pbmSheet: myDepth }, "");
    } catch {
      /* history can throw in exotic embeds — sheet still works, just no back-swipe close */
    }
    const onPop = (e: PopStateEvent) => {
      const depth =
        e.state && typeof e.state.pbmSheet === "number" ? (e.state.pbmSheet as number) : 0;
      if (depth < myDepth) {
        popped = true;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      sheetDepth = myDepth - 1;
      if (!popped) {
        // Closed programmatically (backdrop/drag/button) — retire our entry.
        try {
          window.history.back();
        } catch {
          /* noop */
        }
      }
    };
  }, [open]);

  // Drag-to-dismiss on the grab zone.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef(0);
  const dragDist = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragDist.current = 0;
    dragStart.current = e.touches[0].clientY;
    const el = sheetRef.current;
    if (el) el.style.transition = "none";
  };
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dy = Math.max(0, e.touches[0].clientY - dragStart.current);
    dragDist.current = dy;
    const el = sheetRef.current;
    if (el) el.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const el = sheetRef.current;
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
    }
    if (dragDist.current > 90) onCloseRef.current();
    dragDist.current = 0;
  };

  if (!render) return null;

  return (
    <div className={`${s.sheetWrap}${shown ? ` ${s.sheetOpen}` : ""}`}>
      <div className={s.backdrop} onClick={() => onCloseRef.current()} />
      <div className={s.sheet} ref={sheetRef} role="dialog" aria-modal="true">
        <div
          className={s.grab}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className={s.handle} />
          {title ? <div className={s.sheetTitle}>{title}</div> : null}
        </div>
        <div className={s.sheetBody}>{children}</div>
      </div>
    </div>
  );
}
