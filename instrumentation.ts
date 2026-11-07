import type { Instrumentation } from "next";

/**
 * Error monitoring without a vendor: unexpected server errors are filed as
 * deduplicated issues in the private support repo (lib/support/error-report.ts).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("@/lib/support/error-report");
  await reportServerError(error, {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
