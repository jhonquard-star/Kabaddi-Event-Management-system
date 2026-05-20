import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, Circle, Shield, Slash, Trophy } from "lucide-react";
import { API_URL } from "../utils/apiBase";
import { formatMatchClock, readSharedMatchClock } from "../utils/matchClock";
import {
  EVENT_CHANGE_EVENT,
  MATCH_CHANGE_EVENT,
  getActiveEventId,
  getActiveMatchId,
  setActiveMatchId,
} from "../utils/eventSelection";
import { undoLastMatchEvent } from "../utils/matchScoring";

const touchPoints = [1, 2, 3, 4, 5, 6, 7];

const defaultStats = {
  bonus: 0,
  tackle: 0,
  lona: 0,
  redCard: 0,
  yellowCard: 0,
  greenCard: 0,
  touchPoints: 0,
};

const scoringActions = [
  { key: "bonus", label: "Bonus Point", category: "Raid" },
  { key: "tackle", label: "Tackle Point", category: "Defense" },
  { key: "lona", label: "Lona / All-Out", category: "Match Event" },
  { key: "redCard", label: "Red Card", category: "Discipline" },
  { key: "yellowCard", label: "Yellow Card", category: "Discipline" },
  { key: "greenCard", label: "Green Card", category: "Discipline" },
];

