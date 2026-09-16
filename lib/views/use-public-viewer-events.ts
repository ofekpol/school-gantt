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
  schoolSlug: string;
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
  schoolSlug,
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
    void refreshEventsIfChanged(schoolSlug, eventsSignature).then((result) => {
      if (!result) return;
      startTransition(() => {
        setEventsSignature(result.signature);
        if (result.events) setEvents(result.events);
      });
    });
  }, [eventsSignature, schoolSlug, startTransition]);

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

async function fetchEvents(schoolSlug: string): Promise<PublicViewerEvent[] | null> {
  const response = await fetch(`/api/v1/public/${schoolSlug}/events`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventsResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.events : null;
}

async function refreshEventsIfChanged(
  schoolSlug: string,
  currentSignature: string,
): Promise<{ signature: string; events: PublicViewerEvent[] | null } | null> {
  const nextSignature = await fetchEventsSignature(schoolSlug);
  if (!nextSignature) return null;
  if (!shouldRefreshPublicEvents(currentSignature, nextSignature)) {
    return { signature: nextSignature, events: null };
  }

  const events = await fetchEvents(schoolSlug);
  return events ? { signature: nextSignature, events } : null;
}

async function fetchEventsSignature(schoolSlug: string): Promise<string | null> {
  const response = await fetch(`/api/v1/public/${schoolSlug}/events/signature`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventSignatureResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.signature : null;
}
