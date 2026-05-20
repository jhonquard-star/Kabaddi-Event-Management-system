const getTeamName = (match, teamKey) => {
  if (teamKey === "A") return match?.teamAName || "Team A";
  if (teamKey === "B") return match?.teamBName || "Team B";
  return "System";
};

const normalizeEvents = (events) => (Array.isArray(events) ? events : []);

export const recalculateMatchFromEvents = (match, eventsInput) => {
  const events = normalizeEvents(eventsInput);
  let scoreA = 0;
  let scoreB = 0;

  events.forEach((event) => {
    const points = Number(event?.points || 0);
    if (points <= 0) return;

    const isTeamA = event.teamKey === "A" || event.team === match?.teamAName;
    const isTeamB = event.teamKey === "B" || event.team === match?.teamBName;

    if (isTeamA) {
      scoreA += points;
    } else if (isTeamB) {
      scoreB += points;
    }
  });

  const winner =
    scoreA === scoreB
      ? "Draw"
      : scoreA > scoreB
        ? getTeamName(match, "A")
        : getTeamName(match, "B");

  return {
    scoreA,
    scoreB,
    winner,
    margin: Math.abs(scoreA - scoreB),
    status: scoreA === scoreB ? "draw" : "decided",
    events,
    finishedAt: new Date().toISOString(),
  };
};

export const undoLastMatchEvent = (match) => {
  const events = normalizeEvents(match?.events);
  if (events.length === 0) {
    return null;
  }

  const nextEvents = events.slice(0, -1);
  return recalculateMatchFromEvents(match, nextEvents);
};

export const buildEventLabel = (event) => {
  if (!event) return "";
  if (Number(event.points || 0) > 0) {
    return `${event.team || "Team"}: ${event.type}${event.points ? ` (+${event.points})` : ""}`;
  }
  return `${event.team || "Match Official"}: ${event.type}`;
};

export const formatPoolLabel = (poolValue) => {
  if (poolValue === null || poolValue === undefined || poolValue === "") {
    return "";
  }

  const normalized = String(poolValue).trim();
  if (/^pool\s+/i.test(normalized)) {
    return normalized.replace(/^pool\s+/i, "Pool ");
  }

  return `Pool ${normalized.toUpperCase()}`;
};

export const formatFixtureLabel = (fixture) => {
  if (!fixture) return "";

  if (String(fixture.stage || "").toLowerCase() === "knockout") {
    return fixture.round || "Knockout";
  }

  if (fixture.pool) {
    return formatPoolLabel(fixture.pool);
  }

  return fixture.round || "";
};
