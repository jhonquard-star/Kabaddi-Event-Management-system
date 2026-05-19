import { useState, useEffect } from "react";
import axios from "axios";
import { Shuffle, Calendar, Swords, AlertCircle, Play } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CHANGE_EVENT, getActiveEventId } from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";

const MatchManagement = () => {
  const [eventId, setEventId] = useState(getActiveEventId());
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [pools, setPools] = useState({});
  const [numPools, setNumPools] = useState(4);
  const [loading, setLoading] = useState(false);
  const visibleTeams = eventId ? teams : [];

  const fetchMatchData = async () => {
    if (!eventId) return;
    try {
      // 1. Fetch Teams
      const teamsRes = await axios.get(`${API_URL}/api/matches/teams`, {
        params: { eventId },
      });
      setTeams(teamsRes.data);

      // 2. Fetch Existing Matches
      const matchesRes = await axios.get(`${API_URL}/api/matches`, {
        params: { eventId },
      });
      setFixtures(matchesRes.data);

      // 3. Reconstruct Pools dynamically from matches
      const reconstructedPools = {};
      matchesRes.data.forEach((m) => {
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
    if (visibleTeams.length < 4) {
      alert("Minimum 4 teams required to create pools and matches.");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/matches/generate`, {
        eventId,
        teams: visibleTeams,
        numPools,
      });
      setFixtures(res.data.fixtures);
      
      // Use the dynamically returned pools from the backend!
      const generatedPools = {};
      Object.entries(res.data.pools).forEach(([poolKey, poolTeams]) => {
        generatedPools[poolKey] = poolTeams.map(t => ({
          name: t.name,
          district: t.district || "Jharkhand"
        }));
      });
      setPools(generatedPools);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600" }}>
              Number of Pools
            </label>
            <select
              value={numPools}
              onChange={(e) => setNumPools(parseInt(e.target.value))}
              style={{
                padding: "0.5rem 1rem",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: "600",
                outline: "none"
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
            disabled={loading || !eventId}
          >
            {loading ? (
              "Processing Algorithms..."
            ) : (
              <>
                <Shuffle size={20} /> Generate Pools & Fixtures
              </>
            )}
          </button>
        </div>
      </header>

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
            marginBottom: "3rem" 
          }}
        >
          {Object.entries(pools).map(([poolKey, poolTeams], poolIndex) => (
            <motion.div
              key={poolKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: poolIndex * 0.05 }}
              className="glass-panel"
              style={{ padding: "1.5rem", position: "relative", overflow: "hidden" }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "3px",
                  background: `linear-gradient(90deg, var(--primary), var(--secondary))`
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
                  justifyContent: "space-between"
                }}
              >
                <span>POOL {poolKey}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal" }}>
                  {poolTeams.length} Teams
                </span>
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
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
                      border: "1px solid rgba(255,255,255,0.02)"
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
          <div className="fixtures-grid">
            {fixtures.map((f, i) => (
              <div
                key={i}
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
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span className="badge badge-primary">Match {i + 1}</span>
                    {f.pool && <span className="badge badge-secondary">Pool {f.pool}</span>}
                  </div>
                  <span
                    style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}
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
                      alert(`${f.teamAName} vs ${f.teamBName} is now LIVE!`);
                    } catch {
                      alert("Failed to set live");
                    }
                  }}
                >
                  <Play size={14} /> Send to Live Queue
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
                      setFixtures((current) =>
                        current.filter((fixture) => fixture.id !== f.id),
                      );
                      setPools((current) => ({
                        A: current.A.filter(
                          (team) =>
                            team.id !== f.teamAId && team.id !== f.teamBId,
                        ),
                        B: current.B.filter(
                          (team) =>
                            team.id !== f.teamAId && team.id !== f.teamBId,
                        ),
                      }));
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
        </motion.div>
      )}
    </div>
  );
};

export default MatchManagement;
