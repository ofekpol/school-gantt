import Link from "next/link";

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
 * in the center, and an optional action slot on the end side. `currentPath`
 * lets the server-rendered header style the active link without becoming a
 * client component.
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
        <nav className="flex items-center gap-1 flex-wrap">
          {navLinks.map((link) => {
            const active =
              currentPath === link.href ||
              (link.href !== "/dashboard" &&
                currentPath?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href as never}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="flex items-center gap-3 shrink-0">{rightSlot}</div>
    </div>
  );
}
