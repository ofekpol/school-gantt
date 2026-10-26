import Link from "next/link";
import { useTranslations } from "next-intl";

interface SchoolPickerProps {
  schools: Array<{ slug: string; name: string }>;
}

/** Guest entry when the deployment hosts several schools: pick one to view. */
export function SchoolPicker({ schools }: SchoolPickerProps) {
  const t = useTranslations("schedule.schoolPicker");
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 p-8 border rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-center">{t("title")}</h1>
        <ul className="space-y-2">
          {schools.map((school) => (
            <li key={school.slug}>
              <Link
                href={{ pathname: "/schedule", query: { school: school.slug } }}
                className="block w-full rounded-md border px-4 py-2 text-start hover:bg-accent"
              >
                {school.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
