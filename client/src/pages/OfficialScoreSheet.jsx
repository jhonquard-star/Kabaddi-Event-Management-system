import {
  CheckCircle2,
  Circle,
  FileSignature,
  Slash,
  Trophy,
} from "lucide-react";
import { EVENT_DISPLAY_TITLE, EVENT_DATES, EVENT_VENUE } from "../data/eventInfo";
import {
  performanceRows,
  samplePlayersA,
  samplePlayersB,
  scoreSheetSections,
} from "../data/kabaddiProData";

const scoreNumbers = Array.from({ length: 60 }, (_, index) => index + 1);
const crossed = new Set([
  1, 2, 3, 5, 6, 8, 10, 11, 14, 17, 19, 22, 24, 26, 27, 30, 33,
]);
const circled = new Set([4, 9, 16, 23, 29]);

const RosterTable = ({ title, players }) => (
  <div className="sheet-block">
    <h3>{title}</h3>
    {!players || players.length === 0 ? (
      <div className="muted">
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
          {players.map((player) => (
            <tr key={`${title}-${player.no}`}>
              <td>{player.no}</td>
              <td>{player.name}</td>
              <td>{player.role}</td>
              <td>{player.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const OfficialScoreSheet = () => {
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
        <button className="btn btn-primary">
          <FileSignature size={18} /> Validate Sheet
        </button>
      </header>

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
            <span className="eyebrow">Match No.</span>
            <strong>Pool A · Match 12</strong>
          </div>
          <div>
            <span className="eyebrow">Venue / Date</span>
            <strong>{EVENT_VENUE} · {EVENT_DATES}</strong>
          </div>
          <div>
            <span className="eyebrow">Toss</span>
            <strong>Ranchi Rhinos chose raid</strong>
          </div>
        </div>

        <div className="two-column">
          <RosterTable
            title="Team A · Ranchi Rhinos"
            players={samplePlayersA}
          />
          <RosterTable
            title="Team B · Dhanbad Dynamos"
            players={samplePlayersB}
          />
        </div>

        <div className="sheet-block">
          <div className="card-title-row">
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
          <div className="running-score-grid">
            {scoreNumbers.map((number) => (
              <button
                className={`score-cell ${crossed.has(number) ? "crossed" : ""} ${circled.has(number) ? "circled" : ""}`}
                key={number}
                type="button"
              >
                {number}
              </button>
            ))}
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
                <dt>Half-time</dt>
                <dd>Ranchi Rhinos 17 · Dhanbad Dynamos 14</dd>
              </div>
              <div>
                <dt>Final</dt>
                <dd>Ranchi Rhinos 34 · Dhanbad Dynamos 31</dd>
              </div>
              <div>
                <dt>Result</dt>
                <dd>Ranchi Rhinos won by 3 points</dd>
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
