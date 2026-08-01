import { SpeedInsights } from "@vercel/speed-insights/next";

/** Avoid a missing /_vercel endpoint on self-hosted or local production builds. */
export function VercelSpeedInsights() {
  return process.env.VERCEL === "1" ? <SpeedInsights /> : null;
}
