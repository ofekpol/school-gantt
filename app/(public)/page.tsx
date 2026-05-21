import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { getPostLoginRedirect } from "@/lib/auth/redirects";

/**
 * Root entrypoint.
 * Users no longer pick a school manually; their staff account determines the
 * school calendar they should land on after authentication.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getStaffUser();
  redirect(getPostLoginRedirect(user));
}
