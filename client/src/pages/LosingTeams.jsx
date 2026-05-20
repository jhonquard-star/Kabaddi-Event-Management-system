import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, CalendarDays, Swords } from "lucide-react";
import { EVENT_CHANGE_EVENT, getActiveEventId } from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";
import { formatFixtureLabel } from "../utils/matchScoring";

const LosingTeams = () => {
  const [eventId, setEventId] = useState(getActiveEventId());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLosers = async () => {
    if (!eventId) {
      setMatches([]);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/matches/fixtures`, {
        params: { eventId, status: "finished" },
      });
      setMatches(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to load losing teams:", error);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLosers();
    const onEventChange = (evt) => {
      setEventId(evt.detail?.eventId || getActiveEventId());
    };
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, [eventId]);

  const sortedMatches = useMemo(
    () =>
      [...matches].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      ),
    [matches],
  );

  const getLoserLabel = (match) => {
    if (match.loserTeamName) return match.loserTeamName;
    const scoreA = Number(match.scoreA || 0);
    const scoreB = Number(match.scoreB || 0);
    if (match.teamBName === "BYE") return "BYE";
    return scoreA > scoreB ? match.teamBName : match.teamAName;
  };

  return (
    <div className="page-shell animate-fade-in">
      <header className="page-header">
        <div>
          <span className="eyebrow">Elimination board</span>
          <h1>Losing Teams</h1>
          <p>
            View teams that were eliminated from finished fixtures for the
            selected event.
          </p>
        </div>
        <div
          className="badge badge-secondary"
          style={{ padding: "0.65rem 1rem" }}
        >
          <AlertTriangle size={16} /> {sortedMatches.length} Eliminated Games
        </div>
      </header>

      {!eventId && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", marginBottom: "1rem" }}
        >
          Select an event from the sidebar to view losing teams.
        </div>
      )}

      {loading && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", marginBottom: "1rem" }}
        >
          Loading losing teams...
        </div>
      )}

      {!loading && eventId && sortedMatches.length === 0 && (
        <div
          className="glass-panel"
          style={{ padding: "2rem", textAlign: "center" }}
        >
          No completed games found for this event.
        </div>
      )}

      {sortedMatches.length > 0 && (
        <section className="fixtures-grid">
          {sortedMatches.map((match, index) => (
            <article
              key={match.id || `${match.teamAName}-${match.teamBName}-${index}`}
              className="glass-panel"
              style={{ padding: "1.25rem", display: "grid", gap: "0.9rem" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="badge badge-primary">Game {index + 1}</span>
                  {formatFixtureLabel(match) ? (
                    <span className="badge badge-secondary">
                      {formatFixtureLabel(match)}
                    </span>
                  ) : null}
                  {match.round ? (
                    <span className="badge badge-secondary">{match.round}</span>
                  ) : null}
                </div>
                <span
                  style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}
                >
                  <CalendarDays
                    size={14}
                    style={{ verticalAlign: "middle", marginRight: "0.3rem" }}
                  />
                  {new Date(
                    match.updatedAt || match.createdAt || Date.now(),
                  ).toLocaleString()}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <strong
                  className="fixture-team-name"
                  style={{ flex: 1, textAlign: "center", fontSize: "1.05rem" }}
                >
                  {match.teamAName}
                </strong>
                <span
                  className="badge badge-accent"
                  style={{ minWidth: "140px", justifyContent: "center" }}
                >
                  {Number(match.scoreA || 0)}
                  <Swords size={14} style={{ margin: "0 0.4rem" }} />
                  {Number(match.scoreB || 0)}
                </span>
                <strong
                  className="fixture-team-name"
                  style={{ flex: 1, textAlign: "center", fontSize: "1.05rem" }}
                >
                  {match.teamBName}
                </strong>
              </div>

              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "10px",
                  padding: "0.75rem",
                  color: "#fca5a5",
                  fontWeight: 700,
                }}
              >
                Eliminated: {getLoserLabel(match)}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default LosingTeams;
