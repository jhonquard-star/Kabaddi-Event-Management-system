import { useState, useEffect, useRef } from "react";
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

const MATCH_HALF_DURATION = 1200;

const RefereeDashboard = () => {
  const { role } = useParams(); // 'chief-referee', 'umpire-1', etc.
  const [match, setMatch] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [eventId, setEventId] = useState(getActiveEventId());
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(
    getActiveMatchId(getActiveEventId()),
  );
  const timerActiveRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    timerActiveRef.current = timerActive;
  }, [timerActive]);

  // Helper to read current timer and score overrides from localStorage
  const getLocalStorageTimer = (matchId) => {
    if (!matchId) return null;

    const active =
      localStorage.getItem(`kabaddi_timer_active_${matchId}`) === "true";
    const lastStarted = localStorage.getItem(
      `kabaddi_timer_last_started_at_${matchId}`,
    );
    const atStart = localStorage.getItem(`kabaddi_timer_at_start_${matchId}`);
    const paused = localStorage.getItem(`kabaddi_timer_${matchId}`);
    const half = localStorage.getItem(`kabaddi_match_half_${matchId}`);

    const scores = {};
    const scoreA = localStorage.getItem(`kabaddi_local_scoreA_${matchId}`);
    const scoreB = localStorage.getItem(`kabaddi_local_scoreB_${matchId}`);
    if (scoreA !== null) scores.scoreA = parseInt(scoreA);
    if (scoreB !== null) scores.scoreB = parseInt(scoreB);

    if (active && lastStarted) {
      const elapsed = Math.floor((Date.now() - parseInt(lastStarted)) / 1000);
      const computed = Math.max(0, (parseInt(atStart) || 1200) - elapsed);
      return {
        timerActive: true,
        timerLastStartedAt: parseInt(lastStarted),
        timerAtStart: parseInt(atStart) || MATCH_HALF_DURATION,
        timer: computed,
        half: half ? parseInt(half) : undefined,
        ...scores,
      };
    } else if (paused !== null) {
      return {
        timerActive: false,
        timer: parseInt(paused),
        half: half ? parseInt(half) : undefined,
        ...scores,
      };
    }
    return Object.keys(scores).length > 0 ? scores : null;
  };

  // Synchronize state with localStorage on mount & via listener
  useEffect(() => {
    const handleStorageChange = () => {
      const local = getLocalStorageTimer(selectedMatchId || match?.id);
      if (local && match) {
        if (local.timerActive !== undefined) setTimerActive(local.timerActive);
        setMatch((prev) => (prev ? { ...prev, ...local } : null));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // Initial sync
    const local = getLocalStorageTimer(selectedMatchId || match?.id);
    if (local && local.timerActive !== undefined) {
      setTimerActive(local.timerActive);
    }

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [match?.id, selectedMatchId]);

  useEffect(() => {
    const onEventChange = (evt) => {
      const nextEventId = evt.detail?.eventId || getActiveEventId();
      setEventId(nextEventId);
      setSelectedMatchId(getActiveMatchId(nextEventId));
    };
    const onMatchChange = (evt) => {
      if (evt.detail?.eventId && evt.detail.eventId !== eventId) return;
      setSelectedMatchId(evt.detail?.matchId || "");
    };
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    window.addEventListener(MATCH_CHANGE_EVENT, onMatchChange);

    const fetchMatch = async () => {
      try {
        if (!eventId) {
          setLiveMatches([]);
          setSelectedMatchId("");
          setMatch(null);
          setTimerActive(false);
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

        const activeMatchId = currentLiveMatches.some(
          (item) => item.id === candidateId,
        )
          ? candidateId
          : currentLiveMatches[0]?.id || "";

        if (!activeMatchId) {
          setSelectedMatchId("");
          setMatch(null);
          setTimerActive(false);
          return;
        }

        if (activeMatchId !== selectedMatchId) {
          setSelectedMatchId(activeMatchId);
          setActiveMatchId(activeMatchId, eventId);
        }

        const res = await axios.get(`${API_URL}/api/matches/scoreboard/feed`, {
          params: { eventId, matchId: activeMatchId },
        });
        const currentMatch = res.data?.match || null;

        if (!currentMatch) {
          setMatch(null);
          setTimerActive(false);
          return;
        }

        setMatch((prev) => {
          let updatedData = { ...currentMatch };

          // Reconcile Score A local overrides to avoid background API overwriting newer values (stutter)
          const localScoreA = localStorage.getItem(
            `kabaddi_local_scoreA_${activeMatchId}`,
          );
          if (localScoreA !== null) {
            const valA = parseInt(localScoreA);
            if (updatedData.scoreA < valA) {
              updatedData.scoreA = valA;
            } else {
              localStorage.removeItem(`kabaddi_local_scoreA_${activeMatchId}`);
            }
          }

          // Reconcile Score B local overrides to avoid background API overwriting newer values (stutter)
          const localScoreB = localStorage.getItem(
            `kabaddi_local_scoreB_${activeMatchId}`,
          );
          if (localScoreB !== null) {
            const valB = parseInt(localScoreB);
            if (updatedData.scoreB < valB) {
              updatedData.scoreB = valB;
            } else {
              localStorage.removeItem(`kabaddi_local_scoreB_${activeMatchId}`);
            }
          }

          const local = getLocalStorageTimer(activeMatchId);

          // Prioritize high-performance local storage timer over background DB fetch
          if (local) {
            updatedData = { ...updatedData, ...local };
          } else if (
            updatedData.timerActive &&
            updatedData.timerLastStartedAt
          ) {
            const timerAtStart =
              updatedData.timerAtStart !== undefined
                ? updatedData.timerAtStart
                : updatedData.timer !== undefined
                  ? updatedData.timer
                  : 1200;
            const elapsed = Math.floor(
              (Date.now() - updatedData.timerLastStartedAt) / 1000,
            );
            updatedData.timer = Math.max(0, timerAtStart - elapsed);
          }

          if (!prev) {
            setTimerActive(updatedData.timerActive || false);
            return updatedData;
          }
          // Set timer active state from backend so all roles know it's running
          if (updatedData.timerActive !== undefined) {
            setTimerActive(updatedData.timerActive);
          }
          // Avoid stuttering the clock if we are visually ticking it locally
          return {
            ...updatedData,
            timer: timerActiveRef.current ? prev.timer : updatedData.timer,
          };
        });
      } catch {
        setMatch(null);
      }
    };
    fetchMatch();
    const fetchInterval = setInterval(fetchMatch, 3000);
    return () => {
      clearInterval(fetchInterval);
      window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
      window.removeEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    };
  }, [role, eventId, selectedMatchId]);

  // Visual Ticker based on timestamps (immune to browser throttling)
  useEffect(() => {
    let interval = null;
    if (timerActive && match?.timerLastStartedAt) {
      interval = setInterval(() => {
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
            const currentHalf = Number(prev.half || 1);
            if (currentHalf === 1) {
              const now = Date.now();
              localStorage.setItem(`kabaddi_timer_active_${prev.id}`, "true");
              localStorage.setItem(
                `kabaddi_timer_${prev.id}`,
                MATCH_HALF_DURATION.toString(),
              );
              localStorage.setItem(
                `kabaddi_timer_last_started_at_${prev.id}`,
                now.toString(),
              );
              localStorage.setItem(
                `kabaddi_timer_at_start_${prev.id}`,
                MATCH_HALF_DURATION.toString(),
              );
              localStorage.setItem(`kabaddi_match_half_${prev.id}`, "2");

              axios
                .patch(`${API_URL}/api/matches/${prev.id}`, {
                  half: 2,
                  timer: MATCH_HALF_DURATION,
                  timerActive: true,
                  timerLastStartedAt: now,
                  timerAtStart: MATCH_HALF_DURATION,
                })
                .catch(() => {});

              return {
                ...prev,
                half: 2,
                timer: MATCH_HALF_DURATION,
                timerActive: true,
                timerLastStartedAt: now,
                timerAtStart: MATCH_HALF_DURATION,
              };
            }

            localStorage.setItem(`kabaddi_timer_active_${prev.id}`, "false");
            localStorage.setItem(`kabaddi_timer_${prev.id}`, "0");
            localStorage.setItem(`kabaddi_match_half_${prev.id}`, "2");

            axios
              .patch(`${API_URL}/api/matches/${prev.id}`, {
                timer: 0,
                timerActive: false,
                half: 2,
                status: "finished",
                finishedAt: new Date().toISOString(),
              })
              .catch(() => {});
            setTimerActive(false);
            return {
              ...prev,
              timer: 0,
              timerActive: false,
              status: "finished",
            };
          }

          return { ...prev, timer: computedTimer };
        });
      }, 500); // 500ms for smooth updates
    }
    return () => clearInterval(interval);
  }, [timerActive, role, match?.timerLastStartedAt]);

  const updateScore = async (team, points, type) => {
    if (!match) return;
    const field = team === "A" ? "scoreA" : "scoreB";
    const teamName = team === "A" ? match.teamAName : match.teamBName;
    const teamId = team === "A" ? match.teamAId : match.teamBId;
    const newScore = (match[field] || 0) + points;

    // Save to localStorage immediately to avoid lag/stutter
    localStorage.setItem(
      `kabaddi_local_${field}_${match.id}`,
      newScore.toString(),
    );

    const event = {
      time: match.timer !== undefined ? match.timer : 1200,
      type,
      team: teamName,
      teamKey: team,
      teamId,
      points,
      roleAction: role,
      timestamp: new Date(),
    };

    setMatch((prev) => ({
      ...prev,
      [field]: newScore,
      events: [...(prev.events || []), event],
    }));

    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, {
        [field]: newScore,
        events: [...(match.events || []), event],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const sendAlert = async (type) => {
    if (!match) return;
    const event = {
      time: match.timer !== undefined ? match.timer : 1200,
      type,
      team: "System",
      points: 0,
      roleAction: role,
      timestamp: new Date(),
    };
    setMatch((prev) => ({ ...prev, events: [...(prev.events || []), event] }));
    try {
      await axios.patch(`${API_URL}/api/matches/${match.id}`, {
        events: [...(match.events || []), event],
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (!match)
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
          Waiting for the Technical Desk to start a new match.
        </p>
      </div>
    );

  const roleTitles = {
    "chief-referee": "Chief Referee",
    "umpire-1": "Court Umpire 1 (Team A Side)",
    "umpire-2": "Court Umpire 2 (Team B Side)",
    "lineman-1": "Line Umpire 1",
    "lineman-2": "Line Umpire 2",
    "chief-scorer": "Chief Scorer",
    "asst-scorer-1": "Assistant Scorer 1 (Team A Bench)",
    "asst-scorer-2": "Assistant Scorer 2 (Team B Bench)",
  };

  return (
    <div className="animate-fade-in">
      <header className="official-page-header" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 className="title-glow">{roleTitles[role] || "Match Official"}</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Authorized Action Panel for {match.teamAName} vs {match.teamBName}
          </p>
        </div>
        <div
          className="badge badge-secondary"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
          }}
        >
          <CheckSquare size={16} /> SYSTEM ONLINE
        </div>
      </header>

      {liveMatches.length > 0 && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", marginBottom: "1rem" }}
        >
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

      <div className="official-layout-grid">
        <div
          className="glass-panel"
          style={{ padding: "0", display: "flex", flexDirection: "column" }}
        >
          {/* Global Header for Match State */}
          <div
            className="official-score-strip"
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1.5rem",
              textAlign: "center",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            <h2 style={{ fontSize: "1.5rem", color: "var(--primary)" }}>
              {match.teamAName}: {match.scoreA || 0}
            </h2>
            <div>
              <div className="timer-value" style={{ fontSize: "2.5rem" }}>
                {Math.floor((match.timer || 0) / 60)}:
                {((match.timer || 0) % 60).toString().padStart(2, "0")}
              </div>
              {role === "chief-referee" && (
                <button
                  className={`btn ${timerActive ? "btn-danger" : "btn-primary"}`}
                  style={{ marginTop: "0.5rem", padding: "0.5rem 2rem" }}
                  onClick={async () => {
                    const nextState = !timerActive;
                    setTimerActive(nextState);

                    if (match?.id) {
                      if (nextState) {
                        // Starting the clock
                        const timerAtStart =
                          match.timer !== undefined ? match.timer : 1200;
                        const now = Date.now();

                        // Ultra-low latency LocalStorage write
                        localStorage.setItem(
                          `kabaddi_timer_active_${match.id}`,
                          "true",
                        );
                        localStorage.setItem(
                          `kabaddi_timer_last_started_at_${match.id}`,
                          now.toString(),
                        );
                        localStorage.setItem(
                          `kabaddi_timer_at_start_${match.id}`,
                          timerAtStart.toString(),
                        );

                        setMatch((prev) => ({
                          ...prev,
                          timerActive: true,
                          timerLastStartedAt: now,
                          timerAtStart,
                        }));

                        axios
                          .patch(`${API_URL}/api/matches/${match.id}`, {
                            timerActive: true,
                            timerLastStartedAt: now,
                            timerAtStart,
                          })
                          .catch(console.error);
                      } else {
                        // Pausing the clock
                        const currentTimer =
                          match.timer !== undefined ? match.timer : 1200;

                        // Ultra-low latency LocalStorage write
                        localStorage.setItem(
                          `kabaddi_timer_active_${match.id}`,
                          "false",
                        );
                        localStorage.setItem(
                          `kabaddi_timer_${match.id}`,
                          currentTimer.toString(),
                        );

                        setMatch((prev) => ({
                          ...prev,
                          timerActive: false,
                          timer: currentTimer,
                        }));

                        axios
                          .patch(`${API_URL}/api/matches/${match.id}`, {
                            timerActive: false,
                            timer: currentTimer,
                          })
                          .catch(console.error);
                      }
                    }
                  }}
                >
                  {timerActive ? (
                    <>
                      <Pause size={18} /> PAUSE CLOCK
                    </>
                  ) : (
                    <>
                      <Play size={18} /> START MATCH CLOCK
                    </>
                  )}
                </button>
              )}
            </div>
            <h2 style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>
              {match.teamBName}: {match.scoreB || 0}
            </h2>
          </div>

          <div style={{ padding: "2rem", flex: 1 }}>
            {/* CHIEF REFEREE UI */}
            {role === "chief-referee" && (
              <div style={{ textAlign: "center" }}>
                <h3
                  style={{ marginBottom: "2rem", color: "var(--text-muted)" }}
                >
                  Match Control Overrides
                </h3>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "2rem",
                    marginBottom: "3rem",
                  }}
                >
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      updateScore("A", 1, "Referee Override Point A")
                    }
                  >
                    Give Point {match.teamAName}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      updateScore("B", 1, "Referee Override Point B")
                    }
                  >
                    Give Point {match.teamBName}
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "1rem",
                    borderTop: "1px solid var(--glass-border)",
                    paddingTop: "2rem",
                  }}
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
                </div>
              </div>
            )}

            {/* COURT UMPIRE 1 (Team A) */}
            {role === "umpire-1" && (
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    fontSize: "2rem",
                    color: "var(--primary)",
                    marginBottom: "2rem",
                  }}
                >
                  Control: {match.teamAName}
                </h2>
                <div className="official-action-grid">
                  <button
                    className="btn btn-outline"
                    style={{
                      border: "2px solid var(--primary)",
                      color: "var(--primary)",
                    }}
                    onClick={() => updateScore("A", 1, "Touch Point")}
                  >
                    +1 TOUCH POINT
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      border: "2px solid var(--primary)",
                      color: "var(--primary)",
                    }}
                    onClick={() => updateScore("A", 1, "Bonus Point")}
                  >
                    +1 BONUS POINT
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      border: "2px solid var(--primary)",
                      color: "var(--primary)",
                    }}
                    onClick={() => updateScore("A", 1, "Tackle")}
                  >
                    +1 TACKLE POINT
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => updateScore("A", 2, "All Out / Lona")}
                  >
                    +2 LONA
                  </button>
                </div>
              </div>
            )}

            {/* COURT UMPIRE 2 (Team B) */}
            {role === "umpire-2" && (
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    fontSize: "2rem",
                    color: "var(--secondary)",
                    marginBottom: "2rem",
                  }}
                >
                  Control: {match.teamBName}
                </h2>
                <div className="official-action-grid">
                  <button
                    className="btn btn-outline"
                    style={{
                      border: "2px solid var(--secondary)",
                      color: "var(--secondary)",
                    }}
                    onClick={() => updateScore("B", 1, "Touch Point")}
                  >
                    +1 TOUCH POINT
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      border: "2px solid var(--secondary)",
                      color: "var(--secondary)",
                    }}
                    onClick={() => updateScore("B", 1, "Bonus Point")}
                  >
                    +1 BONUS POINT
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      border: "2px solid var(--secondary)",
                      color: "var(--secondary)",
                    }}
                    onClick={() => updateScore("B", 1, "Tackle")}
                  >
                    +1 TACKLE POINT
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ background: "var(--secondary)" }}
                    onClick={() => updateScore("B", 2, "All Out / Lona")}
                  >
                    +2 LONA
                  </button>
                </div>
              </div>
            )}

            {/* LINE UMPIRES */}
            {(role === "lineman-1" || role === "lineman-2") && (
              <div style={{ textAlign: "center" }}>
                <h3
                  style={{ marginBottom: "2rem", color: "var(--text-muted)" }}
                >
                  Boundary & Line Monitoring
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1rem",
                    maxWidth: "400px",
                    margin: "0 auto",
                  }}
                >
                  <button
                    className="btn btn-outline"
                    onClick={() => sendAlert("Raider Out of Bounds")}
                  >
                    Raider Out of Bounds
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => sendAlert("Defender Out of Bounds")}
                  >
                    Defender Out of Bounds
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => sendAlert("Bonus Line Crossed Validly")}
                  >
                    Bonus Line Crossed Validly
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => sendAlert("Baulk Line Crossed Validly")}
                  >
                    Baulk Line Crossed Validly
                  </button>
                </div>
              </div>
            )}

            {/* SCORERS */}
            {role === "chief-scorer" && (
              <div style={{ textAlign: "center" }}>
                <h3
                  style={{ marginBottom: "2rem", color: "var(--text-muted)" }}
                >
                  Technical Desk
                </h3>
                <div className="official-action-row">
                  <button className="btn btn-outline">
                    <Pause size={18} /> Official Timeout
                  </button>
                  <button className="btn btn-outline">
                    <Eye size={18} /> TV Review Requested
                  </button>
                </div>
              </div>
            )}

            {/* ASST SCORERS */}
            {(role === "asst-scorer-1" || role === "asst-scorer-2") && (
              <div style={{ textAlign: "center" }}>
                <h3
                  style={{ marginBottom: "2rem", color: "var(--text-muted)" }}
                >
                  Sitting Block & Revival Management
                </h3>
                <div className="official-action-row">
                  <button
                    className="btn btn-outline"
                    style={{
                      color: "var(--danger)",
                      borderColor: "var(--danger)",
                    }}
                    onClick={() => sendAlert("Player Marked Out")}
                  >
                    <UserMinus size={18} /> Mark Player Out
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      color: "var(--accent)",
                      borderColor: "var(--accent)",
                    }}
                    onClick={() => sendAlert("Player Revived")}
                  >
                    <UserPlus size={18} /> Revive Player
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AUDIT LOG FOR ALL OFFICIALS */}
        <div
          className="glass-panel"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div
            style={{
              padding: "1.5rem",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Activity size={18} color="var(--accent)" /> Official Audit Log
            </h3>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
            <AnimatePresence>
              {match.events
                ?.slice()
                .reverse()
                .map((event, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i}
                    style={{
                      padding: "1rem",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "12px",
                      marginBottom: "0.5rem",
                      fontSize: "0.85rem",
                      borderLeft: `3px solid ${event.teamKey === "A" || event.team === match.teamAName ? "var(--primary)" : event.teamKey === "B" || event.team === match.teamBName ? "var(--secondary)" : "var(--accent)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            event.teamKey === "A" ||
                            event.team === match.teamAName
                              ? "var(--primary)"
                              : event.teamKey === "B" ||
                                  event.team === match.teamBName
                                ? "var(--secondary)"
                                : "var(--accent)",
                        }}
                      >
                        {event.team || "Match Official"}
                      </strong>
                      <span style={{ color: "var(--text-muted)" }}>
                        {event.time}s
                      </span>
                    </div>
                    <div>
                      {event.points > 0
                        ? `Scored ${event.points} pts via ${event.type}`
                        : `${event.type}`}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        marginTop: "0.5rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Logged by: {event.roleAction || "System"}
                    </div>
                  </motion.div>
                ))}
              {(!match.events || match.events.length === 0) && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    marginTop: "2rem",
                  }}
                >
                  No events logged yet.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefereeDashboard;