const ScoringOptions = () => {
  const [stats, setStats] = useState(defaultStats);
  const [selectedAction, setSelectedAction] = useState("bonus");
  const [recentEvents, setRecentEvents] = useState([]);
  const [eventId, setEventId] = useState(getActiveEventId());
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(
    getActiveMatchId(getActiveEventId()),
  );
  const [selectedTeam, setSelectedTeam] = useState("A");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [sharedClock, setSharedClock] = useState({
    timer: 1200,
    timerActive: false,
    half: 1,
  });

  useEffect(() => {
    const fetchLiveMatches = async () => {
      if (!eventId) {
        setLiveMatches([]);
        setSelectedMatch(null);
        return;
      }

      try {
        const res = await axios.get(
          `${API_URL}/api/matches/scoreboard/live-games`,
          {
            params: { eventId },
          },
        );
        const currentLiveMatches = Array.isArray(res.data?.liveMatches)
          ? res.data.liveMatches
          : [];
        setLiveMatches(currentLiveMatches);

        const persistedMatchId = getActiveMatchId(eventId);
        const candidateId =
          selectedMatchId ||
          persistedMatchId ||
          currentLiveMatches[0]?.id ||
          "";
        const activeMatch =
          currentLiveMatches.find((match) => match.id === candidateId) ||
          currentLiveMatches[0] ||
          null;

        if (activeMatch?.id && activeMatch.id !== selectedMatchId) {
          setSelectedMatchId(activeMatch.id);
          setActiveMatchId(activeMatch.id, eventId);
        }

        setSelectedMatch(activeMatch);
      } catch (err) {
        console.error("Failed to load live matches:", err);
        setLiveMatches([]);
        setSelectedMatch(null);
      }
    };

    fetchLiveMatches();

    const onEventChange = (evt) => {
      setEventId(evt.detail?.eventId || getActiveEventId());
    };
    const onMatchChange = (evt) => {
      if (evt.detail?.eventId && evt.detail.eventId !== eventId) return;
      setSelectedMatchId(evt.detail?.matchId || "");
    };

    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    window.addEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    return () => {
      window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
      window.removeEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    };
  }, [eventId, selectedMatchId]);

  useEffect(() => {
    const updateClock = () => {
      setSharedClock(readSharedMatchClock(selectedMatch));
    };

    updateClock();

    const interval = setInterval(updateClock, 500);
    return () => clearInterval(interval);
  }, [selectedMatch]);

  const appendEvent = (label) => {
    setRecentEvents((current) =>
      [
        {
          id: Date.now(),
          label,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...current,
      ].slice(0, 6),
    );
  };

  const deriveActionKey = (event) => {
    const label = String(event?.type || "").toLowerCase();
    if (label.includes("touch point"))
      return `touch-${Number(event?.points || 0)}`;
    if (label.includes("bonus")) return "bonus";
    if (label.includes("tackle")) return "tackle";
    if (label.includes("lona") || label.includes("all out")) return "lona";
    if (label.includes("red card")) return "redCard";
    if (label.includes("yellow card")) return "yellowCard";
    if (label.includes("green card")) return "greenCard";
    return "bonus";
  };

  const submitScore = async ({ actionKey, points, eventType }) => {
    if (!selectedMatch?.id) return;

    const field = selectedTeam === "A" ? "scoreA" : "scoreB";
    const teamName =
      selectedTeam === "A" ? selectedMatch.teamAName : selectedMatch.teamBName;
    const nextScore = Number(selectedMatch[field] || 0) + Number(points || 0);
    const event = {
      time: selectedMatch.timer !== undefined ? selectedMatch.timer : 1200,
      type: eventType,
      team: teamName,
      teamKey: selectedTeam,
      points: Number(points || 0),
      roleAction: "score-sheet",
      timestamp: new Date(),
    };

    setSelectedAction(actionKey);
    setStats((current) => ({
      ...current,
      [actionKey]: current[actionKey] + 1,
      touchPoints: actionKey.startsWith("touch-")
        ? current.touchPoints + Number(points || 0)
        : current.touchPoints,
    }));
    appendEvent(`${teamName}: ${eventType}${points ? ` (+${points})` : ""}`);

    const nextEvents = [...(selectedMatch.events || []), event];
    const nextMatch = {
      ...selectedMatch,
      [field]: nextScore,
      events: nextEvents,
    };
    setSelectedMatch(nextMatch);

    try {
      await axios.patch(`${API_URL}/api/matches/${selectedMatch.id}`, {
        [field]: nextScore,
        events: nextEvents,
      });
    } catch (err) {
      console.error("Failed to store scoring action:", err);
    }
  };

  const undoLastDecision = async () => {
    if (
      !selectedMatch?.id ||
      !Array.isArray(selectedMatch.events) ||
      selectedMatch.events.length === 0
    ) {
      return;
    }

    const reversedEvent = selectedMatch.events[selectedMatch.events.length - 1];
    const nextMatch = undoLastMatchEvent(selectedMatch);
    if (!nextMatch) return;

    setSelectedMatch((prev) =>
      prev
        ? {
            ...prev,
            scoreA: nextMatch.scoreA,
            scoreB: nextMatch.scoreB,
            events: nextMatch.events,
          }
        : prev,
    );

    const actionKey = deriveActionKey(reversedEvent);
    setSelectedAction(actionKey);
    setStats((current) => {
      const next = { ...current };
      if (actionKey.startsWith("touch-")) {
        next.touchPoints = Math.max(
          0,
          next.touchPoints - Number(reversedEvent?.points || 0),
        );
      } else if (actionKey in next) {
        next[actionKey] = Math.max(0, Number(next[actionKey] || 0) - 1);
      }
      return next;
    });
    setRecentEvents((current) => current.slice(1));

    try {
      await axios.patch(`${API_URL}/api/matches/${selectedMatch.id}`, {
        scoreA: nextMatch.scoreA,
        scoreB: nextMatch.scoreB,
        events: nextMatch.events,
      });
    } catch (err) {
      console.error("Failed to undo scoring action:", err);
    }
  };

  const actionCards = useMemo(
    () => [
      {
        key: "bonus",
        title: "Bonus Point",
        description: "Reward for a clean raid bonus inside the bonus line.",
        color: "#4f46e5",
        icon: Circle,
        points: 1,
      },
      {
        key: "tackle",
        title: "Tackle Point",
        description:
          "Awarded when the defending team stops a raid successfully.",
        color: "#059669",
        icon: Shield,
        points: 1,
      },
      {
        key: "lona",
        title: "Lona / All-Out",
        description:
          "Mark the full-team all-out event when all players are out.",
        color: "#f59e0b",
        icon: Trophy,
        points: 2,
      },
      {
        key: "redCard",
        title: "Red Card",
        description: "Serious discipline action recorded for major violations.",
        color: "#dc2626",
        icon: AlertTriangle,
        points: 0,
      },
      {
        key: "yellowCard",
        title: "Yellow Card",
        description: "Warning-level discipline action.",
        color: "#d97706",
        icon: Slash,
        points: 0,
      },
      {
        key: "greenCard",
        title: "Green Card",
        description: "Positive conduct / caution marker.",
        color: "#16a34a",
        icon: Circle,
        points: 0,
      },
    ],
    [],
  );

  return (
    <div className="page-shell animate-fade-in scoring-options-page">
      <header className="page-header scoring-options-header">
        <div>
          <span className="eyebrow">Score control panel</span>
          <h1>Kabaddi Scoring Options</h1>
          <p>
            Live scoring sheet for the active match with match selection,
            independent scoring choices, and disciplinary actions.
          </p>
        </div>
        <div className="scoring-summary-chip">
          <span className="summary-label">Current mode</span>
          <strong>
            {selectedMatch
              ? `${selectedMatch.teamAName} vs ${selectedMatch.teamBName}`
              : "No live match"}
          </strong>
        </div>
      </header>

      <section
        className="glass-panel scoring-hero-panel"
        style={{ padding: "1rem 1.25rem" }}
      >
        <div className="section-head" style={{ marginBottom: "0.75rem" }}>
          <h2>Active Match</h2>
          <p>Select the live game and choose the team you want to score for.</p>
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <select
            className="form-control"
            value={selectedMatchId}
            onChange={(e) => {
              const nextMatchId = e.target.value;
              setSelectedMatchId(nextMatchId);
              setActiveMatchId(nextMatchId, eventId);
              const nextMatch =
                liveMatches.find((match) => match.id === nextMatchId) || null;
              setSelectedMatch(nextMatch);
            }}
          >
            <option value="">Select live match</option>
            {liveMatches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.teamAName} vs {match.teamBName}
              </option>
            ))}
          </select>
          {selectedMatch ? (
            <div
              className="palette-item"
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <strong>
                {selectedMatch.teamAName} vs {selectedMatch.teamBName}
              </strong>
              <span className="badge badge-secondary">
                {Number(selectedMatch.scoreA || 0)} -{" "}
                {Number(selectedMatch.scoreB || 0)}
              </span>
            </div>
          ) : (
            <div className="empty-state">
              No active live match is available for scoring.
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel scoring-clock-panel">
        <div className="clock-copy">
          <span className="eyebrow">Shared match clock</span>
          <h2>Live Timer</h2>
          <p>
            This clock follows the active live match and stays synced with the
            referee dashboard.
          </p>
        </div>
        <div className="clock-display">
          <div className="clock-time">
            {formatMatchClock(sharedClock.timer)}
          </div>
          <div className="clock-meta">
            <span className="badge badge-accent">Half {sharedClock.half}</span>
            <span className="badge badge-secondary">
              {sharedClock.timerActive ? "Running" : "Paused"}
            </span>
          </div>
        </div>
      </section>

      <section
        className="glass-panel scoring-hero-panel"
        style={{ padding: "1rem 1.25rem" }}
      >
        <div className="section-head" style={{ marginBottom: "0.75rem" }}>
          <h2>Score Team</h2>
          <p>
            Pick the side before recording bonus, tackle, touch, lona, or cards.
          </p>
        </div>
        <div className="score-action-toolbar">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn ${selectedTeam === "A" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSelectedTeam("A")}
            >
              {selectedMatch?.teamAName || "Team A"}
            </button>
            <button
              type="button"
              className={`btn ${selectedTeam === "B" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSelectedTeam("B")}
            >
              {selectedMatch?.teamBName || "Team B"}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-secondary undo-button"
            onClick={undoLastDecision}
            disabled={!selectedMatch?.events?.length}
          >
            Undo Last Decision
          </button>
        </div>
      </section>

      <section className="scoring-hero-grid">
        <div className="glass-panel scoring-hero-panel">
          <div className="section-head">
            <h2>Fast Touch Selection</h2>
            <p>Tap a touch point to register raid value from 1 to 7.</p>
          </div>
          <div className="touch-grid">
            {touchPoints.map((point) => (
              <button
                key={point}
                type="button"
                className={`touch-button ${selectedAction === `touch-${point}` ? "active" : ""}`}
                onClick={() =>
                  submitScore({
                    actionKey: `touch-${point}`,
                    points: point,
                    eventType: `Touch Point ${point}`,
                  })
                }
              >
                <span>Touch</span>
                <strong>{point}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel scoring-hero-panel">
          <div className="section-head">
            <h2>Match Actions</h2>
            <p>One-tap controls for bonus, tackle, lona, and cards.</p>
          </div>
          <div className="action-grid">
            {actionCards.map((action) => {
              const Icon = action.icon;
              const isActive = selectedAction === action.key;

              return (
                <button
                  key={action.key}
                  type="button"
                  className={`action-card ${isActive ? "active" : ""}`}
                  onClick={() =>
                    submitScore({
                      actionKey: action.key,
                      points: action.points,
                      eventType: action.title,
                    })
                  }
                  style={{
                    borderColor: isActive
                      ? action.color
                      : "var(--glass-border)",
                    boxShadow: isActive
                      ? `0 12px 30px ${action.color}24`
                      : "none",
                  }}
                >
                  <span
                    className="action-icon"
                    style={{
                      background: `${action.color}18`,
                      color: action.color,
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <strong>{action.title}</strong>
                  <span>{action.description}</span>
                  <small>{action.category}</small>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="stats-strip">
        <div className="glass-panel stat-card">
          <span>Bonus</span>
          <strong>{stats.bonus}</strong>
        </div>
        <div className="glass-panel stat-card">
          <span>Tackle</span>
          <strong>{stats.tackle}</strong>
        </div>
        <div className="glass-panel stat-card">
          <span>Lona</span>
          <strong>{stats.lona}</strong>
        </div>
        <div className="glass-panel stat-card">
          <span>Touch Total</span>
          <strong>{stats.touchPoints}</strong>
        </div>
        <div className="glass-panel stat-card card-red">
          <span>Red Card</span>
          <strong>{stats.redCard}</strong>
        </div>
        <div className="glass-panel stat-card card-yellow">
          <span>Yellow Card</span>
          <strong>{stats.yellowCard}</strong>
        </div>
        <div className="glass-panel stat-card card-green">
          <span>Green Card</span>
          <strong>{stats.greenCard}</strong>
        </div>
      </section>

      <section className="glass-panel discipline-panel">
        <div className="section-head">
          <h2>Quick Scoring Palette</h2>
          <p>
            All supported scoring events are grouped here for fast match entry.
          </p>
        </div>
        <div className="palette-grid">
          {scoringActions.map((item) => (
            <div key={item.key} className="palette-item">
              <div className="palette-label">{item.category}</div>
              <div className="palette-value">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel activity-panel">
        <div className="section-head">
          <h2>Recent Entries</h2>
          <p>Latest action history from this page session.</p>
        </div>
        {recentEvents.length === 0 ? (
          <div className="empty-state">
            No events recorded yet. Start by selecting a touch point or action.
          </div>
        ) : (
          <div className="recent-list">
            {recentEvents.map((event) => (
              <div key={event.id} className="recent-item">
                <strong>{event.label}</strong>
                <span>{event.time}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .scoring-options-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .scoring-options-header {
          align-items: center;
          gap: 1rem;
        }
        .scoring-summary-chip {
          margin-left: auto;
          min-width: 180px;
          padding: 1rem 1.1rem;
          border-radius: 18px;
          border: 1px solid rgba(79, 70, 229, 0.18);
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(5, 150, 105, 0.06));
          display: grid;
          gap: 0.25rem;
          text-transform: capitalize;
        }
        .summary-label,
        .section-head p,
        .palette-label,
        .recent-item span {
          color: var(--text-muted);
        }
        .scoring-hero-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.25rem;
        }
        .scoring-hero-panel,
        .discipline-panel,
        .activity-panel {
          padding: 1.5rem;
        }
        .section-head {
          display: grid;
          gap: 0.3rem;
          margin-bottom: 1.15rem;
        }
        .section-head h2 {
          font-size: 1.35rem;
        }
        .touch-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .touch-button,
        .action-card {
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.88);
          color: var(--text-main);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .touch-button {
          padding: 1rem 0.85rem;
          display: grid;
          gap: 0.25rem;
          text-align: left;
          min-height: 92px;
          background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(255, 255, 255, 0.9));
        }
        .touch-button strong {
          font-size: 1.6rem;
        }
        .touch-button:hover,
        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(31, 41, 55, 0.08);
        }
        .touch-button.active,
        .action-card.active {
          transform: translateY(-2px);
          border-color: var(--secondary);
          box-shadow: 0 12px 30px rgba(79, 70, 229, 0.14);
        }
        .action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
        }
        .action-card {
          padding: 1rem;
          text-align: left;
          display: grid;
          gap: 0.5rem;
        }
        .action-icon {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
        }
        .action-card strong {
          font-size: 1.02rem;
        }
        .action-card span {
          color: var(--text-muted);
          font-size: 0.92rem;
        }
        .action-card small {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .stats-strip {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .stat-card {
          padding: 1rem;
          display: grid;
          gap: 0.25rem;
          text-align: center;
        }
        .stat-card span {
          color: var(--text-muted);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .stat-card strong {
          font-size: 1.7rem;
          font-family: var(--font-mono);
        }
        .card-red {
          border-color: rgba(220, 38, 38, 0.2);
        }
        .card-yellow {
          border-color: rgba(217, 119, 6, 0.2);
        }
        .card-green {
          border-color: rgba(22, 163, 74, 0.2);
        }
        .palette-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .palette-item {
          padding: 1rem;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(255, 255, 255, 0.92));
          border: 1px solid var(--glass-border);
        }
        .palette-value {
          font-weight: 700;
          margin-top: 0.15rem;
        }
        .recent-list {
          display: grid;
          gap: 0.75rem;
        }
        .recent-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.9rem 1rem;
          border-radius: 14px;
          background: rgba(248, 250, 252, 0.95);
          border: 1px solid var(--glass-border);
        }
        .empty-state {
          padding: 1rem;
          border-radius: 14px;
          border: 1px dashed var(--glass-border);
          color: var(--text-muted);
        }
        @media (max-width: 1100px) {
          .scoring-hero-grid,
          .stats-strip {
            grid-template-columns: 1fr;
          }
          .touch-grid,
          .action-grid,
          .palette-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .scoring-options-header {
            align-items: flex-start;
          }
          .scoring-summary-chip {
            width: 100%;
            margin-left: 0;
          }
          .touch-grid,
          .action-grid,
          .palette-grid {
            grid-template-columns: 1fr;
          }
          .recent-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }
        }
        @media (max-width: 640px) {
          .scoring-options-page {
            gap: 1rem;
          }
          .scoring-hero-panel,
          .discipline-panel,
          .activity-panel {
            padding: 1rem;
          }
          .scoring-summary-chip {
            width: 100%;
            margin-left: 0;
          }
          .touch-grid,
          .action-grid,
          .palette-grid {
            grid-template-columns: 1fr;
          }
          .stats-strip {
            grid-template-columns: 1fr;
          }
          .stat-card strong {
            font-size: 1.4rem;
          }
          .touch-button,
          .action-card {
            min-height: 84px;
          }
          .score-action-toolbar {
            display: grid !important;
            gap: 0.75rem;
          }
          .score-action-toolbar .btn,
          .undo-button {
            width: 100%;
          }
          .scoring-clock-panel {
            padding: 1rem;
          }
          .clock-display {
            width: 100%;
          }
          .clock-time {
            font-size: clamp(2.4rem, 14vw, 4rem);
          }
          .clock-meta {
            width: 100%;
            justify-content: flex-start;
          }
        }
        .scoring-clock-panel {
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          background: linear-gradient(135deg, rgba(13, 27, 42, 0.96), rgba(31, 41, 55, 0.9));
          border: 1px solid rgba(242, 178, 3, 0.22);
          box-shadow: 0 18px 40px rgba(13, 27, 42, 0.18);
        }
        .clock-copy {
          display: grid;
          gap: 0.35rem;
          max-width: 420px;
        }
        .clock-copy h2 {
          color: #fff;
          font-size: 1.45rem;
        }
        .clock-copy p {
          color: rgba(255, 255, 255, 0.72);
        }
        .clock-display {
          display: grid;
          justify-items: end;
          gap: 0.75rem;
        }
        .clock-time {
          font-family: var(--font-mono);
          color: #fff;
          font-size: clamp(3rem, 8vw, 5rem);
          line-height: 1;
          letter-spacing: 0.04em;
          text-shadow: 0 0 24px rgba(242, 178, 3, 0.35);
        }
        .clock-meta {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .score-action-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
};

export default ScoringOptions;
