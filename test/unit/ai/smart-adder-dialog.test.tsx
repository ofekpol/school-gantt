import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cand, eventTypes, fakeT } from "./adder-fixtures";

vi.mock("next-intl", () => ({ useTranslations: () => fakeT }));

import { SmartAdderDialog } from "@/components/ai/SmartAdderDialog";

const fetchMock = vi.fn();

function json(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function renderDialog(onPublished = vi.fn()) {
  render(
    <SmartAdderDialog open onClose={() => undefined} onPublished={onPublished} eventTypes={eventTypes} allowedGrades={[7, 8]} />,
  );
  return { onPublished };
}

async function parse(text = "טיול שנתי לח' 12/11/26") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("inputLabel"), text);
  await user.click(screen.getByRole("button", { name: "detect" }));
  return user;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
});

describe("SmartAdderDialog", () => {
  it("failed parse keeps the text and shows the ai_unavailable message", async () => {
    fetchMock.mockReturnValueOnce(json(502, { error: "ai_unavailable" }));
    renderDialog();
    await parse("טיול 12/11/26");
    expect(await screen.findByText("errors.ai_unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("inputLabel")).toHaveValue("טיול 12/11/26");
  });

  it("shows the no-events message for an empty result", async () => {
    fetchMock.mockReturnValueOnce(json(200, { candidates: [] }));
    renderDialog();
    await parse();
    expect(await screen.findByText("errors.no_events")).toBeInTheDocument();
  });

  it("publish button counts only checked, complete cards", async () => {
    fetchMock.mockReturnValueOnce(
      json(200, {
        candidates: [
          cand({ clientId: "a" }),
          cand({ clientId: "b", grades: [], warnings: [{ code: "missing_grades" }] }),
          cand({ clientId: "c", warnings: [{ code: "duplicate", eventId: "e1", title: "t", date: "2026-11-12" }] }),
        ],
      }),
    );
    renderDialog();
    await parse();
    expect(await screen.findByRole("button", { name: 'publish{"count":1}' })).toBeEnabled();
  });

  it("filling a missing field via edit makes the card publishable", async () => {
    fetchMock.mockReturnValueOnce(json(200, { candidates: [cand({ clientId: "b", grades: [] })] }));
    renderDialog();
    const user = await parse();
    const card = await screen.findByTestId("adder-card-b");
    await user.click(within(card).getByRole("button", { name: "edit" }));
    await user.click(within(card).getByRole("button", { name: "label_7" }));
    await user.click(within(card).getByRole("button", { name: "save" }));
    await user.click(within(card).getByRole("checkbox", { name: /include/ }));
    expect(screen.getByRole("button", { name: 'publish{"count":1}' })).toBeEnabled();
  });

  it("publishes one request per checked card, removes successes, keeps failures", async () => {
    fetchMock
      .mockReturnValueOnce(json(200, { candidates: [cand({ clientId: "a" }), cand({ clientId: "b", title: "מבחן" })] }))
      .mockReturnValueOnce(json(201, { id: "new-a", version: 1, status: "approved" }))
      .mockReturnValueOnce(json(403, { error: "scope_violation" }));
    const { onPublished } = renderDialog();
    const user = await parse();
    await user.click(await screen.findByRole("button", { name: 'publish{"count":2}' }));

    const publishCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/v1/events/publish");
    expect(publishCalls).toHaveLength(2);
    expect(JSON.parse(publishCalls[0][1].body)).toMatchObject({ title: "טיול שנתי", grades: [8] });
    expect(await screen.findByText("errors.publish_failed")).toBeInTheDocument();
    expect(screen.queryByTestId("adder-card-a")).not.toBeInTheDocument();
    expect(screen.getByTestId("adder-card-b")).toBeInTheDocument();
    expect(onPublished).not.toHaveBeenCalled();
  });

  it("calls onPublished when every checked card succeeds", async () => {
    fetchMock
      .mockReturnValueOnce(json(200, { candidates: [cand({ clientId: "a" })] }))
      .mockReturnValueOnce(json(201, { id: "new-a", version: 1, status: "approved" }));
    const { onPublished } = renderDialog();
    const user = await parse();
    await user.click(await screen.findByRole("button", { name: 'publish{"count":1}' }));
    await vi.waitFor(() => expect(onPublished).toHaveBeenCalledWith(1));
  });
});
