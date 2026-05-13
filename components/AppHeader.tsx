import { LocaleToggle } from "@/components/LocaleToggle";

interface Props {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

/**
 * Shared app header — title/subtitle on the start side, slot + locale
 * toggle on the end side. Used by route-group layouts so locale is
 * switchable from every authenticated and public page.
 */
export function AppHeader({ title, subtitle, rightSlot }: Props) {
  return (
    <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
        {subtitle && (
          <p className="text-xs text-neutral-500 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {rightSlot}
        <LocaleToggle />
      </div>
    </div>
  );
}
