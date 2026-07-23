"use client";

export function CalendarViewToggle({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--sg-studio-violet)] text-white shadow-sm"
          : "bg-[var(--sg-studio-violet-soft)] text-[var(--sg-ink)] hover:bg-violet-100"
      }`}
    >
      {children}
    </button>
  );
}
