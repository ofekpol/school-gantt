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
  const hasTitle = Boolean(title || subtitle);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <div className="min-w-0 justify-self-start">
        {hasTitle && (
          <>
            {title && <h1 className="truncate text-base font-semibold">{title}</h1>}
            {subtitle && (
              <p className="truncate text-xs text-neutral-500">{subtitle}</p>
            )}
          </>
        )}
      </div>
      {navLinks && navLinks.length > 0 && (
        <AppHeaderNav links={navLinks} initialPath={currentPath} />
      )}
      <div className="flex shrink-0 items-center gap-3 justify-self-end">
        {rightSlot}
      </div>
    </div>
  );
}
