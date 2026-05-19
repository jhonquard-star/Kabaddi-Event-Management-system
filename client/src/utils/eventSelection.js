export const ACTIVE_EVENT_KEY = "kms_active_event";
export const EVENT_CHANGE_EVENT = "kms:event-change";
export const ACTIVE_MATCH_KEY_PREFIX = "kms_active_match_";
export const MATCH_CHANGE_EVENT = "kms:match-change";

export const getActiveEventId = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_EVENT_KEY) || "";
};

export const setActiveEventId = (eventId) => {
  if (typeof window === "undefined") return;
  const nextId = eventId || "";
  window.localStorage.setItem(ACTIVE_EVENT_KEY, nextId);
  window.dispatchEvent(
    new CustomEvent(EVENT_CHANGE_EVENT, {
      detail: { eventId: nextId },
    }),
  );
};

export const getActiveMatchId = (eventId) => {
  if (typeof window === "undefined") return "";
  const activeEventId = eventId || getActiveEventId();
  if (!activeEventId) return "";
  return (
    window.localStorage.getItem(`${ACTIVE_MATCH_KEY_PREFIX}${activeEventId}`) ||
    ""
  );
};

export const setActiveMatchId = (matchId, eventId) => {
  if (typeof window === "undefined") return;
  const activeEventId = eventId || getActiveEventId();
  if (!activeEventId) return;
  const nextMatchId = matchId || "";
  window.localStorage.setItem(
    `${ACTIVE_MATCH_KEY_PREFIX}${activeEventId}`,
    nextMatchId,
  );
  window.dispatchEvent(
    new CustomEvent(MATCH_CHANGE_EVENT, {
      detail: { eventId: activeEventId, matchId: nextMatchId },
    }),
  );
};

export const clearActiveMatchId = (eventId) => {
  if (typeof window === "undefined") return;
  const activeEventId = eventId || getActiveEventId();
  if (!activeEventId) return;
  window.localStorage.removeItem(`${ACTIVE_MATCH_KEY_PREFIX}${activeEventId}`);
  window.dispatchEvent(
    new CustomEvent(MATCH_CHANGE_EVENT, {
      detail: { eventId: activeEventId, matchId: "" },
    }),
  );
};
