import { useState, useEffect } from "react";
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

const RefereeDashboard = () => {
  const { role } = useParams(); // 'chief-referee', 'umpire-1', etc.
  const [match, setMatch] = useState(null);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/live`);
        setMatch(res.data);
      } catch {
        setMatch(null);
      }
    };
    fetchMatch();
    const interval = setInterval(fetchMatch, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateScore = async (team, points, type) => {
    if (!match) return;
    const field = team === "A" ? "scoreA" : "scoreB";
    const newScore = (match[field] || 0) + points;
    const event = {
      time: match.timer,
      type,
      team,
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
      time: match.timer,
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
      <header
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 350px",
          gap: "2rem",
        }}
      >
        <div
          className="glass-panel"
          style={{ padding: "0", display: "flex", flexDirection: "column" }}
        >
          {/* Global Header for Match State */}
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1.5rem",
              textAlign: "center",
              borderBottom: "1px solid var(--glass-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
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
                  onClick={() => setTimerActive(!timerActive)}
                >
                  {timerActive ? (
                    <>
                      <Pause size={18} /> STOP CLOCK
                    </>
                  ) : (
                    <>
                      <Play size={18} /> START CLOCK
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
                    Give Point A
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      updateScore("B", 1, "Referee Override Point B")
                    }
                  >
                    Give Point B
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5rem",
                  }}
                >
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5rem",
                  }}
                >
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "1rem",
                  }}
                >
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "2rem",
                  }}
                >
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
                      borderLeft: `3px solid ${event.team === "A" ? "var(--primary)" : event.team === "B" ? "var(--secondary)" : "var(--accent)"}`,
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
                            event.team === "A"
                              ? "var(--primary)"
                              : event.team === "B"
                                ? "var(--secondary)"
                                : "var(--accent)",
                        }}
                      >
                        {event.team === "A"
                          ? match.teamAName
                          : event.team === "B"
                            ? match.teamBName
                            : "Match Official"}
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
