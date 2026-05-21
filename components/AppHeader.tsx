import { AppHeaderNav } from "@/components/AppHeaderNav";

export interface AppHeaderNavLink {
  href: string;
  label: string;
}

interface Props {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  navLinks?: AppHeaderNavLink[];
  currentPath?: string;
}

/**
 * Shared app header — title/subtitle on the start side, optional nav links
 * in the center, and an optional action slot on the end side.
 */
export function AppHeader({
  title,
  subtitle,
  rightSlot,
  navLinks,
  currentPath,
}: Props) {
  return (
    <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
        {subtitle && (
          <p className="text-xs text-neutral-500 truncate">{subtitle}</p>
        )}
      </div>
      {navLinks && navLinks.length > 0 && (
        <AppHeaderNav links={navLinks} initialPath={currentPath} />
      )}
      <div className="flex items-center gap-3 shrink-0">{rightSlot}</div>
    </div>
  );
}
