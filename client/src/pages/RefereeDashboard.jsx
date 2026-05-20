import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Play,
  Pause,
  AlertTriangle,
  CheckSquare,
  Activity,
  ShieldAlert,
  UserPlus,
  UserMinus,
  Eye,
  Trophy,
  Shield,
  Circle,
  Slash,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { API_URL } from "../utils/apiBase";
import {
  EVENT_CHANGE_EVENT,
  MATCH_CHANGE_EVENT,
  getActiveEventId,
  getActiveMatchId,
  setActiveMatchId,
} from "../utils/eventSelection";
import {
  ROLE_LABELS,
  calculateMatchEvaluation,
  readRefereeSession,
  recordHalfSnapshot,
  saveFinalMatchSummary,
  writeRefereeSession,
} from "../utils/refereeSessions";
import { formatMatchClock, readSharedMatchClock } from "../utils/matchClock";
import {
  formatPoolLabel,
  formatFixtureLabel,
  recalculateMatchFromEvents,
} from "../utils/matchScoring";

const MATCH_HALF_DURATION = 1200;
const touchPoints = [1, 2, 3, 4, 5, 6, 7];

const RefereeDashboard = () => {
  const { role } = useParams();
  const [match, setMatch] = useState(null);
  const [eventId, setEventId] = useState(getActiveEventId());
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(
    getActiveMatchId(getActiveEventId()),
  );
  const [roleSession, setRoleSession] = useState(() =>
    readRefereeSession(getActiveMatchId(getActiveEventId()), role),
  );
  const [finalSummary, setFinalSummary] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("A");
  const timerRef = useRef(null);

  const roleLabel = ROLE_LABELS[role] || role || "Match Official";
  const isChiefReferee = role === "chief-referee";

  const activeMatchId = selectedMatchId || match?.id || "";

  const syncAggregatedMatch = (
    nextMatchId = activeMatchId,
    baseMatch = match,
  ) => {
    if (!nextMatchId) return null;
    const summary = calculateMatchEvaluation(nextMatchId, baseMatch);
    if (!summary) return null;

    const nextMatch = {
      ...(baseMatch || {}),
      scoreA: summary.scoreA,
      scoreB: summary.scoreB,
      events: summary.events,
      refereeEvaluation: summary,
    };

    setMatch(nextMatch);
    saveFinalMatchSummary(nextMatchId, summary);
    localStorage.setItem(
      `kabaddi_local_scoreA_${nextMatchId}`,
      String(summary.scoreA),
    );
    localStorage.setItem(
      `kabaddi_local_scoreB_${nextMatchId}`,
      String(summary.scoreB),
    );
    return summary;
  };

  const persistRoleSession = (patch) => {
    if (!activeMatchId || !role) return roleSession;
    const nextSession = writeRefereeSession(activeMatchId, role, patch);
    setRoleSession(nextSession);
    return nextSession;
  };

  const finalizeMatchRecord = async (summaryOverride = null) => {
    if (!match?.id) return;
    const summary = summaryOverride || syncAggregatedMatch(match.id, match);
    if (!summary) return;

    const completedPayload = {
      scoreA: summary.scoreA,
      scoreB: summary.scoreB,
      events: summary.events,
      refereeEvaluation: summary,
      winnerTeamName: summary.status === "draw" ? "Draw" : summary.winner,
      loserTeamName:
        summary.status === "draw"
          ? "Draw"
          : summary.winner === match.teamAName
            ? match.teamBName
            : match.teamAName,
      status: "finished",
      finishedAt: summary.finishedAt,
      half: 2,
      timer: 0,
      timerActive: false,
    };

    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, completedPayload);
    } catch (error) {
      console.error("Unable to save completed match:", error);
    }

    persistRoleSession({
      timerActive: false,
      timer: 0,
      completed: true,
      half: 2,
    });
    setFinalSummary(summary);
  };

  const startOrPauseRoleTimer = async (shouldStart) => {
    if (!match?.id) return;
    const currentTimer =
      match.timer !== undefined ? match.timer : MATCH_HALF_DURATION;
    const currentHalf = Number(match.half || 1);

    if (shouldStart) {
      const timerAtStart =
        currentTimer > 0 ? currentTimer : MATCH_HALF_DURATION;
      const now = Date.now();

      localStorage.setItem(`kabaddi_timer_active_${match.id}`, "true");
      localStorage.setItem(
        `kabaddi_timer_last_started_at_${match.id}`,
        String(now),
      );
      localStorage.setItem(
        `kabaddi_timer_at_start_${match.id}`,
        String(timerAtStart),
      );
      localStorage.setItem(
        `kabaddi_match_half_${match.id}`,
        String(currentHalf),
      );

      setMatch((prev) =>
        prev
          ? {
              ...prev,
              timerActive: true,
              timerLastStartedAt: now,
              timerAtStart,
              timer: timerAtStart,
              half: currentHalf,
            }
          : prev,
      );

      try {
        await axios.patch(`${API_URL}/api/matches/${match.id}`, {
          timerActive: true,
          timerLastStartedAt: now,
          timerAtStart,
          timer: timerAtStart,
          half: currentHalf,
        });
      } catch (error) {
        console.error(error);
      }
      return;
    }

    localStorage.setItem(`kabaddi_timer_active_${match.id}`, "false");
    localStorage.setItem(`kabaddi_timer_${match.id}`, String(currentTimer));
    localStorage.setItem(`kabaddi_match_half_${match.id}`, String(currentHalf));

    setMatch((prev) =>
      prev
        ? {
            ...prev,
            timerActive: false,
            timer: currentTimer,
            half: currentHalf,
          }
        : prev,
    );

    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, {
        timerActive: false,
        timer: currentTimer,
        half: currentHalf,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleTimerExpiry = async (session) => {
    if (!match?.id) return;
    const currentHalf = Number(session.half || 1);
    recordHalfSnapshot(match.id, role, currentHalf);

    if (currentHalf === 1) {
      const now = Date.now();
      localStorage.setItem(`kabaddi_timer_active_${match.id}`, "true");
      localStorage.setItem(
        `kabaddi_timer_${match.id}`,
        String(MATCH_HALF_DURATION),
      );
      localStorage.setItem(
        `kabaddi_timer_last_started_at_${match.id}`,
        String(now),
      );
      localStorage.setItem(
        `kabaddi_timer_at_start_${match.id}`,
        String(MATCH_HALF_DURATION),
      );
      localStorage.setItem(`kabaddi_match_half_${match.id}`, "2");

      try {
        await axios.patch(`${API_URL}/api/matches/${match.id}`, {
          half: 2,
          timer: MATCH_HALF_DURATION,
          timerActive: true,
          timerLastStartedAt: now,
          timerAtStart: MATCH_HALF_DURATION,
        });
      } catch (error) {
        console.error(error);
      }

      setMatch((prev) =>
        prev
          ? {
              ...prev,
              half: 2,
              timer: MATCH_HALF_DURATION,
              timerActive: true,
              timerLastStartedAt: now,
              timerAtStart: MATCH_HALF_DURATION,
            }
          : prev,
      );
      return;
    }

    localStorage.setItem(`kabaddi_timer_active_${match.id}`, "false");
    localStorage.setItem(`kabaddi_timer_${match.id}`, "0");
    localStorage.setItem(`kabaddi_match_half_${match.id}`, "2");
    setMatch((prev) =>
      prev
        ? { ...prev, timer: 0, timerActive: false, status: "finished" }
        : prev,
    );

    if (isChiefReferee) {
      const summary = syncAggregatedMatch(match.id, match);
      await finalizeMatchRecord(summary);
    } else {
      syncAggregatedMatch(match.id, match);
    }
  };

  const updateScore = async (team, points, type) => {
    if (!match?.id) return;
    const field = team === "A" ? "scoreA" : "scoreB";
    const teamName = team === "A" ? match.teamAName : match.teamBName;
    const teamId = team === "A" ? match.teamAId : match.teamBId;
    const currentSession = readRefereeSession(match.id, role);
    const nextScore = Number(currentSession[field] || 0) + Number(points || 0);
    const event = {
      time: match.timer !== undefined ? match.timer : MATCH_HALF_DURATION,
      type,
      team: teamName,
      teamKey: team,
      teamId,
      points: Number(points || 0),
      roleAction: role,
      timestamp: new Date().toISOString(),
    };

    const nextSession = persistRoleSession({
      [field]: nextScore,
      events: [...(currentSession.events || []), event],
    });

    const summary = syncAggregatedMatch(match.id, {
      ...match,
      [field]: nextScore,
      events: [...(match.events || []), event],
    });

    setMatch((prev) =>
      prev
        ? {
            ...prev,
            scoreA: summary?.scoreA ?? prev.scoreA,
            scoreB: summary?.scoreB ?? prev.scoreB,
            events: [...(prev.events || []), event],
          }
        : prev,
    );

    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, {
        scoreA: summary?.scoreA ?? match.scoreA ?? 0,
        scoreB: summary?.scoreB ?? match.scoreB ?? 0,
        events: [...(match.events || []), event],
        refereeEvaluation: summary,
      });
    } catch (error) {
      console.error(error);
    }

    setRoleSession(nextSession);
  };

  const sendAlert = async (type) => {
    if (!match?.id) return;
    const event = {
      time: match.timer !== undefined ? match.timer : MATCH_HALF_DURATION,
      type,
      team: "System",
      points: 0,
      roleAction: role,
      timestamp: new Date().toISOString(),
    };

    persistRoleSession({
      events: [...(currentSession.events || []), event],
    });

    setMatch((prev) =>
      prev ? { ...prev, events: [...(prev.events || []), event] } : prev,
    );

    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, {
        events: [...(match.events || []), event],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const undoLastDecision = async () => {
    if (!match?.id) return;

    const currentSession = readRefereeSession(match.id, role);
    const sessionEvents = Array.isArray(currentSession.events)
      ? currentSession.events
      : [];
    if (sessionEvents.length === 0) return;

    const reversedEvent = sessionEvents[sessionEvents.length - 1];
    const nextEvents = sessionEvents.slice(0, -1);
    const nextSessionSummary = recalculateMatchFromEvents(match, nextEvents);
    persistRoleSession({
      events: nextEvents,
      scoreA: nextSessionSummary.scoreA,
      scoreB: nextSessionSummary.scoreB,
      timerActive: Boolean(match.timerActive),
      timer: match.timer !== undefined ? match.timer : MATCH_HALF_DURATION,
      timerAtStart: match.timerAtStart,
      timerLastStartedAt: match.timerLastStartedAt,
      half: match.half,
    });

    const nextMatchEvents = Array.isArray(match.events)
      ? (() => {
          const clonedEvents = [...match.events];
          const reverseIndex = clonedEvents
            .slice()
            .reverse()
            .findIndex(
              (event) =>
                event.timestamp === reversedEvent.timestamp &&
                event.type === reversedEvent.type &&
                event.points === reversedEvent.points &&
                event.teamKey === reversedEvent.teamKey &&
                event.roleAction === reversedEvent.roleAction,
            );
          if (reverseIndex === -1) {
            clonedEvents.pop();
          } else {
            clonedEvents.splice(clonedEvents.length - 1 - reverseIndex, 1);
          }
          return clonedEvents;
        })()
      : [];
    const nextMatch = {
      ...match,
      scoreA: nextSessionSummary.scoreA,
      scoreB: nextSessionSummary.scoreB,
      events: nextMatchEvents,
    };

    setMatch(nextMatch);

    const summary = syncAggregatedMatch(match.id, nextMatch);

    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, {
        scoreA: summary?.scoreA ?? nextMatch.scoreA,
        scoreB: summary?.scoreB ?? nextMatch.scoreB,
        events: nextMatchEvents,
        refereeEvaluation:
          summary || calculateMatchEvaluation(match.id, nextMatch),
      });
    } catch (error) {
      console.error("Failed to undo last decision:", error);
    }
  };

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        if (!eventId) {
          setLiveMatches([]);
          setSelectedMatchId("");
          setMatch(null);
          return;
        }

        const liveRes = await axios.get(
          `${API_URL}/api/matches/scoreboard/live-games`,
          {
            params: { eventId },
          },
        );
        const currentLiveMatches = Array.isArray(liveRes.data?.liveMatches)
          ? liveRes.data.liveMatches
          : [];
        setLiveMatches(currentLiveMatches);

        const persistedMatchId = getActiveMatchId(eventId);
        const candidateId =
          selectedMatchId ||
          persistedMatchId ||
          currentLiveMatches[0]?.id ||
          "";
        const activeMatchIdCandidate = currentLiveMatches.some(
          (item) => item.id === candidateId,
        )
          ? candidateId
          : currentLiveMatches[0]?.id || "";

        if (!activeMatchIdCandidate) {
          setSelectedMatchId("");
          setMatch(null);
          return;
        }

        if (activeMatchIdCandidate !== selectedMatchId) {
          setSelectedMatchId(activeMatchIdCandidate);
          setActiveMatchId(activeMatchIdCandidate, eventId);
        }

        const res = await axios.get(`${API_URL}/api/matches/scoreboard/feed`, {
          params: { eventId, matchId: activeMatchIdCandidate },
        });
        const currentMatch = res.data?.match || null;

        if (!currentMatch) {
          setMatch(null);
          return;
        }

        let updatedData = { ...currentMatch };
        const sharedClock = readSharedMatchClock(currentMatch);
        const currentLocalSession = readRefereeSession(
          activeMatchIdCandidate,
          role,
        );

        if (currentLocalSession) {
          updatedData = {
            ...updatedData,
            scoreA: Math.max(
              Number(updatedData.scoreA || 0),
              Number(currentLocalSession.scoreA || 0),
            ),
            scoreB: Math.max(
              Number(updatedData.scoreB || 0),
              Number(currentLocalSession.scoreB || 0),
            ),
            timerActive: sharedClock.timerActive,
            timer: sharedClock.timer,
            timerAtStart: sharedClock.timerAtStart,
            timerLastStartedAt: sharedClock.timerLastStartedAt,
            half: sharedClock.half,
            events: Array.isArray(currentLocalSession.events)
              ? currentLocalSession.events.length > 0
                ? currentLocalSession.events
                : updatedData.events || []
              : updatedData.events || [],
          };
        }

        updatedData = {
          ...updatedData,
          ...sharedClock,
        };

        setMatch(updatedData);
      } catch (error) {
        console.error(error);
        setMatch(null);
      }
    };

    fetchMatch();
    const fetchInterval = setInterval(fetchMatch, 3000);

    const onEventChange = (evt) => {
      setEventId(evt.detail?.eventId || getActiveEventId());
      setSelectedMatchId(
        getActiveMatchId(evt.detail?.eventId || getActiveEventId()),
      );
    };
    const onMatchChange = (evt) => {
      if (evt.detail?.eventId && evt.detail.eventId !== eventId) return;
      setSelectedMatchId(evt.detail?.matchId || "");
    };

    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    window.addEventListener(MATCH_CHANGE_EVENT, onMatchChange);

    return () => {
      clearInterval(fetchInterval);
      window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
      window.removeEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    };
  }, [eventId, selectedMatchId, role]);

  useEffect(() => {
    if (!match?.timerActive || !match?.timerLastStartedAt) return undefined;

    timerRef.current = setInterval(() => {
      setMatch((prev) => {
        if (!prev) return prev;
        const timerAtStart =
          prev.timerAtStart !== undefined
            ? prev.timerAtStart
            : prev.timer !== undefined
              ? prev.timer
              : MATCH_HALF_DURATION;
        const elapsed = Math.floor(
          (Date.now() - prev.timerLastStartedAt) / 1000,
        );
        const computedTimer = Math.max(0, timerAtStart - elapsed);

        if (computedTimer === 0 && prev.timer !== 0) {
          handleTimerExpiry(prev).catch((error) => {
            console.error("Timer expiry handling failed:", error);
          });
          return {
            ...prev,
            timer: 0,
            timerActive: false,
          };
        }

        return {
          ...prev,
          timer: computedTimer,
        };
      });
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [match?.timerActive, match?.timerLastStartedAt, role]);

  useEffect(() => {
    const nextMatchId = selectedMatchId || match?.id;
    if (!nextMatchId || !role) return;
    setRoleSession(readRefereeSession(nextMatchId, role));
    setFinalSummary(null);
  }, [selectedMatchId, match?.id, role]);

  const currentTimer = match?.timer ?? MATCH_HALF_DURATION;
  const currentHalf = Number(match?.half || 1);
  const eventLog = useMemo(() => match?.events || [], [match?.events]);

  if (!match) {
    return (
      <div
        className="glass-panel"
        style={{ padding: "3rem", textAlign: "center", margin: "2rem" }}
      >
        <AlertTriangle
          size={48}
          color="var(--warning)"
          style={{ margin: "0 auto 1rem" }}
        />
        <h2>No Live Match Active</h2>
        <p style={{ color: "var(--text-muted)" }}>
          Waiting for an active fixture to load this referee dashboard.
        </p>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ display: "grid", gap: "1.25rem" }}
    >
      <header
        className="official-page-header"
        style={{ marginBottom: "0.5rem" }}
      >
        <div>
          <h1 className="title-glow">{roleLabel}</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Live scoring sheet for {match.teamAName} vs {match.teamBName}
          </p>
        </div>
        <div
          className="badge badge-secondary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <CheckSquare size={16} /> SYSTEM ONLINE
        </div>
      </header>

      {liveMatches.length > 0 && (
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <label
            className="form-label"
            style={{ marginBottom: "0.4rem", display: "block" }}
          >
            Choose Live Game
          </label>
          <select
            className="form-control"
            value={selectedMatchId}
            onChange={(e) => {
              const nextMatchId = e.target.value;
              setSelectedMatchId(nextMatchId);
              setActiveMatchId(nextMatchId, eventId);
            }}
          >
            {liveMatches.map((liveGame) => (
              <option key={liveGame.id} value={liveGame.id}>
                {liveGame.teamAName} vs {liveGame.teamBName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="glass-panel" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div className="eyebrow">Shared match clock</div>
              <strong style={{ fontSize: "1.05rem" }}>
                {roleLabel} - {currentHalf === 2 ? "Second Half" : "First Half"}
              </strong>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Every official sees the same live timer state.
              </div>
            </div>
            <button
              className={`btn ${match.timerActive ? "btn-danger" : "btn-primary"}`}
              style={{
                padding: "0.8rem 1.5rem",
                boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
              }}
              onClick={() => startOrPauseRoleTimer(!match.timerActive)}
            >
              {match.timerActive ? (
                <>
                  <Pause size={18} /> Pause Clock
                </>
              ) : (
                <>
                  <Play size={18} /> Start Clock
                </>
              )}
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto auto",
              gap: "0.75rem",
              alignItems: "center",
              padding: "1rem 1.1rem",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg, rgba(13, 27, 42, 0.94), rgba(31, 41, 55, 0.88))",
              border: "1px solid rgba(242, 178, 3, 0.22)",
              boxShadow: "0 18px 40px rgba(13, 27, 42, 0.18)",
            }}
          >
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontSize: "0.76rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Match clock
              </div>
              <div
                className="timer-value"
                style={{
                  color: "#fff",
                  fontSize: "clamp(3rem, 8vw, 5rem)",
                  lineHeight: 1,
                  fontFamily: "var(--font-mono)",
                  textShadow: "0 0 24px rgba(242, 178, 3, 0.35)",
                }}
              >
                {formatMatchClock(currentTimer)}
              </div>
            </div>
            <span
              className="badge badge-accent"
              style={{
                padding: "0.65rem 0.9rem",
                minWidth: "90px",
                justifyContent: "center",
              }}
            >
              Half {currentHalf}
            </span>
            <span
              className="badge badge-secondary"
              style={{
                padding: "0.65rem 0.9rem",
                minWidth: "160px",
                justifyContent: "center",
              }}
            >
              Score {Number(match.scoreA || 0)} - {Number(match.scoreB || 0)}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={undoLastDecision}
              disabled={!roleSession?.events?.length}
            >
              Undo Last Decision
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <div>
            <div className="eyebrow">Score target</div>
            <strong>Choose the team you want to score for</strong>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {formatFixtureLabel(match) ? (
              <span
                className="badge badge-secondary"
                style={{ alignSelf: "center" }}
              >
                {formatFixtureLabel(match)}
              </span>
            ) : null}
            <button
              type="button"
              className={`btn ${selectedTeam === "A" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSelectedTeam("A")}
            >
              {match.teamAName}
            </button>
            <button
              type="button"
              className={`btn ${selectedTeam === "B" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSelectedTeam("B")}
            >
              {match.teamBName}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <h3
              style={{
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Shield size={18} color="var(--secondary)" /> Touch Points
            </h3>
            <div
              className="official-action-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "0.75rem",
              }}
            >
              {touchPoints.map((point) => (
                <button
                  key={point}
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    updateScore(selectedTeam, point, `Touch Point ${point}`)
                  }
                >
                  +{point} Touch
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3
              style={{
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Circle size={18} color="var(--accent)" /> Bonus / Defense / Lona
            </h3>
            <div
              className="official-action-row"
              style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
            >
              <button
                className="btn btn-outline"
                onClick={() => updateScore(selectedTeam, 1, "Bonus Point")}
              >
                Bonus +1
              </button>
              <button
                className="btn btn-outline"
                onClick={() => updateScore(selectedTeam, 1, "Tackle Point")}
              >
                Tackle +1
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => updateScore(selectedTeam, 2, "All Out / Lona")}
              >
                Lona +2
              </button>
            </div>
          </div>

          <div>
            <h3
              style={{
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Slash size={18} color="var(--warning)" /> Discipline Cards
            </h3>
            <div
              className="official-action-row"
              style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
            >
              <button
                className="btn btn-danger"
                onClick={() => sendAlert("Yellow Card Issued")}
              >
                <ShieldAlert size={18} /> Yellow Card
              </button>
              <button
                className="btn btn-danger"
                style={{ background: "#7f1d1d" }}
                onClick={() => sendAlert("Red Card Issued")}
              >
                <AlertTriangle size={18} /> Red Card
              </button>
              <button
                className="btn btn-outline"
                onClick={() => sendAlert("Green Card Issued")}
              >
                Green Card
              </button>
            </div>
          </div>

          {isChiefReferee && (
            <div
              style={{
                borderTop: "1px solid var(--glass-border)",
                paddingTop: "1rem",
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => finalizeMatchRecord()}
              >
                Mark Match Completed & Store Record
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="official-layout-grid referee-main-grid"
        style={{ gap: "1.25rem" }}
      >
        <div className="glass-panel" style={{ padding: "1rem 1.25rem" }}>
          <h3
            style={{
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Activity size={18} color="var(--accent)" /> Official Audit Log
          </h3>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              maxHeight: "520px",
              overflowY: "auto",
            }}
          >
            <AnimatePresence>
              {eventLog
                .slice()
                .reverse()
                .map((event, index) => (
                  <motion.div
                    key={`${event.timestamp || index}-${index}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      padding: "0.9rem",
                      background: "rgba(0,0,0,0.03)",
                      borderRadius: "12px",
                      borderLeft: `3px solid ${event.teamKey === "A" ? "var(--primary)" : event.teamKey === "B" ? "var(--secondary)" : "var(--accent)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <strong>{event.team || "Match Official"}</strong>
                      <span style={{ color: "var(--text-muted)" }}>
                        {event.time}s
                      </span>
                    </div>
                    <div>
                      {event.points > 0
                        ? `Scored ${event.points} via ${event.type}`
                        : event.type}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        marginTop: "0.35rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Logged by: {event.roleAction || "System"}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
            {eventLog.length === 0 && (
              <div style={{ color: "var(--text-muted)" }}>
                No events logged yet.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "1rem 1.25rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Final Evaluation</h3>
          {finalSummary ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div
                className="badge badge-accent"
                style={{ justifyContent: "center" }}
              >
                Winner: {finalSummary.winner} | Margin: {finalSummary.margin}
              </div>
              <div>
                Score: {finalSummary.scoreA} - {finalSummary.scoreB}
              </div>
              <div>
                Role summaries: {finalSummary.roleSummaries?.length || 0}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)" }}>
              The final evaluation will appear here after completion.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefereeDashboard;
