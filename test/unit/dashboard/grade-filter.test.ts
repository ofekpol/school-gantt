import { describe, expect, it } from "vitest";
import {
  getDashboardGradeSelection,
  shouldShowDashboardGradeFilter,
} from "@/lib/dashboard/grade-filter";

describe("dashboard grade filtering", () => {
  it("defaults to every allowed grade when the URL has no grade filter", () => {
    const selection = getDashboardGradeSelection([9, 10, 11], undefined);

    expect(selection.selectedGrades).toEqual([9, 10, 11]);
    expect(selection.dataGrades).toEqual([9, 10, 11]);
  });

  it("keeps only requested grades that are inside the user's allowed grades", () => {
    const selection = getDashboardGradeSelection([9, 10, 11], ["10", "12", "bad"]);

    expect(selection.selectedGrades).toEqual([10]);
    expect(selection.dataGrades).toEqual([9, 10, 11]);
  });

  it("falls back to every allowed grade when requested grades are outside permission", () => {
    const selection = getDashboardGradeSelection([10], ["11"]);

    expect(selection.selectedGrades).toEqual([10]);
    expect(selection.dataGrades).toEqual([10]);
  });

  it("preserves an explicit empty grade selection", () => {
    const selection = getDashboardGradeSelection([9, 10, 11], "none");

    expect(selection.selectedGrades).toEqual([]);
    expect(selection.dataGrades).toEqual([9, 10, 11]);
  });

  it("shows the picker only when more than one grade is allowed", () => {
    expect(shouldShowDashboardGradeFilter([10])).toBe(false);
    expect(shouldShowDashboardGradeFilter([9, 10])).toBe(true);
  });
});
