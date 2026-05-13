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
  const [pools, setPools] = useState({ A: [], B: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setTeams([]);
      return;
    }

    const fetchTeams = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/teams`, {
          params: { eventId },
        });
        setTeams(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTeams();

    const onEventChange = (evt) =>
      setEventId(evt.detail?.eventId || getActiveEventId());
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, [eventId]);

  const generateRandomPoolsAndFixtures = async () => {
    if (teams.length < 4) {
      alert("Minimum 4 teams required to create pools and matches.");
      return;
    }

    setLoading(true);
    // Client-side visual generation for Pools
    const shuffled = [...teams].sort(() => 0.5 - Math.random());
    const half = Math.ceil(shuffled.length / 2);
    const poolA = shuffled.slice(0, half);
    const poolB = shuffled.slice(half);

    setPools({ A: poolA, B: poolB });

    try {
      const res = await axios.post(`${API_URL}/api/matches/generate`, {
        eventId,
        teams,
      });
      setFixtures(res.data.fixtures);
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
      <header
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 className="title-glow">
            Pool Match <span className="text-gradient">Generator</span>
          </h1>
          <p style={{ color: "var(--text-muted)" }}>
            Advanced algorithmic randomization for fair play fixtures.
          </p>
        </div>
        <button
          className="btn btn-primary"
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
      </header>

      {teams.length < 4 && (
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

      {pools.A.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2rem",
            marginBottom: "3rem",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel"
            style={{ padding: "2rem" }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                color: "var(--primary)",
                marginBottom: "1.5rem",
                borderBottom: "1px solid var(--glass-border)",
                paddingBottom: "1rem",
              }}
            >
              POOL A
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {pools.A.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "1rem",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "8px",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span className="badge badge-secondary">{t.district}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel"
            style={{ padding: "2rem" }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                color: "var(--secondary)",
                marginBottom: "1.5rem",
                borderBottom: "1px solid var(--glass-border)",
                paddingBottom: "1rem",
              }}
            >
              POOL B
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {pools.B.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "1rem",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "8px",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span className="badge badge-primary">{t.district}</span>
                </div>
              ))}
            </div>
          </motion.div>
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
              gap: "1.5rem",
            }}
          >
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
                  <span className="badge badge-primary">Match {i + 1}</span>
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
                  <div style={{ flex: 1, textAlign: "center" }}>
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
                  <div style={{ flex: 1, textAlign: "center" }}>
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
