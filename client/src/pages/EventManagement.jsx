import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CalendarRange, CheckCircle2, Crown, PlusCircle } from "lucide-react";
import {
  EVENT_CHANGE_EVENT,
  getActiveEventId,
  setActiveEventId,
} from "../utils/eventSelection";
import { API_URL } from "../utils/apiBase";

const EventManagement = () => {
  const [events, setEvents] = useState([]);
  const [states, setStates] = useState([]);
  const [districtsByState, setDistrictsByState] = useState({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    state: "",
    district: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  const districtsForState = useMemo(
    () => districtsByState[formData.state] || [],
    [districtsByState, formData.state],
  );

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/matches/events`);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Unable to fetch events", err);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const [eventsRes, optionsRes] = await Promise.all([
          axios.get(`${API_URL}/api/matches/events`),
          axios.get(`${API_URL}/api/matches/location/options`),
        ]);

        const allEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const options = optionsRes.data || {};

        setEvents(allEvents);
        setStates(Array.isArray(options.states) ? options.states : []);
        setDistrictsByState(options.districtsByState || {});

        const localEvent = getActiveEventId();
        if (!localEvent && allEvents.length > 0) {
          const active =
            allEvents.find((event) => event.isActive) || allEvents[0];
          setActiveEventId(active.id);
        }
      } catch (err) {
        console.error("Unable to load event management", err);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();

    const onEventChange = () => fetchEvents();
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.state || !formData.district) {
      alert("Please enter event name, state, and district.");
      return;
    }

    setCreating(true);
    try {
      const request = editingId
        ? axios.patch(`${API_URL}/api/matches/events/${editingId}`, formData)
        : axios.post(`${API_URL}/api/matches/events`, formData);
      const res = await request;
      const created = res.data;
      await fetchEvents();
      if (created?.id && (created.isActive || events.length === 0)) {
        setActiveEventId(created.id);
      }
      setFormData({
        name: "",
        state: "",
        district: "",
        startDate: "",
        endDate: "",
        isActive: true,
      });
      setEditingId("");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (eventId) => {
    try {
      await axios.patch(`${API_URL}/api/matches/events/${eventId}/activate`);
      setActiveEventId(eventId);
      await fetchEvents();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to activate event");
    }
  };

  const handleEditEvent = (event) => {
    setEditingId(event.id);
    setFormData({
      name: event.name || "",
      state: event.state || "",
      district: event.district || "",
      startDate: event.startDate || "",
      endDate: event.endDate || "",
      isActive: Boolean(event.isActive),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteEvent = async (eventId) => {
    if (
      !window.confirm(
        "Delete this event and all related teams, players, and matches?",
      )
    )
      return;
    try {
      await axios.delete(`${API_URL}/api/matches/events/${eventId}`);
      if (getActiveEventId() === eventId) {
        setActiveEventId("");
      }
      await fetchEvents();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete event");
    }
  };

  return (
    <div className="page-shell animate-fade-in">
      <header className="page-header">
        <div>
          <span className="eyebrow">Super admin controls</span>
          <h1>Event Management</h1>
          <p>
            Create multiple tournaments and run registrations separately for
            each event in the Kabaddi managemant system by INDOCREONIX.
          </p>
        </div>
      </header>

      <section
        className="glass-panel"
        style={{ padding: "1.5rem", marginBottom: "1rem" }}
      >
        <h2 style={{ fontSize: "1.35rem", marginBottom: "1rem" }}>
          <PlusCircle size={18} style={{ marginRight: "0.5rem" }} />
          {editingId ? "Edit Event" : "Create New Event"}
        </h2>
        <form
          onSubmit={handleCreateEvent}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <input
            className="form-control"
            placeholder="Event name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <select
            className="form-control"
            value={formData.state}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value, district: "" })
            }
            required
          >
            <option value="">Select State</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={formData.district}
            onChange={(e) =>
              setFormData({ ...formData, district: e.target.value })
            }
            required
            disabled={!formData.state}
          >
            <option value="">Select District</option>
            {districtsForState.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
          <input
            className="form-control"
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
          />
          <input
            className="form-control"
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
          />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating
              ? editingId
                ? "Saving..."
                : "Creating..."
              : editingId
                ? "Save Event"
                : "Create Event"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditingId("");
                setFormData({
                  name: "",
                  state: "",
                  district: "",
                  startDate: "",
                  endDate: "",
                  isActive: true,
                });
              }}
            >
              Cancel Edit
            </button>
          )}
        </form>
      </section>

      <section className="management-grid">
        {loading ? (
          <div className="sheet-block">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="sheet-block">
            No events created yet. Create your first event.
          </div>
        ) : (
          events.map((event) => (
            <article className="pro-card" key={event.id}>
              <div className="card-title-row">
                <div>
                  <span className="eyebrow">Tournament Event</span>
                  <h2>{event.name}</h2>
                </div>
                {event.isActive ? (
                  <span className="badge badge-accent">
                    <CheckCircle2 size={16} /> Active
                  </span>
                ) : (
                  <span className="badge badge-secondary">Inactive</span>
                )}
              </div>
              <dl className="detail-list">
                <div>
                  <dt>State</dt>
                  <dd>{event.state || "Not set"}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{event.district || "Not set"}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>
                    <CalendarRange
                      size={14}
                      style={{ marginRight: "0.4rem" }}
                    />
                    {event.startDate || "TBD"} - {event.endDate || "TBD"}
                  </dd>
                </div>
              </dl>
              <button
                className="btn btn-secondary compact"
                type="button"
                onClick={() => handleActivate(event.id)}
                disabled={event.isActive}
              >
                <Crown size={16} />{" "}
                {event.isActive ? "Current Event" : "Set Active"}
              </button>
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginTop: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-secondary compact"
                  type="button"
                  onClick={() => handleEditEvent(event)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger compact"
                  type="button"
                  onClick={() => handleDeleteEvent(event.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default EventManagement;
