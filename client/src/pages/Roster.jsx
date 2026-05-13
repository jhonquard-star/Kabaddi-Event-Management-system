import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Search,
  Filter,
  MapPin,
  Activity,
  Shield,
  Trash2,
  Plus,
  Camera,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  EVENT_CHANGE_EVENT,
  getActiveEventId,
  setActiveEventId,
} from "../utils/eventSelection";
import {
  buildPlayerPayload,
  validatePlayerIdentity,
} from "../utils/playerValidation";
import { API_URL } from "../utils/apiBase";

const Roster = () => {
  const [eventId, setEventId] = useState(getActiveEventId());
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [states, setStates] = useState([]);
  const [districtsByState, setDistrictsByState] = useState({});
  const [allDistricts, setAllDistricts] = useState([]);
  const [geoNotice, setGeoNotice] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState("");
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    email: "",
    phone: "",
    age: "",
    weight: "",
    position: "Raider",
    teamId: "",
    dob: "",
    aadhar: "",
    photoUrl: "",
    photoPublicId: "",
  });
  const [newTeam, setNewTeam] = useState({
    name: "",
    state: "",
    district: "",
    coach: "",
  });
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("All");
  const [positionFilter, setPositionFilter] = useState("All");
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const districtOptions = useMemo(() => {
    if (newTeam.state && Array.isArray(districtsByState[newTeam.state])) {
      return districtsByState[newTeam.state];
    }
    return allDistricts;
  }, [newTeam.state, districtsByState, allDistricts]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [eventsRes, locationRes, detectRes] = await Promise.all([
          axios.get(`${API_URL}/api/matches/events`),
          axios.get(`${API_URL}/api/matches/location/options`),
          axios.get(`${API_URL}/api/matches/location/detect`),
        ]);

        const eventsData = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const locationData = locationRes.data || {};
        const detectData = detectRes.data || {};

        setEvents(eventsData);
        setStates(
          Array.isArray(locationData.states) ? locationData.states : [],
        );
        setDistrictsByState(locationData.districtsByState || {});
        setAllDistricts(
          Array.isArray(locationData.allDistricts)
            ? locationData.allDistricts
            : [],
        );

        if (detectData.state || detectData.district) {
          setGeoNotice(
            "State and district were auto-detected from your IP. You can change them.",
          );
        }

        const fromStorage = getActiveEventId();
        const selectedEvent =
          eventsData.find((entry) => entry.id === fromStorage) ||
          eventsData.find((entry) => entry.isActive) ||
          eventsData[0];

        if (selectedEvent?.id) {
          setActiveEventId(selectedEvent.id);
          setEventId(selectedEvent.id);
        }
      } catch (err) {
        console.error("Failed to fetch roster metadata", err);
      }
    };

    fetchMeta();
  }, []);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    const fetchData = async () => {
      try {
        const [teamsRes, playersRes, allPlayersRes] = await Promise.all([
          axios.get(`${API_URL}/api/matches/teams`, { params: { eventId } }),
          axios.get(`${API_URL}/api/matches/players`, { params: { eventId } }),
          axios.get(`${API_URL}/api/matches/players`),
        ]);

        setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : []);
        setPlayers(Array.isArray(playersRes.data) ? playersRes.data : []);
        setAllPlayers(
          Array.isArray(allPlayersRes.data) ? allPlayersRes.data : [],
        );
      } catch (err) {
        console.error("Failed to fetch roster data", err);
      }
    };

    fetchData();

    const onEventChange = (evt) =>
      setEventId(evt.detail?.eventId || getActiveEventId());
    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, [eventId]);

  const uniqueDistricts = [
    "All",
    ...new Set(teams.map((team) => team.district)),
  ];

  const filteredPlayers = players.filter((player) => {
    const team = teams.find((entry) => entry.id === player.teamId);
    if (!team) return false;

    const matchSearch =
      player.name.toLowerCase().includes(search.toLowerCase()) ||
      team.name.toLowerCase().includes(search.toLowerCase());
    const matchDistrict =
      districtFilter === "All" || team.district === districtFilter;
    const matchPosition =
      positionFilter === "All" || player.position === positionFilter;

    return matchSearch && matchDistrict && matchPosition;
  });

  const resetPlayerForm = () => {
    setEditingPlayerId("");
    setPhotoPreview(null);
    setNewPlayer({
      name: "",
      email: "",
      phone: "",
      age: "",
      weight: "",
      position: "Raider",
      teamId: "",
      dob: "",
      aadhar: "",
      photoUrl: "",
    });
  };

  const handleDeletePlayer = async (playerId) => {
    try {
      await axios.delete(`${API_URL}/api/matches/players/${playerId}`);
      setPlayers((prev) => prev.filter((player) => player.id !== playerId));
      setAllPlayers((prev) => prev.filter((player) => player.id !== playerId));
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete player");
    }
  };

  const handleEditPlayer = (player) => {
    setEditingPlayerId(player.id);
    setPhotoPreview(player.photoUrl || null);
    setNewPlayer({
      name: player.name || "",
      email: player.email || "",
      phone: player.phone || "",
      age: player.age || "",
      weight: player.weight || "",
      position: player.position || "Raider",
      teamId: player.teamId || "",
      dob: player.dob || "",
      aadhar: player.aadhar || "",
      photoUrl: player.photoUrl || "",
    });
    setShowAddForm(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    const uploadData = new FormData();
    uploadData.append("photo", file);

    try {
      const res = await axios.post(`${API_URL}/api/matches/upload`, uploadData);
      setNewPlayer((current) => ({
        ...current,
        photoUrl: res.data.url,
        photoPublicId: res.data.publicId || "",
      }));
    } catch {
      setNewPlayer((current) => ({
        ...current,
        photoUrl: URL.createObjectURL(file),
        photoPublicId: "",
      }));
    }
  };

  const startLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch {
      alert("Camera access is required to take a live photo.");
    }
  };

  const stopLiveCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureLivePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPhotoPreview(dataUrl);
    setNewPlayer((current) => ({ ...current, photoUrl: dataUrl }));
    stopLiveCamera();
  };

  const handleSavePlayer = async (e) => {
    e.preventDefault();

    const validation = validatePlayerIdentity({
      player: { ...newPlayer, eventId },
      existingPlayers: allPlayers,
      editingPlayerId,
    });

    if (!validation.ok) {
      return alert(validation.message);
    }

    try {
      const playerPayload = buildPlayerPayload({ ...newPlayer, eventId });
      const res = editingPlayerId
        ? await axios.patch(
            `${API_URL}/api/matches/players/${editingPlayerId}`,
            playerPayload,
          )
        : await axios.post(`${API_URL}/api/matches/players`, playerPayload);

      if (editingPlayerId) {
        setPlayers((prev) =>
          prev.map((player) =>
            player.id === editingPlayerId
              ? { ...player, ...newPlayer, id: editingPlayerId }
              : player,
          ),
        );
        setAllPlayers((prev) =>
          prev.map((player) =>
            player.id === editingPlayerId
              ? { ...player, ...newPlayer, id: editingPlayerId, eventId }
              : player,
          ),
        );
      } else {
        setPlayers((prev) => [...prev, res.data]);
        setAllPlayers((prev) => [...prev, res.data]);
      }

      setShowAddForm(false);
      setEditingPlayerId("");
      setPhotoPreview(null);
      stopLiveCamera();
      resetPlayerForm();
    } catch (err) {
      console.error("Save player failed", err);
      alert(err.response?.data?.error || "Failed to save player");
    }
  };

  const handleEditTeam = (team) => {
    setEditingTeamId(team.id);
    setNewTeam({
      name: team.name || "",
      state: team.state || "",
      district: team.district || "",
      coach: team.coach || "",
    });
    setShowTeamForm(true);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Delete this team and all linked players?")) return;
    try {
      await axios.delete(`${API_URL}/api/matches/teams/${teamId}`);
      setTeams((prev) => prev.filter((team) => team.id !== teamId));
      setPlayers((prev) => prev.filter((player) => player.teamId !== teamId));
      setAllPlayers((prev) =>
        prev.filter((player) => player.teamId !== teamId),
      );
    } catch (err) {
      console.error("Delete team failed", err);
      alert(err.response?.data?.error || "Failed to delete team");
    }
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    try {
      const res = editingTeamId
        ? await axios.patch(`${API_URL}/api/matches/teams/${editingTeamId}`, {
            ...newTeam,
            eventId,
          })
        : await axios.post(`${API_URL}/api/matches/teams`, {
            ...newTeam,
            eventId,
          });

      if (editingTeamId) {
        setTeams((prev) =>
          prev.map((team) =>
            team.id === editingTeamId
              ? { ...team, ...newTeam, id: editingTeamId }
              : team,
          ),
        );
      } else {
        setTeams((prev) => [...prev, res.data]);
      }

      setShowTeamForm(false);
      setEditingTeamId("");
      setNewTeam({ name: "", state: "", district: "", coach: "" });
    } catch (err) {
      console.error("Save team failed", err);
      alert(err.response?.data?.error || "Failed to save team");
    }
  };

  if (!eventId) {
    return (
      <div className="glass-panel" style={{ padding: "2rem" }}>
        Please select an active event from the sidebar to manage roster data.
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: "2rem" }}>
        <h1 className="title-glow">
          Official <span className="text-gradient-blue">Roster</span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          Complete database of all registered professional teams and players.
        </p>
      </header>

      <div
        className="glass-panel"
        style={{ padding: "2rem", marginBottom: "2rem" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <h2 className="title-glow" style={{ fontSize: "1.6rem" }}>
            Team Management
          </h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowTeamForm((current) => !current)}
          >
            <Plus size={16} /> {showTeamForm ? "Hide Team Form" : "Add Team"}
          </button>
        </div>

        {showTeamForm && (
          <form
            onSubmit={handleSaveTeam}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {geoNotice && (
              <div className="sheet-block" style={{ gridColumn: "1 / -1" }}>
                <span className="muted">{geoNotice}</span>
              </div>
            )}
            <input
              className="form-control"
              placeholder="Team Name"
              required
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            />
            <div className="form-group">
              <label className="form-label">Event</label>
              <select
                className="form-control"
                required
                value={eventId}
                onChange={(e) => {
                  setActiveEventId(e.target.value);
                  setEventId(e.target.value);
                }}
              >
                <option value="">-- Select Event --</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <select
                className="form-control"
                required
                value={newTeam.state}
                onChange={(e) =>
                  setNewTeam({
                    ...newTeam,
                    state: e.target.value,
                    district: "",
                  })
                }
              >
                <option value="">-- Select State --</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">District Selection</label>
              {districtOptions.length > 0 ? (
                <select
                  className="form-control"
                  required
                  value={newTeam.district}
                  onChange={(e) =>
                    setNewTeam({ ...newTeam, district: e.target.value })
                  }
                >
                  <option value="">-- Select District --</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-control"
                  disabled
                  placeholder="District options are loading"
                />
              )}
            </div>
            <input
              className="form-control"
              placeholder="Coach"
              required
              value={newTeam.coach}
              onChange={(e) =>
                setNewTeam({ ...newTeam, coach: e.target.value })
              }
            />
            <button type="submit" className="btn btn-primary">
              {editingTeamId ? "Save Team" : "Create Team"}
            </button>
            {editingTeamId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingTeamId("");
                  setNewTeam({ name: "", state: "", district: "", coach: "" });
                }}
              >
                Cancel Edit
              </button>
            )}
          </form>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {teams.map((team) => (
            <div key={team.id} className="sheet-block">
              <h3 style={{ marginBottom: "0.5rem" }}>{team.name}</h3>
              <p className="muted" style={{ marginBottom: "0.25rem" }}>
                {team.state} / {team.district}
              </p>
              <p className="muted" style={{ marginBottom: "1rem" }}>
                Coach: {team.coach}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-secondary compact"
                  type="button"
                  onClick={() => handleEditTeam(team)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger compact"
                  type="button"
                  onClick={() => handleDeleteTeam(team.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="glass-panel"
        style={{
          padding: "1rem",
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={() => {
            resetPlayerForm();
            setShowAddForm(true);
          }}
        >
          <Plus size={16} /> Add Player
        </button>
        <div
          className="flex items-center gap-4"
          style={{
            display: "flex",
            gap: "1.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ flex: "1 1 300px", position: "relative" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                left: "1rem",
                color: "var(--text-muted)",
              }}
            />
            <input
              className="form-control"
              style={{ paddingLeft: "3rem" }}
              placeholder="Search players or teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "1rem", flex: "1 1 auto" }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(0,0,0,0.3)",
                padding: "0.5rem 1rem",
                borderRadius: "12px",
                border: "1px solid var(--glass-border)",
              }}
            >
              <MapPin size={18} color="var(--primary)" />
              <select
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  width: "100%",
                  outline: "none",
                }}
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
              >
                {uniqueDistricts.map((district) => (
                  <option
                    key={district}
                    value={district}
                    style={{ color: "black" }}
                  >
                    {district === "All" ? "All Districts" : district}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(0,0,0,0.3)",
                padding: "0.5rem 1rem",
                borderRadius: "12px",
                border: "1px solid var(--glass-border)",
              }}
            >
              <Filter size={18} color="var(--secondary)" />
              <select
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  width: "100%",
                  outline: "none",
                }}
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <option value="All" style={{ color: "black" }}>
                  All Positions
                </option>
                <option value="Raider" style={{ color: "black" }}>
                  Raider
                </option>
                <option value="Left Corner" style={{ color: "black" }}>
                  Left Corner
                </option>
                <option value="Right Corner" style={{ color: "black" }}>
                  Right Corner
                </option>
                <option value="Left Cover" style={{ color: "black" }}>
                  Left Cover
                </option>
                <option value="Right Cover" style={{ color: "black" }}>
                  Right Cover
                </option>
                <option value="All-rounder" style={{ color: "black" }}>
                  All-rounder
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div
          className="glass-panel"
          style={{ padding: "2rem", marginBottom: "2rem" }}
        >
          <h2 className="title-glow" style={{ marginBottom: "1rem" }}>
            {editingPlayerId ? "Edit Player" : "Add New Player"}
          </h2>
          <form
            onSubmit={handleSavePlayer}
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "320px 1fr",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "100%",
                  height: "350px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "20px",
                  border: "2px dashed var(--glass-border)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  marginBottom: "1rem",
                  position: "relative",
                }}
              >
                {cameraOpen ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : photoPreview || newPlayer.photoUrl ? (
                  <img
                    src={photoPreview || newPlayer.photoUrl}
                    alt="Player"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <>
                    <Camera
                      size={64}
                      color="var(--text-muted)"
                      style={{ marginBottom: "1rem" }}
                    />
                    <span style={{ color: "var(--text-muted)" }}>
                      Take a live photo or upload one
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={cameraOpen ? captureLivePhoto : startLiveCamera}
                >
                  <Camera size={18} />{" "}
                  {cameraOpen ? "Capture Live Photo" : "Take Live Photo"}
                </button>
                {cameraOpen && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={stopLiveCamera}
                  >
                    Cancel Camera
                  </button>
                )}
                <label className="btn btn-secondary" style={{ width: "100%" }}>
                  <Upload size={20} /> Upload From Device
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.25rem",
              }}
            >
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Player Name</label>
                <input
                  className="form-control"
                  placeholder="Player Name"
                  required
                  value={newPlayer.name}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Email"
                  required
                  value={newPlayer.email}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, email: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="Phone Number"
                  required
                  maxLength="10"
                  value={newPlayer.phone}
                  onChange={(e) =>
                    setNewPlayer({
                      ...newPlayer,
                      phone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Age"
                  required
                  value={newPlayer.age}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, age: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Weight (kg)"
                  required
                  value={newPlayer.weight}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, weight: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  className="form-control"
                  type="date"
                  required
                  value={newPlayer.dob}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, dob: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Aadhar Number</label>
                <input
                  className="form-control"
                  placeholder="Aadhar Number"
                  inputMode="numeric"
                  maxLength="12"
                  required
                  value={newPlayer.aadhar}
                  onChange={(e) =>
                    setNewPlayer({
                      ...newPlayer,
                      aadhar: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Primary Position</label>
                <select
                  className="form-control"
                  value={newPlayer.position}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, position: e.target.value })
                  }
                >
                  <option value="Raider">Raider</option>
                  <option value="Left Corner">Left Corner</option>
                  <option value="Right Corner">Right Corner</option>
                  <option value="Left Cover">Left Cover</option>
                  <option value="Right Cover">Right Cover</option>
                  <option value="All-rounder">All-rounder</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Team</label>
                <select
                  className="form-control"
                  required
                  value={newPlayer.teamId}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, teamId: e.target.value })
                  }
                >
                  <option value="">Select Team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.state} / {team.district})
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <button type="submit" className="btn btn-primary">
                  {editingPlayerId ? "Save Player" : "Create Player"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingPlayerId("");
                    setPhotoPreview(null);
                    stopLiveCamera();
                    resetPlayerForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "2rem",
        }}
      >
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((player, index) => {
            const team = teams.find((entry) => entry.id === player.teamId);
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="glass-panel"
                style={{
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "220px",
                    position: "relative",
                    background: "rgba(0,0,0,0.5)",
                  }}
                >
                  {player.photoUrl ? (
                    <img
                      src={player.photoUrl}
                      alt={player.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: 0.8,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Activity size={48} color="var(--text-muted)" />
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(0deg, rgba(5,5,10,1) 0%, transparent 100%)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "1rem",
                      right: "1rem",
                      display: "flex",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      className={`badge ${player.position === "Raider" ? "badge-primary" : "badge-secondary"}`}
                      style={{ backdropFilter: "blur(10px)" }}
                    >
                      {player.position}
                    </span>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeletePlayer(player.id)}
                      title="Delete Player"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => handleEditPlayer(player)}
                      title="Edit Player"
                    >
                      Edit
                    </button>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "1rem",
                      left: "1.5rem",
                      right: "1.5rem",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                      }}
                    >
                      {player.name}
                    </h3>
                  </div>
                </div>

                <div
                  style={{
                    padding: "1.5rem",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "1.5rem",
                      padding: "1rem",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "12px",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Age
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                        {player.age}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "1px",
                        background: "var(--glass-border)",
                      }}
                    />
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Weight
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                        {player.weight} kg
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      paddingTop: "1rem",
                      borderTop: "1px dashed var(--glass-border)",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, var(--primary), var(--secondary))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Shield size={20} color="white" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Playing For
                      </div>
                      <div style={{ fontWeight: 700, color: "white" }}>
                        {team?.name || "Team not found"}
                      </div>
                      <div
                        style={{ fontSize: "0.8rem", color: "var(--accent)" }}
                      >
                        {team?.district || "District unavailable"}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "4rem",
              textAlign: "center",
              background: "rgba(0,0,0,0.3)",
              borderRadius: "20px",
              border: "1px dashed var(--glass-border)",
            }}
          >
            <Activity
              size={48}
              color="var(--text-muted)"
              style={{ margin: "0 auto 1rem", opacity: 0.5 }}
            />
            <h3
              style={{
                fontSize: "1.5rem",
                color: "white",
                marginBottom: "0.5rem",
              }}
            >
              No Players Found
            </h3>
            <p style={{ color: "var(--text-muted)" }}>
              Adjust your filters or register new players.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Roster;
