import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeT } from "./adder-fixtures";

vi.mock("next-intl", () => ({ useTranslations: () => fakeT }));

import { StaffChatPanel } from "@/components/ai/StaffChatPanel";

const fetchMock = vi.fn();

function streamResponse(parts: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      parts.forEach((p) => controller.enqueue(encoder.encode(p)));
      controller.close();
    },
  });
  return Promise.resolve(new Response(body, { status: 200 }));
}

async function openAndAsk(question: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "open" }));
  await user.type(screen.getByLabelText("placeholder"), `${question}{Enter}`);
  return user;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StaffChatPanel", () => {
  it("opens the panel and focuses the input", async () => {
    render(<StaffChatPanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByRole("dialog", { name: "title" })).toBeInTheDocument();
    expect(screen.getByLabelText("placeholder")).toHaveFocus();
  });

  it("streams the assistant reply into the list", async () => {
    fetchMock.mockReturnValueOnce(streamResponse(["יש ", "טיול ", "מחר"]));
    render(<StaffChatPanel />);
    await openAndAsk("מה יש מחר?");
    expect(await screen.findByText("יש טיול מחר")).toBeInTheDocument();
    expect(screen.getByText("מה יש מחר?")).toBeInTheDocument();
  });

  it("sends at most the last 10 messages", async () => {
    for (let i = 0; i < 6; i++) fetchMock.mockReturnValueOnce(streamResponse([`תשובה ${i}`]));
    render(<StaffChatPanel />);
    const user = await openAndAsk("שאלה 0");
    await screen.findByText("תשובה 0");
    for (let i = 1; i < 6; i++) {
      await user.type(screen.getByLabelText("placeholder"), `שאלה ${i}{Enter}`);
      await screen.findByText(`תשובה ${i}`);
    }
    const last = JSON.parse(fetchMock.mock.calls[5][1].body) as { messages: { role: string; content: string }[] };
    expect(last.messages).toHaveLength(10);
    expect(last.messages.at(-1)).toEqual({ role: "user", content: "שאלה 5" });
  });

  it("shows the quota message on 429", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify({ error: "quota_exceeded", limit: 50 }), { status: 429 })),
    );
    render(<StaffChatPanel />);
    await openAndAsk("שאלה");
    expect(await screen.findByText('errors.quota_exceeded{"limit":50}')).toBeInTheDocument();
  });

  it("shows ai_unavailable when the stream comes back empty", async () => {
    fetchMock.mockReturnValueOnce(streamResponse([]));
    render(<StaffChatPanel />);
    await openAndAsk("שאלה");
    expect(await screen.findByText("errors.ai_unavailable")).toBeInTheDocument();
  });

  it("Esc closes and returns focus to the open button", async () => {
    render(<StaffChatPanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "open" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "open" })).toHaveFocus();
  });
});
