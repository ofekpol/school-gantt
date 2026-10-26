"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  shouldPollPublicViewer,
  shouldRefreshPublicEvents,
  type PublicViewerEvent,
} from "@/lib/views/public-viewer";
import {
  PublicViewerEventSignatureResponseSchema,
  PublicViewerEventsResponseSchema,
} from "@/lib/validations/public-viewer";

export interface UsePublicViewerEventsArgs {
  accessToken: string;
  initialEvents: PublicViewerEvent[];
  initialEventsSignature: string;
}

/**
 * Keeps a school's public event list fresh: polls every 5s while the tab is
 * visible, skips the network round-trip when the signature hasn't changed,
 * and catches up immediately when the tab regains visibility after being
 * hidden. Shared by every unauthenticated public viewer surface (the full
 * 3-tab PublicViewerShell and the 2-tab ReadOnlyViewerShell).
 */
export function usePublicViewerEvents({
  accessToken,
  initialEvents,
  initialEventsSignature,
}: UsePublicViewerEventsArgs): PublicViewerEvent[] {
  const [events, setEvents] = useState(initialEvents);
  const [eventsSignature, setEventsSignature] = useState(initialEventsSignature);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const wasDocumentHidden = useRef(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    void refreshEventsIfChanged(accessToken, eventsSignature).then((result) => {
      if (!result) return;
      startTransition(() => {
        setEventsSignature(result.signature);
        if (result.events) setEvents(result.events);
      });
    });
  }, [eventsSignature, accessToken, startTransition]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = shouldPollPublicViewer(!document.hidden);
      if (!visible) wasDocumentHidden.current = true;
      setIsDocumentVisible(visible);
      if (visible && wasDocumentHidden.current) {
        wasDocumentHidden.current = false;
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    if (!shouldPollPublicViewer(isDocumentVisible)) return;
    const interval = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(interval);
  }, [isDocumentVisible, refresh]);

  return events;
}

async function fetchEvents(accessToken: string): Promise<PublicViewerEvent[] | null> {
  const response = await fetch(`/api/v1/public/${accessToken}/events`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventsResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.events : null;
}

async function refreshEventsIfChanged(
  accessToken: string,
  currentSignature: string,
): Promise<{ signature: string; events: PublicViewerEvent[] | null } | null> {
  const nextSignature = await fetchEventsSignature(accessToken);
  if (!nextSignature) return null;
  if (!shouldRefreshPublicEvents(currentSignature, nextSignature)) {
    return { signature: nextSignature, events: null };
  }

  const events = await fetchEvents(accessToken);
  return events ? { signature: nextSignature, events } : null;
}

async function fetchEventsSignature(accessToken: string): Promise<string | null> {
  const response = await fetch(`/api/v1/public/${accessToken}/events/signature`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventSignatureResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.signature : null;
}
