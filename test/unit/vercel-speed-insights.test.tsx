import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VercelSpeedInsights } from "@/components/VercelSpeedInsights";

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div data-testid="speed-insights" />,
}));

const initialVercel = process.env.VERCEL;

afterEach(() => {
  cleanup();
  if (initialVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = initialVercel;
});

describe("VercelSpeedInsights", () => {
  it("does not request Vercel analytics from a local production server", () => {
    delete process.env.VERCEL;

    render(<VercelSpeedInsights />);

    expect(screen.queryByTestId("speed-insights")).not.toBeInTheDocument();
  });

  it("keeps Vercel analytics enabled on Vercel", () => {
    process.env.VERCEL = "1";

    render(<VercelSpeedInsights />);

    expect(screen.getByTestId("speed-insights")).toBeInTheDocument();
  });
});
