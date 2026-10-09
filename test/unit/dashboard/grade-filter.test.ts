import { describe, expect, it } from "vitest";
import {
  getDashboardGradeSelection,
  shouldShowDashboardGradeFilter,
  visibleWeeklyGrades,
} from "@/lib/dashboard/grade-filter";

describe("dashboard grade filtering", () => {
  it("defaults to an empty focus when the URL has no grade selection", () => {
    const selection = getDashboardGradeSelection([9, 10, 11], undefined);

    expect(selection.selectedGrades).toEqual([]);
    expect(selection.dataGrades).toEqual([9, 10, 11]);
  });

  it("keeps only requested grades that are inside the user's allowed grades", () => {
    const selection = getDashboardGradeSelection([9, 10, 11], ["10", "12", "bad"]);

    expect(selection.selectedGrades).toEqual([10]);
    expect(selection.dataGrades).toEqual([9, 10, 11]);
  });

  it("drops requested grades outside the user's permission", () => {
    const selection = getDashboardGradeSelection([10], ["11"]);

    expect(selection.selectedGrades).toEqual([]);
    expect(selection.dataGrades).toEqual([10]);
  });

  it("treats the legacy 'none' value as an empty focus", () => {
    const selection = getDashboardGradeSelection([9, 10, 11], "none");

    expect(selection.selectedGrades).toEqual([]);
    expect(selection.dataGrades).toEqual([9, 10, 11]);
  });

  it("shows focused weekly rows, or every allowed grade when nothing is focused", () => {
    expect(visibleWeeklyGrades([9, 10, 11], [])).toEqual([9, 10, 11]);
    expect(visibleWeeklyGrades([9, 10, 11], [11, 9])).toEqual([11, 9]);
    expect(visibleWeeklyGrades([9, 10], [12])).toEqual([9, 10]);
  });

  it("shows the picker only when more than one grade is allowed", () => {
    expect(shouldShowDashboardGradeFilter([10])).toBe(false);
    expect(shouldShowDashboardGradeFilter([9, 10])).toBe(true);
  });
});
