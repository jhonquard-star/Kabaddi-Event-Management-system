import { useState, useEffect } from "react";
import axios from "axios";
import { Users, Swords, Map, Activity, Shield, Award } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CHANGE_EVENT, getActiveEventId } from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";

const Dashboard = () => {
  const [stats, setStats] = useState({
    events: 0,
    teams: 0,
    players: 0,
    matches: 0,
    districts: 0,
  });
  const [topDistricts, setTopDistricts] = useState([]);
  const [eventId, setEventId] = useState(getActiveEventId());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = eventId ? { eventId } : {};
        const [statsRes, teamsRes] = await Promise.all([
          axios.get(`${API_URL}/api/matches/stats`, { params }),
          axios.get(`${API_URL}/api/matches/teams`, { params }),
        ]);

        setStats(
          statsRes.data || {
            events: 0,
            teams: 0,
            players: 0,
            matches: 0,
            districts: 0,
          },
        );

        const districtMap = {};
        (teamsRes.data || []).forEach((team) => {
          const district = team.district || "Unknown";
          districtMap[district] = (districtMap[district] || 0) + 1;
        });

        const ranked = Object.entries(districtMap)
          .map(([district, teams]) => ({ district, teams }))
          .sort((a, b) => b.teams - a.teams)
          .slice(0, 5);

        setTopDistricts(ranked);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };
    fetchStats();

    const onEventChange = (evt) =>
      setEventId(evt.detail?.eventId || getActiveEventId());
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, [eventId]);

  const statCards = [
    {
      label: "Total Events",
      value: stats.events,
      icon: Activity,
      color: "#22c55e",
    },
    {
      label: "Total Teams Registered",
      value: stats.teams,
      icon: Shield,
      color: "var(--primary)",
    },
    {
      label: "Professional Players",
      value: stats.players,
      icon: Users,
      color: "var(--secondary)",
    },
    {
      label: "Matches Scheduled",
      value: stats.matches,
      icon: Swords,
      color: "var(--accent)",
    },
    {
      label: "Active Districts",
      value: stats.districts,
      icon: Map,
      color: "#a855f7",
    },
  ];

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: "3rem" }}>
        <h1 className="title-glow">
          Analytics <span className="text-gradient">Hub</span>
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
          Kabaddi managemant system by INDOCREONIX.
        </p>
      </header>

      <div className="data-grid" style={{ marginBottom: "3rem" }}>
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel"
            style={{
              padding: "2rem",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${stat.color}40, transparent)`,
                padding: "1.25rem",
                borderRadius: "16px",
                border: `1px solid ${stat.color}60`,
              }}
            >
              <stat.icon
                size={32}
                color={stat.color}
                style={{ filter: `drop-shadow(0 0 10px ${stat.color})` }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {stat.value}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem" }}
      >
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Activity color="var(--primary)" /> Tournament Activity
            </h3>
            <span className="badge badge-primary">
              {eventId ? "EVENT MODE" : "ALL EVENTS"}
            </span>
          </div>
          <div
            style={{
              padding: "1.25rem",
              border: "1px dashed var(--glass-border)",
              borderRadius: "12px",
            }}
          >
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              This section uses live counts from your active event. Create teams
              and players to see analytics update instantly.
            </p>
            <p>
              Teams: <strong>{stats.teams}</strong> | Players:{" "}
              <strong>{stats.players}</strong> | Matches:{" "}
              <strong>{stats.matches}</strong>
            </p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h3
            style={{
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "2rem",
            }}
          >
            <Award color="var(--accent)" /> Top Districts
          </h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {topDistricts.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>
                No district data yet for the selected event.
              </div>
            ) : (
              topDistricts.map((item) => (
                <div
                  key={item.district}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "12px",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{item.district}</span>
                  <span className="badge badge-secondary">
                    {item.teams} Teams
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
