import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle2, Trophy, CalendarDays, Swords } from "lucide-react";
import { EVENT_CHANGE_EVENT, getActiveEventId } from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";
import { formatFixtureLabel } from "../utils/matchScoring";

const CompletedGames = () => {
  const [eventId, setEventId] = useState(getActiveEventId());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCompletedMatches = async () => {
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
      console.error("Failed to load completed matches:", error);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedMatches();
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

  const getResultLabel = (match) => {
    const scoreA = Number(match.scoreA || 0);
    const scoreB = Number(match.scoreB || 0);

    if (match.teamBName === "BYE") {
      return `${match.teamAName} advanced by BYE`;
    }

    if (scoreA === scoreB) {
      return "Draw";
    }

    if (scoreA > scoreB) {
      return `${match.teamAName} won by ${scoreA - scoreB}`;
    }

    return `${match.teamBName} won by ${scoreB - scoreA}`;
  };

  const getEvaluation = (match) => match.refereeEvaluation || null;

  const deleteCompletedGame = async (matchId) => {
    if (!window.confirm("Delete this completed game permanently?")) return;
    try {
      await axios.delete(`${API_URL}/api/matches/${matchId}`);
      await fetchCompletedMatches();
    } catch (error) {
      alert("Failed to delete completed game.");
    }
  };

  const redoGame = async (matchItem) => {
    if (!window.confirm("Move this completed game back to scheduled state?")) {
      return;
    }
    try {
      await axios.patch(`${API_URL}/api/matches/${matchItem.id}`, {
        status: "scheduled",
        scoreA: 0,
        scoreB: 0,
        timer: 1200,
        timerActive: false,
        timerLastStartedAt: null,
        timerAtStart: 1200,
        events: [],
      });
      await fetchCompletedMatches();
    } catch (error) {
      alert("Failed to redo game.");
    }
  };

  return (
    <div className="page-shell animate-fade-in">
      <header className="page-header">
        <div>
          <span className="eyebrow">Match archive</span>
          <h1>Completed Games</h1>
          <p>
            View all finished fixtures for the selected event with final scores
            and results.
          </p>
        </div>
        <div
          className="badge badge-secondary"
          style={{ padding: "0.65rem 1rem" }}
        >
          <CheckCircle2 size={16} /> {sortedMatches.length} Completed
        </div>
      </header>

      {!eventId && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", marginBottom: "1rem" }}
        >
          Select an event from sidebar to view completed games.
        </div>
      )}

      {loading && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", marginBottom: "1rem" }}
        >
          Loading completed games...
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
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span className="badge badge-primary">Game {index + 1}</span>
                  <span className="badge badge-secondary">
                    {(match.tournamentMode || "league").toUpperCase()}
                  </span>
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
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  borderRadius: "10px",
                  padding: "0.75rem",
                  color: "#fbbf24",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Trophy size={16} /> {getResultLabel(match)}
              </div>

              {getEvaluation(match) && (
                <div
                  style={{
                    borderRadius: "12px",
                    padding: "0.9rem",
                    background: "rgba(59, 130, 246, 0.08)",
                    border: "1px solid rgba(59, 130, 246, 0.25)",
                    display: "grid",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>Final Evaluation</strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      Winner: {getEvaluation(match).winner} · Margin:{" "}
                      {getEvaluation(match).margin}
                    </span>
                  </div>
                  <div className="fixtures-grid" style={{ gap: "0.75rem" }}>
                    {getEvaluation(match).roleSummaries?.map((summary) => (
                      <div
                        key={summary.role}
                        style={{
                          padding: "0.75rem",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.75)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <strong>{summary.roleLabel}</strong>
                        <div
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                            marginTop: "0.25rem",
                          }}
                        >
                          Score A {summary.scoreA} · Score B {summary.scoreB} ·
                          Events {summary.events} · Half records{" "}
                          {summary.halfSnapshots}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}
              >
                <button
                  className="btn btn-secondary"
                  style={{ flex: "1 1 180px" }}
                  onClick={() => redoGame(match)}
                >
                  Redo Game
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: "1 1 180px" }}
                  onClick={() => deleteCompletedGame(match.id)}
                >
                  Delete Completed Game
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default CompletedGames;
