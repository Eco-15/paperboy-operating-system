"use client";

// A token-styled toggle. The real <input type="checkbox"> stays in the DOM (just
// transparent over the track) so keyboard focus, screen readers, and form
// semantics all work for free — the track/thumb are painted around it.
export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" />
      <span className="switch-thumb" />
    </span>
  );
}
