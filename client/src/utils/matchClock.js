const DEFAULT_HALF_DURATION = 1200;

export const readSharedMatchClock = (match) => {
  const fallbackTimer = Number(match?.timer ?? DEFAULT_HALF_DURATION);
  const fallbackHalf = Number(match?.half ?? 1);

  if (!match?.id || typeof window === "undefined") {
    return {
      timer: fallbackTimer,
      timerActive: Boolean(match?.timerActive),
      half: fallbackHalf,
      timerAtStart: Number(match?.timerAtStart ?? fallbackTimer),
      timerLastStartedAt: match?.timerLastStartedAt ?? null,
    };
  }

  const active =
    window.localStorage.getItem(`kabaddi_timer_active_${match.id}`) === "true";
  const lastStarted = window.localStorage.getItem(
    `kabaddi_timer_last_started_at_${match.id}`,
  );
  const atStart = window.localStorage.getItem(
    `kabaddi_timer_at_start_${match.id}`,
  );
  const paused = window.localStorage.getItem(`kabaddi_timer_${match.id}`);
  const half = window.localStorage.getItem(`kabaddi_match_half_${match.id}`);

  if (active && lastStarted) {
    const elapsed = Math.floor((Date.now() - Number(lastStarted)) / 1000);
    const timerAtStart = Number(atStart || fallbackTimer);
    return {
      timerActive: true,
      timer: Math.max(0, timerAtStart - elapsed),
      timerAtStart,
      timerLastStartedAt: Number(lastStarted),
      half: Number(half || fallbackHalf),
    };
  }

  return {
    timerActive: false,
    timer: Number(paused || fallbackTimer),
    timerAtStart: Number(atStart || fallbackTimer),
    timerLastStartedAt: lastStarted ? Number(lastStarted) : null,
    half: Number(half || fallbackHalf),
  };
};

export const formatMatchClock = (seconds) => {
  const totalSeconds = Math.max(0, Number(seconds || 0));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};
