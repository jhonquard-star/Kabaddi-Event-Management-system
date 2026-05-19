import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import axios from "axios";
import {
  LayoutDashboard,
  Users,
  Trophy,
  MonitorPlay,
  Shield,
  Flag,
  Database,
  ClipboardList,
  FileSignature,
  CalendarRange,
  ListChecks,
  X,
} from "lucide-react";
import {
  EVENT_CHANGE_EVENT,
  getActiveEventId,
  setActiveEventId,
} from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";

const Sidebar = ({ isMobileOpen = false, onClose = () => {} }) => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEvent] = useState(getActiveEventId());

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/events`);
        const fetchedEvents = Array.isArray(res.data) ? res.data : [];
        setEvents(fetchedEvents);

        const localSelection = getActiveEventId();
        if (!localSelection && fetchedEvents.length > 0) {
          const preferred =
            fetchedEvents.find((event) => event.isActive) || fetchedEvents[0];
          setActiveEventId(preferred.id);
          setSelectedEvent(preferred.id);
          return;
        }

        setSelectedEvent(localSelection);
      } catch (err) {
        console.error("Unable to load events in sidebar", err);
      }
    };

    fetchEvents();

    const onEventChange = (evt) => {
      setSelectedEvent(evt.detail?.eventId || getActiveEventId());
    };
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, []);

  const adminLinks = [
    { to: "/events", icon: CalendarRange, label: "Event Management" },
    { to: "/dashboard", icon: LayoutDashboard, label: "Analytics Hub" },
    { to: "/", icon: Users, label: "User Registration" },
    { to: "/roster", icon: Database, label: "Teams & Roster" },
    { to: "/registration", icon: Users, label: "Registration Portal" },
    { to: "/matches", icon: Trophy, label: "Pool Match Fixings" },
    { to: "/officials", icon: ClipboardList, label: "Officials Center" },
    { to: "/scoresheet", icon: FileSignature, label: "Official Score Sheet" },
    { to: "/scoreboard", icon: MonitorPlay, label: "Live Scoreboard" },
    { to: "/completed-games", icon: ListChecks, label: "Completed Games" },
  ];

  const refereeLinks = [
    { to: "/official/chief-referee", icon: Flag, label: "Chief Referee" },
    { to: "/official/umpire-1", icon: Shield, label: "Court Umpire 1" },
    { to: "/official/umpire-2", icon: Shield, label: "Court Umpire 2" },
    { to: "/official/chief-scorer", icon: MonitorPlay, label: "Chief Scorer" },
    { to: "/official/asst-scorer-1", icon: Users, label: "Asst. Scorer 1" },
    { to: "/official/asst-scorer-2", icon: Users, label: "Asst. Scorer 2" },
  ];

  return (
    <aside className={`sidebar ${isMobileOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-mobile-header">
        <div>
          <div className="sidebar-mobile-kicker">Navigation</div>
          <div className="sidebar-mobile-title">Kabaddi Menu</div>
        </div>
        <button
          type="button"
          className="sidebar-close-button"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label className="form-label" style={{ marginBottom: "0.35rem" }}>
          Active Event
        </label>
        <select
          className="form-control"
          value={selectedEventId}
          onChange={(e) => {
            setSelectedEvent(e.target.value);
            setActiveEventId(e.target.value);
          }}
          style={{ padding: "0.7rem 0.9rem", fontSize: "0.9rem" }}
        >
          <option value="">Select Event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginBottom: "3rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px var(--primary-glow)",
          }}
        >
          <Shield size={24} color="white" />
        </div>
        <div>
          <h2 style={{ fontSize: "1.25rem", letterSpacing: "0.05em" }}>
            KABADDI
          </h2>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--primary)",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            MANAGEMENT SYSTEM
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
            }}
          >
            BY INDOCREONIX
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: "var(--text-muted)",
              marginBottom: "1rem",
              letterSpacing: "0.1em",
              paddingLeft: "1rem",
            }}
          >
            ADMINISTRATION
          </div>
          <nav
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {adminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={onClose}
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: "var(--text-muted)",
              marginBottom: "1rem",
              letterSpacing: "0.1em",
              paddingLeft: "1rem",
            }}
          >
            OFFICIALS
          </div>
          <nav
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {refereeLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={onClose}
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div
        style={{
          marginTop: "auto",
          paddingTop: "2rem",
          borderTop: "1px solid var(--glass-border)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        &copy; 2026 Kabaddi Management System by INDOCREONIX
      </div>

      <style>{`
        .nav-link {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1rem;
          color: var(--text-muted);
          text-decoration: none;
          border-radius: 12px;
          transition:
            transform 0.18s ease,
            background-color 0.18s ease,
            color 0.18s ease,
            box-shadow 0.18s ease;
          font-weight: 500;
          border: 1px solid transparent;
        }
        .nav-link:hover {
          color: #1f2937;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.14), rgba(5, 150, 105, 0.1));
          box-shadow: 0 6px 18px rgba(79, 70, 229, 0.12);
          transform: translateX(4px) scale(1.02);
          border-color: rgba(79, 70, 229, 0.18);
        }
        .nav-link.active {
          color: #1f2937;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.18), rgba(5, 150, 105, 0.12));
          border-left: 3px solid var(--secondary);
          box-shadow: inset 0 0 0 1px rgba(79, 70, 229, 0.12);
        }
        .nav-link.active svg {
          color: var(--secondary);
        }
        .nav-link:hover svg {
          color: var(--secondary);
        }

        .sidebar-mobile-header {
          display: none;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--glass-border);
        }

        .sidebar-mobile-kicker {
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .sidebar-mobile-title {
          color: var(--primary);
          font-size: 1.05rem;
          font-weight: 800;
        }

        .sidebar-close-button {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.95);
          color: var(--primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .sidebar-close-button:hover {
          background: rgba(79, 70, 229, 0.08);
          color: var(--secondary);
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
