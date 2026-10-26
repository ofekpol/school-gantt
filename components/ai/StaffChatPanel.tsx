"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_CHARS = 500;
const MAX_HISTORY = 10;
const KNOWN_ERRORS = new Set(["quota_exceeded", "ai_unavailable", "ai_disabled", "invalid_input"]);

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ErrorState {
  code: string;
  limit?: number;
}

async function readError(res: Response): Promise<ErrorState> {
  const body = (await res.json().catch(() => null)) as { error?: string; limit?: number } | null;
  return { code: body?.error && KNOWN_ERRORS.has(body.error) ? body.error : "ai_unavailable", limit: body?.limit };
}

/** Streams the reply text, calling `onText` with the accumulated answer. */
async function readStream(res: Response, onText: (text: string) => void): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return text;
}

function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const setReply = (text: string) =>
    setMessages((list) => [...list.slice(0, -1), { role: "assistant", content: text }]);

  async function send(question: string) {
    const history = [...messages, { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
    }).catch(() => null);
    const reply = res?.ok ? await readStream(res, setReply).catch(() => "") : "";
    setBusy(false);
    if (reply.trim()) return;
    setMessages(history);
    setError(res && !res.ok ? await readError(res) : { code: "ai_unavailable" });
  }

  return { messages, busy, error, send };
}

/** Floating staff calendar assistant (staff pages only). */
export function StaffChatPanel() {
  const t = useTranslations("aiChat");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, busy, error, send } = useChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) openButtonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function submit() {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    void send(question);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <>
      {!open && (
        <button ref={openButtonRef} type="button" aria-label={t("open")} onClick={() => setOpen(true)}
          className="fixed bottom-4 end-4 z-40 grid size-14 place-items-center rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 print:hidden">
          <MessageCircle className="size-6" aria-hidden="true" />
        </button>
      )}
      {open && (
        <section role="dialog" aria-label={t("title")} dir="rtl"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s border-[var(--sg-hairline)] bg-white shadow-xl sm:w-96 print:hidden">
          <header className="flex items-center justify-between border-b border-[var(--sg-hairline)] px-4 py-3">
            <h2 className="font-semibold">{t("title")}</h2>
            <button type="button" aria-label={t("close")} onClick={() => setOpen(false)}
              className="grid size-8 place-items-center rounded-full hover:bg-[var(--sg-surface-2)]">
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.length === 0 && <li className="text-sm text-[var(--sg-ink-soft)]">{t("empty")}</li>}
            {messages.map((m, i) =>
              m.content ? (
                <li key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "ms-auto bg-sky-600 text-white" : "me-auto bg-[var(--sg-surface-2)]")}>
                  {m.content}
                </li>
              ) : null,
            )}
            {busy && messages.at(-1)?.content === "" && <li className="text-sm text-[var(--sg-ink-soft)]">{t("thinking")}</li>}
          </ol>
          {error && (
            <p role="alert" className="px-4 pb-2 text-sm text-red-700">
              {t(`errors.${error.code}`, error.limit !== undefined ? { limit: error.limit } : undefined)}
            </p>
          )}
          <div className="flex items-end gap-2 border-t border-[var(--sg-hairline)] p-3">
            <textarea ref={inputRef} rows={2} maxLength={MAX_CHARS} value={draft} aria-label={t("placeholder")}
              placeholder={t("placeholder")} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
              className="flex-1 resize-none rounded-xl border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white" />
            <button type="button" onClick={submit} disabled={busy || !draft.trim()} aria-label={t("send")}
              className="grid size-10 place-items-center rounded-xl bg-sky-600 text-white disabled:opacity-50">
              <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}
