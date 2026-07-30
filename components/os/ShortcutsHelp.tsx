"use client";

// Small keyboard-shortcuts cheat sheet, opened with "?" from anywhere in the OS.
const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl K", "Open the command palette (search & jump)"],
  ["?", "Show this shortcuts panel"],
  ["↑ ↓", "Move through palette results"],
  ["↵", "Open the selected result"],
  ["Esc", "Close palette / this panel"],
];

export default function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div
        className="cmdk kbd-help"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="kbd-help-head">Keyboard shortcuts</div>
        <div className="kbd-help-list">
          {SHORTCUTS.map(([keys, desc]) => (
            <div className="kbd-help-row" key={keys}>
              <kbd className="kbd-help-key">{keys}</kbd>
              <span className="kbd-help-desc">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
