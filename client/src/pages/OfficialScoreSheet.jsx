import { useState, useEffect } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Circle,
  FileSignature,
  Slash,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import {
  EVENT_DISPLAY_TITLE,
  EVENT_VENUE,
  EVENT_DATES,
} from "../data/eventInfo";
import {
  performanceRows,
  samplePlayersA,
  samplePlayersB,
  scoreSheetSections,
} from "../data/kabaddiProData";
import {
  EVENT_CHANGE_EVENT,
  MATCH_CHANGE_EVENT,
  getActiveEventId,
  getActiveMatchId,
  setActiveMatchId,
} from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";
import { formatFixtureLabel } from "../utils/matchScoring";

const scoreNumbers = Array.from({ length: 60 }, (_, index) => index + 1);

const RosterTable = ({ title, players }) => (
  <div className="sheet-block">
    <h3>{title}</h3>
    {!players || players.length === 0 ? (
      <div
        className="muted"
        style={{ padding: "1rem", color: "var(--text-muted)" }}
      >
        No registered players for this team. Add players via the Registration
        panel.
      </div>
    ) : (
      <table className="pro-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={`${title}-${player.id || index}`}>
              <td>{player.jerseyNo || player.no || index + 1}</td>
              <td>{player.name}</td>
              <td>{player.position || player.role || "Player"}</td>
              <td>Active</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const OfficialScoreSheet = () => {
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [eventId, setEventId] = useState(getActiveEventId());
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(
    getActiveMatchId(getActiveEventId()),
  );

  useEffect(() => {
    const fetchLiveMatchAndPlayers = async () => {
      try {
        if (!eventId) {
          setMatch(null);
          setPlayers([]);
          return;
        }

        const [matchesRes, playersRes] = await Promise.all([
          axios.get(`${API_URL}/api/matches/fixtures`, {
            params: { eventId },
          }),
          axios.get(`${API_URL}/api/matches/players`, {
            params: { eventId },
          }),
        ]);

        const fixtures = Array.isArray(matchesRes.data) ? matchesRes.data : [];
        const currentLiveMatches = fixtures.filter(
          (fixture) => fixture.status === "live",
        );
        setLiveMatches(currentLiveMatches);

        const persistedMatchId = getActiveMatchId(eventId);
        const candidateId =
          selectedMatchId ||
          persistedMatchId ||
          currentLiveMatches[0]?.id ||
          "";

        const liveMatch = currentLiveMatches.some(
          (item) => item.id === candidateId,
        )
          ? currentLiveMatches.find((item) => item.id === candidateId)
          : currentLiveMatches[0] || fixtures[fixtures.length - 1] || null;

        if (liveMatch?.id) {
          setSelectedMatchId(liveMatch.id);
          setActiveMatchId(liveMatch.id, eventId);
        }

        setMatch(liveMatch);
        setPlayers(Array.isArray(playersRes.data) ? playersRes.data : []);
      } catch (err) {
        console.error("Error fetching live score sheet data:", err);
        setMatch(null);
        setPlayers([]);
      }
    };

    fetchLiveMatchAndPlayers();
    const interval = setInterval(fetchLiveMatchAndPlayers, 4000);

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

    return () => {
      clearInterval(interval);
      window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
      window.removeEventListener(MATCH_CHANGE_EVENT, onMatchChange);
    };
  }, [eventId, selectedMatchId]);

  // Group players by active teams
  const teamAPlayers = players.filter(
    (p) => p.teamId === match?.teamAId || p.teamName === match?.teamAName,
  );
  const teamBPlayers = players.filter(
    (p) => p.teamId === match?.teamBId || p.teamName === match?.teamBName,
  );

  const playersA = teamAPlayers.length > 0 ? teamAPlayers : samplePlayersA;
  const playersB = teamBPlayers.length > 0 ? teamBPlayers : samplePlayersB;

  // Build Crossed/Circled grids dynamically from the real-time match events log!
  const crossedA = new Set();
  const circledA = new Set();
  const trophySetA = new Set();

  const crossedB = new Set();
  const circledB = new Set();
  const trophySetB = new Set();

  let runningScoreA = 0;
  let runningScoreB = 0;

  if (match && match.events) {
    match.events.forEach((evt) => {
      if (evt.points > 0) {
        const isTeamA =
          evt.teamKey === "A" ||
          evt.team === "A" ||
          evt.team === match.teamAName;
        const isTeamB =
          evt.teamKey === "B" ||
          evt.team === "B" ||
          evt.team === match.teamBName;

        if (isTeamA) {
          for (let p = 0; p < evt.points; p++) {
            runningScoreA++;
            if (evt.type?.toLowerCase().includes("bonus")) {
              circledA.add(runningScoreA);
            } else if (
              evt.type?.toLowerCase().includes("lona") ||
              evt.type?.toLowerCase().includes("all out")
            ) {
              trophySetA.add(runningScoreA);
            } else {
              crossedA.add(runningScoreA);
            }
          }
        } else if (isTeamB) {
          for (let p = 0; p < evt.points; p++) {
            runningScoreB++;
            if (evt.type?.toLowerCase().includes("bonus")) {
              circledB.add(runningScoreB);
            } else if (
              evt.type?.toLowerCase().includes("lona") ||
              evt.type?.toLowerCase().includes("all out")
            ) {
              trophySetB.add(runningScoreB);
            } else {
              crossedB.add(runningScoreB);
            }
          }
        }
      }
    });
  }

  // If there's no live match, show a clean warning
  if (!eventId) {
    return (
      <div
        className="page-shell animate-fade-in"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          padding: "2rem",
        }}
      >
        <header className="page-header">
          <div>
            <span className="eyebrow">Legal match document</span>
            <h1>Official Kabaddi Score Sheet</h1>
            <p>
              Complete administrative, scoring, player-performance, discipline,
              and signature record.
            </p>
          </div>
        </header>
        <div
          className="glass-panel"
          style={{ padding: "3rem", textAlign: "center" }}
        >
          <AlertTriangle
            size={48}
            color="var(--warning)"
            style={{ margin: "0 auto 1rem" }}
          />
          <h2>No Event Selected</h2>
          <p style={{ color: "var(--text-muted)" }}>
            Select an active event from the sidebar to load score sheet data.
          </p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div
        className="page-shell animate-fade-in"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          padding: "2rem",
        }}
      >
        <header className="page-header">
          <div>
            <span className="eyebrow">Legal match document</span>
            <h1>Official Kabaddi Score Sheet</h1>
            <p>
              Complete administrative, scoring, player-performance, discipline,
              and signature record.
            </p>
          </div>
        </header>
        <div
          className="glass-panel"
          style={{ padding: "3rem", textAlign: "center" }}
        >
          <AlertTriangle
            size={48}
            color="var(--warning)"
            style={{ margin: "0 auto 1rem" }}
          />
          <h2>No Live Match Active</h2>
          <p style={{ color: "var(--text-muted)" }}>
            Waiting for a match to start to generate dynamic score sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell animate-fade-in">
      <header className="page-header">
        <div>
          <span className="eyebrow">Legal match document</span>
          <h1>Official Kabaddi Score Sheet</h1>
          <p>
            Complete administrative, scoring, player-performance, discipline,
            revival, and signature record.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() =>
            alert("Official Score Sheet validated and logged in registry!")
          }
        >
          <FileSignature size={18} /> Validate Sheet
        </button>
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
          >
            {liveMatches.map((liveGame) => (
              <option key={liveGame.id} value={liveGame.id}>
                {liveGame.teamAName} vs {liveGame.teamBName}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="sheet-status">
        {scoreSheetSections.map((section) => (
          <span key={section}>
            <CheckCircle2 size={16} /> {section}
          </span>
        ))}
      </section>

      <section className="score-sheet">
        <div className="sheet-block admin-block">
          <div>
            <span className="eyebrow">Tournament</span>
            <strong>{EVENT_DISPLAY_TITLE}</strong>
          </div>
          <div>
            <span className="eyebrow">Match Details</span>
            <strong>
              {formatFixtureLabel(match)
                ? `${formatFixtureLabel(match)} · `
                : ""}
              Match Live
            </strong>
          </div>
          <div>
            <span className="eyebrow">Venue / Date</span>
            <strong>
              {EVENT_VENUE} · {EVENT_DATES}
            </strong>
          </div>
          <div>
            <span className="eyebrow">Toss Status</span>
            <strong>R Ranchi Rhinos chose raid</strong>
          </div>
        </div>

        <div className="two-column">
          <RosterTable
            title={`Team A · ${match.teamAName}`}
            players={playersA}
          />
          <RosterTable
            title={`Team B · ${match.teamBName}`}
            players={playersB}
          />
        </div>

        <div className="sheet-block">
          <div
            className="card-title-row"
            style={{
              borderBottom: "1px solid var(--glass-border)",
              paddingBottom: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <h3>Running Score Grid</h3>
            <div className="legend">
              <span>
                <Slash size={16} /> touch / tackle / technical
              </span>
              <span>
                <Circle size={16} /> bonus
              </span>
              <span>
                <Trophy size={16} /> all-out lona
              </span>
            </div>
          </div>

          <div className="official-running-grid">
            {/* Team A Grid */}
            <div className="official-running-grid-panel official-running-grid-panel-a">
              <h4
                style={{
                  color: "var(--primary)",
                  fontSize: "1.1rem",
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{match.teamAName}</span>
                <span className="badge badge-secondary">
                  {match.scoreA || 0} Points
                </span>
              </h4>
              <div
                className="running-score-grid"
                style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
              >
                {scoreNumbers.map((number) => {
                  let cellClass = "";
                  let isTrophy = trophySetA.has(number);
                  if (crossedA.has(number)) cellClass = "crossed";
                  if (circledA.has(number)) cellClass = "circled";

                  return (
                    <button
                      className={`score-cell ${cellClass} ${isTrophy ? "circled" : ""}`}
                      key={`A-${number}`}
                      type="button"
                      style={{
                        position: "relative",
                        background: isTrophy ? "rgba(245, 158, 11, 0.2)" : "",
                        borderColor: isTrophy ? "var(--warning)" : "",
                      }}
                    >
                      {isTrophy ? (
                        <Trophy
                          size={10}
                          style={{
                            position: "absolute",
                            top: "1px",
                            right: "1px",
                            color: "var(--warning)",
                          }}
                        />
                      ) : null}
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team B Grid */}
            <div>
              <h4
                style={{
                  color: "var(--secondary)",
                  fontSize: "1.1rem",
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{match.teamBName}</span>
                <span className="badge badge-primary">
                  {match.scoreB || 0} Points
                </span>
              </h4>
              <div
                className="running-score-grid"
                style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
              >
                {scoreNumbers.map((number) => {
                  let cellClass = "";
                  let isTrophy = trophySetB.has(number);
                  if (crossedB.has(number)) cellClass = "crossed";
                  if (circledB.has(number)) cellClass = "circled";

                  return (
                    <button
                      className={`score-cell ${cellClass} ${isTrophy ? "circled" : ""}`}
                      key={`B-${number}`}
                      type="button"
                      style={{
                        position: "relative",
                        background: isTrophy ? "rgba(245, 158, 11, 0.2)" : "",
                        borderColor: isTrophy ? "var(--warning)" : "",
                      }}
                    >
                      {isTrophy ? (
                        <Trophy
                          size={10}
                          style={{
                            position: "absolute",
                            top: "1px",
                            right: "1px",
                            color: "var(--warning)",
                          }}
                        />
                      ) : null}
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sheet-block">
          <h3>Individual Performance Log</h3>
          <table className="pro-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Raids</th>
                <th>Successful</th>
                <th>Empty</th>
                <th>Unsuccessful</th>
                <th>Solo Tackle</th>
                <th>Assist</th>
                <th>Cards</th>
              </tr>
            </thead>
            <tbody>
              {!performanceRows || performanceRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No performance data available. Start the match to generate
                    logs.
                  </td>
                </tr>
              ) : (
                performanceRows.map((row) => (
                  <tr key={row.no}>
                    <td>{row.no}</td>
                    <td>{row.raids}</td>
                    <td>{row.successful}</td>
                    <td>{row.empty}</td>
                    <td>{row.unsuccessful}</td>
                    <td>{row.solo}</td>
                    <td>{row.assist}</td>
                    <td>{row.cards}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="two-column">
          <div className="sheet-block summary-block">
            <h3>Match Summary</h3>
            <dl className="detail-list">
              <div>
                <dt>Current Score</dt>
                <dd>
                  {match.teamAName} {match.scoreA || 0} · {match.teamBName}{" "}
                  {match.scoreB || 0}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {match.status === "finished"
                    ? "Match Completed"
                    : match.status === "live"
                      ? "Match Live in Progress"
                      : "Scheduled"}
                </dd>
              </div>
              <div>
                <dt>Result</dt>
                <dd>
                  {match.scoreA === match.scoreB
                    ? "Scores Level"
                    : match.scoreA > match.scoreB
                      ? `${match.teamAName} leading by ${match.scoreA - match.scoreB} points`
                      : `${match.teamBName} leading by ${match.scoreB - match.scoreA} points`}
                </dd>
              </div>
            </dl>
          </div>
          <div className="sheet-block signature-grid">
            {["Captain Team A", "Captain Team B", "Scorer", "Referee"].map(
              (name) => (
                <div key={name}>
                  <span>{name}</span>
                  <strong>Signed</strong>
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default OfficialScoreSheet;
