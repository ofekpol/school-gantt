import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Smart event adder — paste → review → fix → publish.
 *
 * The AI call is mocked with page.route so the run is deterministic and
 * needs no Groq key at the network layer; the dashboard still needs the AI
 * button, so the dev server must run with GROQ_API_KEY set. Publishing goes
 * through the real /api/v1/events/publish route.
 */
test.skip(
  process.env.ADMIN_E2E !== "1" || !process.env.DATABASE_URL,
  "ADMIN_E2E=1 and DATABASE_URL required — skipping DB+auth smart adder e2e",
);

test.use({ storageState: "test/e2e/.auth/editor.json" });

const stamp = Date.now();
const base = {
  endDate: null,
  dateHint: null,
  allDay: null,
  location: "",
  description: "",
};

const candidates = [
  { ...base, clientId: "a", title: `E2E טיול ${stamp}`, startDate: "2030-11-12", startTime: "08:00", endTime: "16:00", grades: [10], eventTypeId: null, warnings: [{ code: "uncertain_type" }] },
  { ...base, clientId: "b", title: `E2E מבחן ${stamp}`, startDate: "2030-11-13", startTime: "10:00", endTime: "11:00", grades: [], eventTypeId: null, warnings: [{ code: "missing_grades" }, { code: "uncertain_type" }] },
  { ...base, clientId: "c", title: `E2E כפול ${stamp}`, startDate: "2030-11-14", startTime: "10:00", endTime: "11:00", grades: [10], eventTypeId: null, warnings: [{ code: "uncertain_type" }, { code: "duplicate", eventId: "00000000-0000-0000-0000-000000000000", title: "קיים", date: "2030-11-14" }] },
];

async function fixCard(page: import("@playwright/test").Page, clientId: string, grade?: string) {
  const card = page.getByTestId(`adder-card-${clientId}`);
  await card.getByRole("button", { name: "ערוך" }).click();
  await card.getByLabel("סוג אירוע").selectOption({ label: "טיול" });
  if (grade) await card.getByRole("button", { name: grade, exact: true }).click();
  await card.getByRole("button", { name: "שמור" }).click();
  return card;
}

test("AI-ADDER: editor fixes flagged cards and publishes two events", async ({ page }) => {
  await page.route("**/api/v1/ai/parse-events", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates }) }),
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "הוספה חכמה" }).click();
  await page.getByLabel("הדביקו או כתבו את האירועים").fill("טיול, מבחן, כפול");
  await page.getByRole("button", { name: "זהה אירועים" }).click();

  await expect(page.getByText("לא צוינו שכבות – יש לבחור שכבות")).toBeVisible();
  const dialog = page.getByRole("dialog");
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await (await fixCard(page, "a")).getByRole("checkbox").check();
  await (await fixCard(page, "b", "י")).getByRole("checkbox").check();
  await expect(dialog.getByTestId("adder-card-c").getByRole("checkbox")).not.toBeChecked();

  await dialog.getByRole("button", { name: "פרסם 2 אירועים" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/dashboard?week=2030-11-10");
  await expect(page.getByText(`E2E טיול ${stamp}`).locator("visible=true").first()).toBeVisible();
  await expect(page.getByText(`E2E מבחן ${stamp}`).locator("visible=true").first()).toBeVisible();
});
