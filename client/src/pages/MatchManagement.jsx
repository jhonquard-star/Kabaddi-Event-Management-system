import { useState, useEffect } from "react";
import axios from "axios";
import {
  Shuffle,
  Calendar,
  Swords,
  AlertCircle,
  Play,
  Trash2,
  RefreshCw,
  Layers3,
  Trophy,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  EVENT_CHANGE_EVENT,
  getActiveEventId,
  setActiveMatchId,
} from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";
import { formatPoolLabel } from "../utils/matchScoring";

const MatchManagement = () => {
  const [eventId, setEventId] = useState(getActiveEventId());
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [pools, setPools] = useState({});
  const [numPools, setNumPools] = useState(4);
  const [tournamentMode, setTournamentMode] = useState("league");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [selectedTeamForDeletion, setSelectedTeamForDeletion] = useState("");
  const visibleTeams = eventId ? teams : [];
  const isKnockoutFixture = (fixture) => {
    const stage = String(fixture?.stage || "").toLowerCase();
    const round = String(fixture?.round || "").toLowerCase();
    return stage === "knockout" || round.includes("knockout");
  };

  const poolStageFixtures = fixtures.filter(
    (fixture) => !isKnockoutFixture(fixture),
  );
  const knockoutStageFixtures = fixtures.filter(isKnockoutFixture);

  const buildPoolsFromResponse = (poolPayload = {}) => {
    const generatedPools = {};
    Object.entries(poolPayload).forEach(([poolKey, poolTeams]) => {
      generatedPools[poolKey] = poolTeams.map((team) => ({
        name: team.name,
        district: team.district || "Jharkhand",
      }));
    });
    return generatedPools;
  };

  const fetchMatchData = async () => {
    if (!eventId) return;
    try {
      // 1. Fetch Teams
      const teamsRes = await axios.get(`${API_URL}/api/matches/teams`, {
        params: { eventId },
      });
      setTeams(teamsRes.data);

      // 2. Fetch Existing Matches
      const matchesRes = await axios.get(`${API_URL}/api/matches/fixtures`, {
        params: { eventId },
      });
      const activeFixtures = Array.isArray(matchesRes.data)
        ? matchesRes.data.filter(
            (match) => String(match.status || "").toLowerCase() !== "finished",
          )
        : [];
      setFixtures(activeFixtures);

      // 3. Reconstruct Pools dynamically from matches
      const reconstructedPools = {};
      activeFixtures.forEach((m) => {
        if (m.pool) {
          if (!reconstructedPools[m.pool]) {
            reconstructedPools[m.pool] = new Set();
          }
          if (m.teamAName) reconstructedPools[m.pool].add(m.teamAName);
          if (m.teamBName) reconstructedPools[m.pool].add(m.teamBName);
        }
      });

      const finalPools = {};
      Object.entries(reconstructedPools).forEach(([poolKey, teamNames]) => {
        finalPools[poolKey] = Array.from(teamNames).map((name) => {
          const matchTeam = teamsRes.data.find((t) => t.name === name);
          return {
            name,
            district: matchTeam ? matchTeam.district : "Jharkhand",
          };
        });
      });
      setPools(finalPools);
    } catch (err) {
      console.error("Error fetching match data:", err);
    }
  };

  useEffect(() => {
    fetchMatchData();

    const onEventChange = (evt) => {
      setEventId(evt.detail?.eventId || getActiveEventId());
    };
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, [eventId]);

  const generateRandomPoolsAndFixtures = async () => {
    const minimumTeams = tournamentMode === "knockout" ? 2 : 4;
    if (visibleTeams.length < minimumTeams) {
      alert(
        `Minimum ${minimumTeams} teams required for ${tournamentMode} format.`,
      );
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/matches/generate`, {
        eventId,
        teams: visibleTeams,
        numPools,
        mode: tournamentMode,
      });
      setFixtures(res.data.fixtures);

      setPools(buildPoolsFromResponse(res.data.pools));
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllFixtures = async () => {
    if (!eventId) return;
    if (!fixtures.length) {
      alert("No fixtures available to delete.");
      return;
    }
    if (!window.confirm("Delete all fixtures for this event permanently?")) {
      return;
    }

    setActionLoading("delete-all");
    try {
      await axios.delete(`${API_URL}/api/matches/fixtures/all`, {
        params: { eventId },
      });
      setFixtures([]);
      setPools({});
      alert("All fixtures deleted successfully.");
    } catch (err) {
      alert(
        "Failed to delete all fixtures: " + (err.message || "Unknown error"),
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleClearAllGames = async () => {
    if (!eventId) return;
    if (
      !window.confirm(
        "Delete all games (scheduled/live/completed) for this event and keep team/player data?",
      )
    ) {
      return;
    }

    setActionLoading("clear-games");
    try {
      await axios.delete(`${API_URL}/api/matches/fixtures/all`, {
        params: { eventId },
      });
      setFixtures([]);
      setPools({});
      alert("All games cleared. Teams and players are preserved.");
    } catch (error) {
      alert("Failed to clear games.");
    } finally {
      setActionLoading("");
    }
  };

  const handleDeletePlayersBulk = async (teamWise = false) => {
    if (!eventId) return;
    if (teamWise && !selectedTeamForDeletion) {
      alert("Select a team first.");
      return;
    }

    const message = teamWise
      ? "Delete all players of selected team for this event?"
      : "Delete all players of this event?";
    if (!window.confirm(message)) return;

    setActionLoading(teamWise ? "delete-team-players" : "delete-all-players");
    try {
      const params = { eventId };
      if (teamWise) params.teamId = selectedTeamForDeletion;
      const res = await axios.delete(`${API_URL}/api/matches/players/bulk`, {
        params,
      });
      alert(`Deleted ${res.data?.deletedCount || 0} player(s).`);
    } catch (error) {
      alert("Failed to delete players.");
    } finally {
      setActionLoading("");
    }
  };

  const handleRearrangeFixtures = async () => {
    if (!eventId) return;
    const minimumTeams = tournamentMode === "knockout" ? 2 : 4;
    if (visibleTeams.length < minimumTeams) {
      alert(
        `At least ${minimumTeams} teams are required for ${tournamentMode} format.`,
      );
      return;
    }
    if (
      !window.confirm("Rearrange fixtures? Existing fixtures will be replaced.")
    ) {
      return;
    }

    setActionLoading("rearrange");
    try {
      const res = await axios.post(
        `${API_URL}/api/matches/fixtures/rearrange`,
        {
          eventId,
          numPools,
          mode: tournamentMode,
        },
      );
      setFixtures(res.data.fixtures || []);
      setPools(buildPoolsFromResponse(res.data.pools));
      alert("Fixtures rearranged successfully.");
    } catch (err) {
      alert(
        "Failed to rearrange fixtures: " + (err.message || "Unknown error"),
      );
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="animate-fade-in">
      {!eventId && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", marginBottom: "1rem" }}
        >
          Select an event from sidebar before generating pools and fixtures.
        </div>
      )}
      <header className="match-page-header" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 className="title-glow">
            Pool Match <span className="text-gradient">Generator</span>
          </h1>
          <p style={{ color: "var(--text-muted)" }}>
            Advanced algorithmic randomization for fair play fixtures.
          </p>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                fontWeight: "600",
              }}
            >
              Tournament Format
            </label>
            <select
              value={tournamentMode}
              onChange={(e) => setTournamentMode(e.target.value)}
              style={{
                padding: "0.5rem 1rem",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: "600",
                outline: "none",
              }}
            >
              <option value="league" style={{ background: "#111" }}>
                League
              </option>
              <option value="knockout" style={{ background: "#111" }}>
                Knockout
              </option>
            </select>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                fontWeight: "600",
              }}
            >
              Number of Pools
            </label>
            <select
              value={numPools}
              onChange={(e) => setNumPools(parseInt(e.target.value))}
              disabled={tournamentMode === "knockout"}
              style={{
                padding: "0.5rem 1rem",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: "600",
                outline: "none",
              }}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n} style={{ background: "#111" }}>
                  {n} Pools
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-end" }}
            onClick={generateRandomPoolsAndFixtures}
            disabled={loading || actionLoading !== "" || !eventId}
          >
            {loading ? (
              "Processing Algorithms..."
            ) : (
              <>
                <Shuffle size={20} /> Generate Pools & Fixtures
              </>
            )}
          </button>

          <button
            className="btn btn-secondary"
            style={{ alignSelf: "flex-end" }}
            onClick={handleRearrangeFixtures}
            disabled={loading || actionLoading !== "" || !eventId}
          >
            <RefreshCw size={18} />
            {actionLoading === "rearrange"
              ? "Rearranging..."
              : "Rearrange Fixtures"}
          </button>

          <button
            className="btn btn-danger"
            style={{ alignSelf: "flex-end" }}
            onClick={handleDeleteAllFixtures}
            disabled={loading || actionLoading !== "" || !eventId}
          >
            <Trash2 size={18} />
            {actionLoading === "delete-all"
              ? "Deleting..."
              : "Delete All Fixtures"}
          </button>
        </div>
      </header>

      <section
        className="glass-panel"
        style={{ padding: "1rem", marginBottom: "1.5rem" }}
      >
        <h3 style={{ marginBottom: "0.85rem" }}>Admin Maintenance Controls</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          Use these actions to reset games or remove player data quickly.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <button
            className="btn btn-danger"
            onClick={handleClearAllGames}
            disabled={loading || actionLoading !== "" || !eventId}
          >
            {actionLoading === "clear-games"
              ? "Clearing..."
              : "Delete Everything (Keep Teams & Players)"}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleDeletePlayersBulk(false)}
            disabled={loading || actionLoading !== "" || !eventId}
          >
            {actionLoading === "delete-all-players"
              ? "Deleting..."
              : "Delete All Players (This Event)"}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ minWidth: "260px", flex: "1 1 260px" }}>
            <label className="form-label" style={{ marginBottom: "0.35rem" }}>
              Team-wise Player Delete
            </label>
            <select
              className="form-control"
              value={selectedTeamForDeletion}
              onChange={(e) => setSelectedTeamForDeletion(e.target.value)}
            >
              <option value="">Select Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => handleDeletePlayersBulk(true)}
            disabled={loading || actionLoading !== "" || !eventId}
          >
            {actionLoading === "delete-team-players"
              ? "Deleting..."
              : "Delete Players of Selected Team"}
          </button>
        </div>
      </section>

      {visibleTeams.length < 4 && (
        <div
          style={{
            padding: "1.5rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--danger)",
            borderRadius: "12px",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <AlertCircle color="var(--danger)" />
          <span style={{ color: "var(--danger)" }}>
            Insufficient teams registered. Need at least 4 teams. Currently
            registered: {teams.length}
          </span>
        </div>
      )}

      {Object.keys(pools).length > 0 && (
        <div
          className="match-pools-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          {Object.entries(pools).map(([poolKey, poolTeams], poolIndex) => (
            <motion.div
              key={poolKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: poolIndex * 0.05 }}
              className="glass-panel"
              style={{
                padding: "1.5rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "3px",
                  background: `linear-gradient(90deg, var(--primary), var(--secondary))`,
                }}
              ></div>
              <h3
                style={{
                  fontSize: "1.3rem",
                  color: "var(--primary)",
                  marginBottom: "1rem",
                  borderBottom: "1px solid var(--glass-border)",
                  paddingBottom: "0.5rem",
                  fontWeight: "bold",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{formatPoolLabel(poolKey)}</span>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    fontWeight: "normal",
                  }}
                >
                  {poolTeams.length} Teams
                </span>
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {poolTeams.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.02)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    <span className="badge badge-secondary">{t.district}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {tournamentMode === "knockout" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-panel"
          style={{
            padding: "1.35rem",
            marginBottom: "1.75rem",
            border: "1px solid rgba(242, 178, 3, 0.16)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.9rem",
                flexWrap: "wrap",
              }}
            >
              <span
                className="badge badge-secondary"
                style={{
                  display: "inline-flex",
                  gap: "0.45rem",
                  alignItems: "center",
                }}
              >
                <Layers3 size={14} /> Pool Stage
              </span>
              <ChevronRight size={18} color="var(--text-muted)" />
              <span
                className="badge badge-accent"
                style={{
                  display: "inline-flex",
                  gap: "0.45rem",
                  alignItems: "center",
                }}
              >
                <Trophy size={14} /> Knockout Bracket
              </span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Pool winners advance automatically once every pool fixture is
              finished.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              flexWrap: "wrap",
              marginTop: "1rem",
            }}
          >
            {Object.keys(pools).map((poolKey) => (
              <span key={poolKey} className="badge badge-primary">
                {formatPoolLabel(poolKey)}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {fixtures.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel"
          style={{ padding: "2rem" }}
        >
          <h2
            style={{
              fontSize: "1.8rem",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <Calendar color="var(--accent)" /> Official Fixtures Schedule
          </h2>
          {poolStageFixtures.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>
                Pool Stage Fixtures
              </h3>
              <div className="fixtures-grid">
                {poolStageFixtures.map((f, i) => (
                  <div
                    key={`${f.id}-pool`}
                    style={{
                      padding: "1.5rem",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "16px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "4px",
                        height: "100%",
                        background:
                          i % 2 === 0 ? "var(--primary)" : "var(--secondary)",
                      }}
                    ></div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="badge badge-primary">
                          Match {i + 1}
                        </span>
                        <span className="badge badge-secondary">
                          Pool Stage
                        </span>
                        {f.pool && (
                          <span className="badge badge-secondary">
                            {formatPoolLabel(f.pool)}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Assigned to: Referee {(i % 6) + 1}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 800,
                        fontSize: "1.2rem",
                      }}
                    >
                      <div
                        className="fixture-team-name"
                        style={{ flex: 1, textAlign: "center" }}
                      >
                        {f.teamAName}
                      </div>
                      <div
                        style={{
                          margin: "0 1rem",
                          color: "var(--accent)",
                          background: "rgba(16, 185, 129, 0.1)",
                          padding: "0.5rem",
                          borderRadius: "50%",
                        }}
                      >
                        <Swords size={20} />
                      </div>
                      <div
                        className="fixture-team-name"
                        style={{ flex: 1, textAlign: "center" }}
                      >
                        {f.teamBName}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        marginTop: "1.5rem",
                        fontSize: "0.8rem",
                        padding: "0.5rem",
                      }}
                      onClick={async () => {
                        try {
                          await axios.patch(`${API_URL}/api/matches/${f.id}`, {
                            status: "live",
                            createdAt: new Date(),
                          });
                          setActiveMatchId(f.id, eventId);
                          alert(
                            `${f.teamAName} vs ${f.teamBName} is now LIVE!`,
                          );
                        } catch {
                          alert("Failed to set live");
                        }
                      }}
                    >
                      <Play size={14} /> Start Match
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{
                        width: "100%",
                        marginTop: "0.75rem",
                        fontSize: "0.8rem",
                        padding: "0.5rem",
                      }}
                      onClick={async () => {
                        if (!window.confirm("Delete this fixture permanently?"))
                          return;
                        try {
                          await axios.delete(`${API_URL}/api/matches/${f.id}`);
                          await fetchMatchData();
                        } catch {
                          alert("Failed to delete fixture");
                        }
                      }}
                    >
                      Delete Fixture
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {knockoutStageFixtures.length > 0 && (
            <div>
              <h3 style={{ marginBottom: "1rem", color: "var(--accent)" }}>
                Knockout Fixtures
              </h3>
              <div className="fixtures-grid">
                {knockoutStageFixtures.map((f, i) => (
                  <div
                    key={`${f.id}-ko`}
                    style={{
                      padding: "1.5rem",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "16px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "4px",
                        height: "100%",
                        background:
                          i % 2 === 0 ? "var(--accent)" : "var(--primary)",
                      }}
                    ></div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="badge badge-accent">
                          {f.round || "Knockout"}
                        </span>
                        <span className="badge badge-secondary">
                          Winner Advances
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Assigned to: Referee {(i % 6) + 1}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 800,
                        fontSize: "1.2rem",
                      }}
                    >
                      <div
                        className="fixture-team-name"
                        style={{ flex: 1, textAlign: "center" }}
                      >
                        {f.teamAName}
                      </div>
                      <div
                        style={{
                          margin: "0 1rem",
                          color: "var(--accent)",
                          background: "rgba(16, 185, 129, 0.1)",
                          padding: "0.5rem",
                          borderRadius: "50%",
                        }}
                      >
                        <Trophy size={20} />
                      </div>
                      <div
                        className="fixture-team-name"
                        style={{ flex: 1, textAlign: "center" }}
                      >
                        {f.teamBName}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        marginTop: "1.5rem",
                        fontSize: "0.8rem",
                        padding: "0.5rem",
                      }}
                      onClick={async () => {
                        try {
                          await axios.patch(`${API_URL}/api/matches/${f.id}`, {
                            status: "live",
                            createdAt: new Date(),
                          });
                          setActiveMatchId(f.id, eventId);
                          alert(
                            `${f.teamAName} vs ${f.teamBName} is now LIVE!`,
                          );
                        } catch {
                          alert("Failed to set live");
                        }
                      }}
                    >
                      <Play size={14} /> Start Match
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{
                        width: "100%",
                        marginTop: "0.75rem",
                        fontSize: "0.8rem",
                        padding: "0.5rem",
                      }}
                      onClick={async () => {
                        if (!window.confirm("Delete this fixture permanently?"))
                          return;
                        try {
                          await axios.delete(`${API_URL}/api/matches/${f.id}`);
                          await fetchMatchData();
                        } catch {
                          alert("Failed to delete fixture");
                        }
                      }}
                    >
                      Delete Fixture
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default MatchManagement;
