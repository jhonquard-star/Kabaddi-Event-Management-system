import { useState, useEffect } from "react";
import axios from "axios";
import { Trophy, Activity, Radio } from "lucide-react";
import { API_URL } from "../utils/apiBase";
import {
  EVENT_CHANGE_EVENT,
  MATCH_CHANGE_EVENT,
  getActiveEventId,
  getActiveMatchId,
  setActiveMatchId,
} from "../utils/eventSelection";

const Scoreboard = () => {
  const [match, setMatch] = useState(null);
  const [eventId, setEventId] = useState(getActiveEventId());
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(
    getActiveMatchId(getActiveEventId()),
  );
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  const isMobile = viewportWidth <= 640;
  const isTablet = viewportWidth <= 960;

  const readTimerState = (matchId) => {
    if (!matchId) return null;

    const active =
      localStorage.getItem(`kabaddi_timer_active_${matchId}`) === "true";
    const lastStarted = localStorage.getItem(
      `kabaddi_timer_last_started_at_${matchId}`,
    );
    const atStart = localStorage.getItem(`kabaddi_timer_at_start_${matchId}`);
    const paused = localStorage.getItem(`kabaddi_timer_${matchId}`);

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
        timerAtStart: parseInt(atStart) || 1200,
        timer: computed,
        ...scores,
      };
    } else if (paused !== null) {
      return {
        timerActive: false,
        timer: parseInt(paused),
        ...scores,
      };
    }
    return Object.keys(scores).length > 0 ? scores : null;
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const local = readTimerState(selectedMatchId || match?.id);
      if (local && match) {
        setMatch((prev) => (prev ? { ...prev, ...local } : null));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [match?.id, selectedMatchId]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    const onEventChange = (evt) => {
      const nextEventId = evt.detail?.eventId || getActiveEventId();
      setEventId(nextEventId);
      setSelectedMatchId(getActiveMatchId(nextEventId));
    };
    const onMatchChange = (evt) => {
      if (evt.detail?.eventId && evt.detail.eventId !== eventId) return;
      setSelectedMatchId(evt.detail?.matchId || "");
    };

    window.addEventListener("resize", onResize);
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    window.addEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
      window.removeEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    };
  }, [eventId]);

  useEffect(() => {
    let fetchInterval;

    const fetchMatch = async () => {
      try {
        if (!eventId) {
          setLiveMatches([]);
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

        const activeMatchId = currentLiveMatches.some(
          (item) => item.id === candidateId,
        )
          ? candidateId
          : currentLiveMatches[0]?.id || "";

        if (!activeMatchId) {
          setSelectedMatchId("");
          setMatch(null);
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

          const local = readTimerState(activeMatchId);

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

          // If we have a previous match and it's active, don't overwrite the timer with an older value
          if (prev && prev.id === updatedData.id && updatedData.timerActive) {
            return { ...updatedData, timer: prev.timer };
          }
          return updatedData;
        });
      } catch {
        setMatch(null);
      }
    };

    fetchMatch();
    fetchInterval = setInterval(fetchMatch, 3000); // Poll backend every 3 seconds

    return () => clearInterval(fetchInterval);
  }, [eventId, selectedMatchId]);

  // Visual smooth ticker (immune to browser throttling)
  useEffect(() => {
    let tickInterval = null;
    if (match?.timerActive && match?.timerLastStartedAt) {
      tickInterval = setInterval(() => {
        setMatch((prev) => {
          if (!prev) return prev;
          const timerAtStart =
            prev.timerAtStart !== undefined
              ? prev.timerAtStart
              : prev.timer !== undefined
                ? prev.timer
                : 1200;
          const elapsed = Math.floor(
            (Date.now() - prev.timerLastStartedAt) / 1000,
          );
          const computedTimer = Math.max(0, timerAtStart - elapsed);

          if (computedTimer === 0 && prev.timer !== 0) {
            return { ...prev, timer: 0, timerActive: false };
          }
          return { ...prev, timer: computedTimer };
        });
      }, 500); // 500ms for smooth updates
    }
    return () => clearInterval(tickInterval);
  }, [match?.timerActive, match?.timerLastStartedAt]);

  if (!match)
    return (
      <div
        className="glass-panel"
        style={{ padding: "4rem", textAlign: "center", fontSize: "2rem" }}
      >
        <Activity
          className="animate-spin"
          size={48}
          style={{ margin: "0 auto 1rem", display: "block" }}
        />{" "}
        {eventId
          ? "Waiting for active fixture feed..."
          : "Select an active event to load scoreboard."}
      </div>
    );

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: "1rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          className="badge badge-accent"
          style={{
            fontSize: "1rem",
            padding: "0.5rem 1.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            animation: "pulse 2s infinite",
          }}
        >
          <Radio size={20} /> LIVE BROADCAST
        </div>
        {liveMatches.length > 0 && (
          <div style={{ marginTop: "0.9rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.35rem",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              Select Live Game
            </label>
            <select
              className="form-control"
              value={selectedMatchId}
              onChange={(e) => {
                const nextMatchId = e.target.value;
                setSelectedMatchId(nextMatchId);
                setActiveMatchId(nextMatchId, eventId);
              }}
              style={{
                maxWidth: "640px",
                margin: "0 auto",
                background: "rgba(0,0,0,0.55)",
              }}
            >
              {liveMatches.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.teamAName} vs {game.teamBName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div
        className="glass-panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "rgba(5, 5, 10, 0.95)",
          border: "2px solid rgba(255,255,255,0.1)",
          boxShadow: "0 0 50px rgba(249, 115, 22, 0.1)",
        }}
      >
        {/* Top Bar - Timer & Details */}
        <div
          style={{
            display: "flex",
            flexDirection: isTablet ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isTablet ? "stretch" : "center",
            padding: isMobile ? "1rem" : isTablet ? "1.25rem" : "2rem 4rem",
            gap: isTablet ? "1rem" : "0",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)",
          }}
        >
          <div>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
              }}
            >
              PRO KABADDI SEASON 11
            </div>
            <div
              style={{ color: "white", fontSize: "1.5rem", fontWeight: 800 }}
            >
              {match.pool ? `POOL ${match.pool}` : "MATCH LIVE"}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              background: "rgba(0,0,0,0.8)",
              padding: isMobile ? "0.8rem 1rem" : "1rem 3rem",
              borderRadius: "20px",
              border: "1px solid var(--glass-border)",
              alignSelf: isTablet ? "center" : "auto",
            }}
          >
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                letterSpacing: "0.2em",
                marginBottom: "0.5rem",
              }}
            >
              TIME REMAINING
            </div>
            <div
              className="timer-value"
              style={{
                fontSize: isMobile ? "2.1rem" : isTablet ? "3rem" : "4rem",
                textShadow: "0 0 30px var(--accent)",
              }}
            >
              {Math.floor((match.timer !== undefined ? match.timer : 1200) / 60)
                .toString()
                .padStart(2, "0")}
              :
              {((match.timer !== undefined ? match.timer : 1200) % 60)
                .toString()
                .padStart(2, "0")}
            </div>
          </div>

          <div style={{ textAlign: isTablet ? "left" : "right" }}>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
              }}
            >
              VENUE
            </div>
            <div
              style={{ color: "white", fontSize: "1.5rem", fontWeight: 800 }}
            >
              INDOOR STADIUM
            </div>
          </div>
        </div>

        {/* Main Score Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: isTablet ? "column" : "row",
            padding: isMobile ? "0.75rem" : "0 2rem",
            gap: isTablet ? "1rem" : "0",
          }}
        >
          {/* Team A */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "2rem",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  "radial-gradient(circle at center, rgba(249, 115, 22, 0.15), transparent 70%)",
                zIndex: 0,
              }}
            ></div>
            <div style={{ zIndex: 1, textAlign: "center", width: "100%" }}>
              <h2
                style={{
                  fontSize: isMobile ? "1.6rem" : isTablet ? "2rem" : "3rem",
                  color: "var(--primary)",
                  textTransform: "uppercase",
                  marginBottom: "2rem",
                  textShadow: "0 0 20px rgba(249, 115, 22, 0.5)",
                }}
              >
                {match.teamAName}
              </h2>
              <div
                style={{
                  background: "rgba(0,0,0,0.6)",
                  borderRadius: "30px",
                  padding: isMobile ? "1rem" : "2rem",
                  border: "2px solid rgba(249, 115, 22, 0.3)",
                  boxShadow: "inset 0 0 50px rgba(0,0,0,0.8)",
                }}
              >
                <span
                  className="score-value"
                  style={{
                    fontSize: isMobile ? "5rem" : isTablet ? "8rem" : "14rem",
                    textShadow: "0 0 50px rgba(255,255,255,0.3)",
                  }}
                >
                  {match.scoreA}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isTablet ? "0" : "0 2rem",
              zIndex: 2,
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                padding: isMobile ? "0.8rem" : "1.5rem",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Trophy size={isMobile ? 28 : 48} color="white" />
            </div>
          </div>

          {/* Team B */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "2rem",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  "radial-gradient(circle at center, rgba(59, 130, 246, 0.15), transparent 70%)",
                zIndex: 0,
              }}
            ></div>
            <div style={{ zIndex: 1, textAlign: "center", width: "100%" }}>
              <h2
                style={{
                  fontSize: isMobile ? "1.6rem" : isTablet ? "2rem" : "3rem",
                  color: "var(--secondary)",
                  textTransform: "uppercase",
                  marginBottom: "2rem",
                  textShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
                }}
              >
                {match.teamBName}
              </h2>
              <div
                style={{
                  background: "rgba(0,0,0,0.6)",
                  borderRadius: "30px",
                  padding: isMobile ? "1rem" : "2rem",
                  border: "2px solid rgba(59, 130, 246, 0.3)",
                  boxShadow: "inset 0 0 50px rgba(0,0,0,0.8)",
                }}
              >
                <span
                  className="score-value"
                  style={{
                    fontSize: isMobile ? "5rem" : isTablet ? "8rem" : "14rem",
                    textShadow: "0 0 50px rgba(255,255,255,0.3)",
                  }}
                >
                  {match.scoreB}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Ticker */}
        <div
          style={{
            background: "var(--primary)",
            color: "white",
            padding: isMobile ? "0.8rem" : "1rem",
            fontWeight: 800,
            fontSize: isMobile ? "0.9rem" : "1.2rem",
            letterSpacing: "0.1em",
            overflow: "hidden",
            whiteSpace: "nowrap",
            borderBottomLeftRadius: "18px",
            borderBottomRightRadius: "18px",
          }}
        >
          <div
            style={{
              animation: "marquee 20s linear infinite",
              display: "inline-block",
            }}
          >
            LATEST ACTION:{" "}
            {match.events && match.events.length > 0
              ? `${match.events[match.events.length - 1].team || (match.events[match.events.length - 1].teamKey === "A" ? match.teamAName : match.teamBName)} SCORED ${match.events[match.events.length - 1].points} POINTS VIA ${match.events[match.events.length - 1].type.toUpperCase()}`
              : "MATCH IS UNDERWAY - STAY TUNED FOR LIVE ACTION!"}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};

export default Scoreboard;
