import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * Keep this segment data-free so its loading boundary can stream before
 * public school data is resolved by the selected page.
 */
export default function ViewerSchoolLayout({ children }: Props) {
  return children;
}
