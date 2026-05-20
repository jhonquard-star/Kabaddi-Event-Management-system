const REFEREE_SESSION_PREFIX = "kabaddi_referee_session_";
const REFEREE_SUMMARY_KEY_PREFIX = "kabaddi_referee_summary_";

export const OFFICIAL_ROLES = [
  "chief-referee",
  "umpire-1",
  "umpire-2",
  "lineman-1",
  "lineman-2",
  "chief-scorer",
  "asst-scorer-1",
  "asst-scorer-2",
];

export const ROLE_LABELS = {
  "chief-referee": "Chief Referee",
  "umpire-1": "Court Umpire 1",
  "umpire-2": "Court Umpire 2",
  "lineman-1": "Line Umpire 1",
  "lineman-2": "Line Umpire 2",
  "chief-scorer": "Chief Scorer",
  "asst-scorer-1": "Assistant Scorer 1",
  "asst-scorer-2": "Assistant Scorer 2",
};

const safeParse = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getSessionKey = (matchId, role) =>
  `${REFEREE_SESSION_PREFIX}${matchId || "unassigned"}_${role || "role"}`;

const getSummaryKey = (matchId) =>
  `${REFEREE_SUMMARY_KEY_PREFIX}${matchId || "unassigned"}`;

const defaultSession = (matchId, role) => ({
  matchId: matchId || "",
  role: role || "",
  timerActive: false,
  timer: 1200,
  timerAtStart: 1200,
  timerLastStartedAt: null,
  half: 1,
  scoreA: 0,
  scoreB: 0,
  events: [],
  halfSnapshots: [],
  completed: false,
  updatedAt: new Date().toISOString(),
});

export const readRefereeSession = (matchId, role) => {
  if (typeof window === "undefined" || !matchId || !role) {
    return defaultSession(matchId, role);
  }

  const raw = window.localStorage.getItem(getSessionKey(matchId, role));
  const parsed = safeParse(raw, null);
  return {
    ...defaultSession(matchId, role),
    ...(parsed || {}),
    matchId,
    role,
    events: Array.isArray(parsed?.events) ? parsed.events : [],
    halfSnapshots: Array.isArray(parsed?.halfSnapshots)
      ? parsed.halfSnapshots
      : [],
  };
};

export const hasStoredRefereeSession = (matchId, role) => {
  if (typeof window === "undefined" || !matchId || !role) return false;
  return window.localStorage.getItem(getSessionKey(matchId, role)) !== null;
};

export const writeRefereeSession = (matchId, role, patch) => {
  if (typeof window === "undefined" || !matchId || !role)
    return defaultSession(matchId, role);
  const next = {
    ...readRefereeSession(matchId, role),
    ...patch,
    matchId,
    role,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    getSessionKey(matchId, role),
    JSON.stringify(next),
  );
  return next;
};

export const recordHalfSnapshot = (matchId, role, half) => {
  const session = readRefereeSession(matchId, role);
  const nextSnapshot = {
    half: Number(half || session.half || 1),
    scoreA: Number(session.scoreA || 0),
    scoreB: Number(session.scoreB || 0),
    timer: Number(session.timer || 0),
    recordedAt: new Date().toISOString(),
  };

  const filtered = session.halfSnapshots.filter(
    (snapshot) => Number(snapshot.half) !== nextSnapshot.half,
  );

  return writeRefereeSession(matchId, role, {
    halfSnapshots: [...filtered, nextSnapshot],
  });
};

export const getAllRefereeSessions = (matchId) =>
  OFFICIAL_ROLES.map((role) => readRefereeSession(matchId, role));

export const calculateMatchEvaluation = (matchId, match = null) => {
  const sessions = getAllRefereeSessions(matchId).filter(
    (session) =>
      session.scoreA ||
      session.scoreB ||
      session.events.length > 0 ||
      session.halfSnapshots.length > 0,
  );

  const scoreA = sessions.reduce(
    (total, session) => total + Number(session.scoreA || 0),
    0,
  );
  const scoreB = sessions.reduce(
    (total, session) => total + Number(session.scoreB || 0),
    0,
  );
  const winner =
    scoreA === scoreB
      ? "Draw"
      : scoreA > scoreB
        ? match?.teamAName || "Team A"
        : match?.teamBName || "Team B";
  const margin = Math.abs(scoreA - scoreB);
  const roleSummaries = sessions.map((session) => ({
    role: session.role,
    roleLabel: ROLE_LABELS[session.role] || session.role,
    scoreA: Number(session.scoreA || 0),
    scoreB: Number(session.scoreB || 0),
    timer: Number(session.timer || 0),
    half: Number(session.half || 1),
    events: Array.isArray(session.events) ? session.events.length : 0,
    halfSnapshots: Array.isArray(session.halfSnapshots)
      ? session.halfSnapshots.length
      : 0,
    updatedAt: session.updatedAt,
  }));

  const allEvents = sessions
    .flatMap((session) =>
      (Array.isArray(session.events) ? session.events : []).map((event) => ({
        ...event,
        roleAction: event.roleAction || session.role,
      })),
    )
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  return {
    scoreA,
    scoreB,
    winner,
    margin,
    status: scoreA === scoreB ? "draw" : "decided",
    roleSummaries,
    events: allEvents,
    finishedAt: new Date().toISOString(),
    halfRecords: sessions.flatMap((session) =>
      (Array.isArray(session.halfSnapshots) ? session.halfSnapshots : []).map(
        (snapshot) => ({
          ...snapshot,
          role: session.role,
          roleLabel: ROLE_LABELS[session.role] || session.role,
        }),
      ),
    ),
  };
};

export const saveFinalMatchSummary = (matchId, summary) => {
  if (typeof window === "undefined" || !matchId) return;
  window.localStorage.setItem(getSummaryKey(matchId), JSON.stringify(summary));
};

export const readFinalMatchSummary = (matchId) => {
  if (typeof window === "undefined" || !matchId) return null;
  return safeParse(window.localStorage.getItem(getSummaryKey(matchId)), null);
};

export const clearMatchSessions = (matchId) => {
  if (typeof window === "undefined" || !matchId) return;
  OFFICIAL_ROLES.forEach((role) => {
    window.localStorage.removeItem(getSessionKey(matchId, role));
  });
  window.localStorage.removeItem(getSummaryKey(matchId));
};
