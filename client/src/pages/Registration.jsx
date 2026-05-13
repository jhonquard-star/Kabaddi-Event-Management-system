import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  UserPlus,
  Trophy,
  Camera,
  Upload,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  EVENT_CHANGE_EVENT,
  getActiveEventId,
  setActiveEventId,
} from "../utils/eventSelection";
import {
  buildPlayerPayload,
  validatePlayerIdentity,
  calculateAgeFromDob,
} from "../utils/playerValidation";
import { API_URL } from "../utils/apiBase";

const Registration = () => {
  const [tab, setTab] = useState("team");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [states, setStates] = useState([]);
  const [districtsByState, setDistrictsByState] = useState({});
  const [allDistricts, setAllDistricts] = useState([]);
  const [geoNotice, setGeoNotice] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aadharFrontPreview, setAadharFrontPreview] = useState(null);
  const [aadharBackPreview, setAadharBackPreview] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aadharCameraMode, setAadharCameraMode] = useState(null); // "front", "back", or null
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [formData, setFormData] = useState({
    eventId: "",
    teamName: "",
    state: "",
    district: "",
    coach: "",
    playerName: "",
    fatherName: "",
    email: "",
    phone: "",
    age: "",
    weight: "",
    position: "Raider",
    teamId: "",
    dob: "",
    aadhar: "",
    aadharFrontUrl: "",
    aadharBackUrl: "",
    photoUrl: "",
    photoPublicId: "",
  });

  const districtOptions = useMemo(() => {
    if (formData.state && Array.isArray(districtsByState[formData.state])) {
      return districtsByState[formData.state];
    }
    return allDistricts;
  }, [formData.state, districtsByState, allDistricts]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [eventsRes, locationRes, detectRes, playersRes] =
          await Promise.all([
            axios.get(`${API_URL}/api/matches/events`),
            axios.get(`${API_URL}/api/matches/location/options`),
            axios.get(`${API_URL}/api/matches/location/detect`),
            axios.get(`${API_URL}/api/matches/players`),
          ]);

        const eventsData = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const optionsData = locationRes.data || {};
        const detectData = detectRes.data || {};
        const playersData = Array.isArray(playersRes.data)
          ? playersRes.data
          : [];

        setEvents(eventsData);
        setPlayers(playersData);
        setStates(Array.isArray(optionsData.states) ? optionsData.states : []);
        setDistrictsByState(optionsData.districtsByState || {});
        setAllDistricts(
          Array.isArray(optionsData.allDistricts)
            ? optionsData.allDistricts
            : [],
        );

        const fromStorage = getActiveEventId();
        const selectedEvent =
          eventsData.find((entry) => entry.id === fromStorage) ||
          eventsData.find((entry) => entry.isActive) ||
          eventsData[0];

        if (selectedEvent?.id) {
          setActiveEventId(selectedEvent.id);
        }

        setFormData((current) => ({
          ...current,
          eventId: selectedEvent?.id || current.eventId,
          state: detectData.state || current.state,
          district: detectData.district || current.district,
        }));

        if (detectData.state || detectData.district) {
          setGeoNotice(
            "State and district were auto-detected from your IP. You can change them.",
          );
        }
        try {
          const raw = localStorage.getItem("kabaddipro_pending_registrations");
          setPendingSubmissions(raw ? JSON.parse(raw) : []);
        } catch {
          setPendingSubmissions([]);
        }
      } catch (err) {
        console.error("Failed to initialize registration", err);
      }
    };

    bootstrap();

    const onEventChange = (evt) => {
      setFormData((current) => ({
        ...current,
        eventId: evt.detail?.eventId || getActiveEventId(),
      }));
    };

    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, []);

  useEffect(() => {
    if (!formData.eventId) {
      return;
    }

    const fetchTeams = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/teams`, {
          params: { eventId: formData.eventId },
        });
        setTeams(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Unable to fetch event teams", err);
      }
    };

    fetchTeams();
  }, [formData.eventId, tab]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    const uploadData = new FormData();
    uploadData.append("photo", file);

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/matches/upload`, uploadData);
      setFormData({
        ...formData,
        photoUrl: res.data.url,
        photoPublicId: res.data.publicId || "",
      });
    } catch {
      setFormData({
        ...formData,
        photoUrl: URL.createObjectURL(file),
        photoPublicId: "",
      });
    } finally {
      setLoading(false);
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

  const captureLivePhoto = (mode = "player") => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    if (mode === "player") {
      setPhotoPreview(dataUrl);
      setFormData((current) => ({ ...current, photoUrl: dataUrl }));
    } else if (mode === "front") {
      setAadharFrontPreview(dataUrl);
      setFormData((current) => ({ ...current, aadharFrontUrl: dataUrl }));
    } else if (mode === "back") {
      setAadharBackPreview(dataUrl);
      setFormData((current) => ({ ...current, aadharBackUrl: dataUrl }));
    }

    stopLiveCamera();
  };

  const startAadharCamera = (side) => {
    setAadharCameraMode(side);
    startLiveCamera();
  };

  const handleAadharFileUpload = (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return;

      if (side === "front") {
        setAadharFrontPreview(dataUrl);
        setFormData((current) => ({ ...current, aadharFrontUrl: dataUrl }));
      } else if (side === "back") {
        setAadharBackPreview(dataUrl);
        setFormData((current) => ({ ...current, aadharBackUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitTeam = async (e) => {
    e.preventDefault();
    if (!formData.eventId) return alert("Please select an event first.");

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/matches/teams`, {
        eventId: formData.eventId,
        name: formData.teamName,
        state: formData.state,
        district: formData.district,
        coach: formData.coach,
      });
      setTeams((currentTeams) => [...currentTeams, res.data]);
      setStep(3); // Success step
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPlayer = async (e) => {
    e.preventDefault();

    const validation = validatePlayerIdentity({
      player: formData,
      existingPlayers: players,
    });

    if (!validation.ok) {
      return alert(validation.message);
    }

    if (!formData.photoUrl) return alert("Please upload a player photo");
    if (!formData.aadharFrontUrl)
      return alert("Please upload Aadhar front image");
    if (!formData.aadharBackUrl)
      return alert("Please upload Aadhar back image");
    if (!formData.eventId) return alert("Please select an event first.");

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/matches/players`,
        buildPlayerPayload(formData),
      );
      setPlayers((currentPlayers) => [...currentPlayers, res.data]);
      setStep(3); // Success step
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      eventId: getActiveEventId(),
      teamName: "",
      state: "",
      district: "",
      coach: "",
      playerName: "",
      fatherName: "",
      email: "",
      phone: "",
      age: "",
      weight: "",
      position: "Raider",
      teamId: "",
      dob: "",
      aadhar: "",
      aadharFrontUrl: "",
      aadharBackUrl: "",
      photoUrl: "",
      photoPublicId: "",
    });
    setPhotoPreview(null);
    setAadharFrontPreview(null);
    setAadharBackPreview(null);
    setStep(1);
  };

  const persistPending = (next) => {
    try {
      localStorage.setItem(
        "kabaddipro_pending_registrations",
        JSON.stringify(next || []),
      );
    } catch (e) {
      console.warn("persistPending error", e);
    }
  };

  const approvePending = async (id) => {
    const item = pendingSubmissions.find((p) => p.id === id);
    if (!item) return;
    if (!item.data.photoUrl) return alert("Pending entry lacks photo");
    try {
      setLoading(true);
      const payload = buildPlayerPayload(item.data);
      await axios.post(`${API_URL}/api/matches/players`, payload);
      const next = pendingSubmissions.filter((p) => p.id !== id);
      setPendingSubmissions(next);
      persistPending(next);
      alert("Player approved and added to roster.");
    } catch (err) {
      alert("Approval failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const declinePending = (id) => {
    if (!window.confirm("Decline and remove this pending registration?"))
      return;
    const next = pendingSubmissions.filter((p) => p.id !== id);
    setPendingSubmissions(next);
    persistPending(next);
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: "2rem" }}>
        <h1 className="title-glow">
          Registration <span className="text-gradient">Portal</span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          Complete event-wise team, district, and player registration with state
          controls.
        </p>
      </header>

      {pendingSubmissions && pendingSubmissions.length > 0 && (
        <div
          className="glass-panel"
          style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto 1rem" }}
        >
          <h3 style={{ marginBottom: "0.5rem" }}>Pending User Registrations</h3>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            These submissions were made by users and require admin approval
            before being added to the official roster.
          </p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {pendingSubmissions.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{p.data.playerName}</div>
                  <div className="muted">
                    Submitted: {new Date(p.createdAt).toLocaleString()}
                  </div>
                  <div className="muted">
                    Email: {p.data.email} • Aadhar: {p.data.aadhar}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => approvePending(p.id)}
                    disabled={loading}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => declinePending(p.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="glass-panel"
        style={{ padding: "2.5rem", maxWidth: "900px", margin: "0 auto" }}
      >
        {step !== 3 && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "3rem",
              borderBottom: "1px solid var(--glass-border)",
              paddingBottom: "1.5rem",
            }}
          >
            <button
              className={`btn ${tab === "team" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setTab("team");
                setStep(1);
              }}
            >
              <Trophy size={20} /> Register Team
            </button>
            <button
              className={`btn ${tab === "player" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setTab("player");
                setStep(1);
              }}
            >
              <UserPlus size={20} /> Register Player
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === "team" && step === 1 && (
            <motion.form
              key="team-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmitTeam}
            >
              <h2 style={{ marginBottom: "1.5rem", color: "var(--primary)" }}>
                Team Details
              </h2>
              {geoNotice && (
                <div
                  className="sheet-block"
                  style={{ marginBottom: "1rem", padding: "0.8rem 1rem" }}
                >
                  <span className="muted">{geoNotice}</span>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "2rem",
                }}
              >
                <div className="form-group">
                  <label className="form-label">Team Name</label>
                  <input
                    className="form-control"
                    required
                    placeholder="e.g. Pune Panthers"
                    value={formData.teamName}
                    onChange={(e) =>
                      setFormData({ ...formData, teamName: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Event</label>
                  <select
                    className="form-control"
                    required
                    value={formData.eventId}
                    onChange={(e) => {
                      setActiveEventId(e.target.value);
                      setFormData({
                        ...formData,
                        eventId: e.target.value,
                        teamId: "",
                      });
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
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
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
                      value={formData.district}
                      onChange={(e) =>
                        setFormData({ ...formData, district: e.target.value })
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
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Head Coach Name</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Enter Coach Name"
                    value={formData.coach}
                    onChange={(e) =>
                      setFormData({ ...formData, coach: e.target.value })
                    }
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Register Team"}{" "}
                  <ArrowRight size={20} />
                </button>
              </div>
            </motion.form>
          )}

          {tab === "player" && step === 1 && (
            <motion.form
              key="player-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmitPlayer}
            >
              <h2 style={{ marginBottom: "1.5rem", color: "var(--secondary)" }}>
                Player Registration
              </h2>
              {geoNotice && (
                <div
                  className="sheet-block"
                  style={{ marginBottom: "1rem", padding: "0.8rem 1rem" }}
                >
                  <span className="muted">{geoNotice}</span>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "320px 1fr",
                  gap: "2rem",
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
                    ) : photoPreview ? (
                      <img
                        src={photoPreview}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        alt="Player"
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
                      onClick={
                        cameraOpen
                          ? () => captureLivePhoto(aadharCameraMode || "player")
                          : startLiveCamera
                      }
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
                    <label
                      className="btn btn-secondary"
                      style={{ width: "100%" }}
                    >
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
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-control"
                      required
                      placeholder="Enter legal name"
                      value={formData.playerName}
                      onChange={(e) =>
                        setFormData({ ...formData, playerName: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Father's Name</label>
                    <input
                      className="form-control"
                      required
                      placeholder="Enter father's name"
                      value={formData.fatherName}
                      onChange={(e) =>
                        setFormData({ ...formData, fatherName: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Event</label>
                    <select
                      className="form-control"
                      required
                      value={formData.eventId}
                      onChange={(e) => {
                        setActiveEventId(e.target.value);
                        setFormData({
                          ...formData,
                          eventId: e.target.value,
                          teamId: "",
                        });
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
                    <label className="form-label">
                      Assign to Team (District-wise)
                    </label>
                    <select
                      className="form-control"
                      required
                      value={formData.teamId}
                      onChange={(e) =>
                        setFormData({ ...formData, teamId: e.target.value })
                      }
                    >
                      <option value="">-- Select Registered Team --</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.state} / {t.district})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      required
                      placeholder="player@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="form-control"
                      required
                      placeholder="10-digit mobile number"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Aadhar Number (KYC)</label>
                    <input
                      className="form-control"
                      inputMode="numeric"
                      maxLength="12"
                      required
                      placeholder="12-digit UID"
                      value={formData.aadhar}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          aadhar: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={formData.dob}
                      onChange={(e) => {
                        const dobVal = e.target.value;
                        const calculatedAge = calculateAgeFromDob(dobVal);
                        setFormData({
                          ...formData,
                          dob: dobVal,
                          age:
                            calculatedAge !== null ? String(calculatedAge) : "",
                        });
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Current Age (Auto-calculated)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      readOnly
                      placeholder="Age will be calculated from DOB"
                      value={formData.age}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Weight (in KG)</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      placeholder="e.g. 80"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                    />
                    <small
                      style={{
                        color: "var(--warning)",
                        marginTop: "0.5rem",
                        display: "block",
                      }}
                    >
                      * Must be under 85kg for Pro categories
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Position</label>
                    <select
                      className="form-control"
                      value={formData.position}
                      onChange={(e) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                    >
                      <option value="Raider">Raider (Offense)</option>
                      <option value="Left Corner">Left Corner (Defense)</option>
                      <option value="Right Corner">
                        Right Corner (Defense)
                      </option>
                      <option value="Left Cover">Left Cover (Defense)</option>
                      <option value="Right Cover">Right Cover (Defense)</option>
                      <option value="All-rounder">All-rounder</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AADHAR IMAGES SECTION */}
              <div style={{ marginTop: "2rem" }}>
                <h3
                  style={{
                    marginBottom: "1rem",
                    fontSize: "1.1rem",
                    color: "var(--primary)",
                  }}
                >
                  Aadhar Verification (KYC)
                </h3>
                <p
                  style={{
                    marginBottom: "1.5rem",
                    color: "var(--text-muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  Capture or upload clear images of both sides of the player's
                  Aadhar for verification.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  {/* AADHAR FRONT */}
                  <div
                    style={{
                      border: "1px solid var(--glass-border)",
                      borderRadius: "8px",
                      padding: "1rem",
                    }}
                  >
                    <label
                      style={{
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                        display: "block",
                        color: "var(--text-primary)",
                      }}
                    >
                      Aadhar Front Side
                    </label>
                    <div
                      style={{
                        width: "100%",
                        height: "200px",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "0.75rem",
                        overflow: "hidden",
                      }}
                    >
                      {aadharFrontPreview ? (
                        <img
                          src={aadharFrontPreview}
                          alt="Aadhar Front"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            color: "var(--text-muted)",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "0.9rem" }}>
                            Front side image
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: "0.9rem" }}
                        onClick={() => startAadharCamera("front")}
                      >
                        <Camera size={16} />{" "}
                        {aadharFrontPreview ? "Retake Front" : "Capture Front"}
                      </button>
                      <label
                        className="btn btn-secondary"
                        style={{ fontSize: "0.9rem", cursor: "pointer" }}
                      >
                        <Upload size={16} /> Upload Front
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleAadharFileUpload(e, "front")}
                        />
                      </label>
                    </div>
                  </div>

                  {/* AADHAR BACK */}
                  <div
                    style={{
                      border: "1px solid var(--glass-border)",
                      borderRadius: "8px",
                      padding: "1rem",
                    }}
                  >
                    <label
                      style={{
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                        display: "block",
                        color: "var(--text-primary)",
                      }}
                    >
                      Aadhar Back Side
                    </label>
                    <div
                      style={{
                        width: "100%",
                        height: "200px",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "0.75rem",
                        overflow: "hidden",
                      }}
                    >
                      {aadharBackPreview ? (
                        <img
                          src={aadharBackPreview}
                          alt="Aadhar Back"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            color: "var(--text-muted)",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "0.9rem" }}>
                            Back side image
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: "0.9rem" }}
                        onClick={() => startAadharCamera("back")}
                      >
                        <Camera size={16} />{" "}
                        {aadharBackPreview ? "Retake Back" : "Capture Back"}
                      </button>
                      <label
                        className="btn btn-secondary"
                        style={{ fontSize: "0.9rem", cursor: "pointer" }}
                      >
                        <Upload size={16} /> Upload Back
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleAadharFileUpload(e, "back")}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {cameraOpen && (
                <div className="camera-box">
                  <video ref={videoRef} autoPlay muted playsInline />
                </div>
              )}

              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Finalizing..." : "Complete Registration"}{" "}
                  <CheckCircle size={20} />
                </button>
              </div>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="score-card"
            >
              <CheckCircle
                size={100}
                color="var(--accent)"
                style={{ margin: "0 auto 2rem" }}
              />
              <h2 className="title-glow" style={{ fontSize: "2.5rem" }}>
                Successfully Registered!
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  marginBottom: "3rem",
                  fontSize: "1.2rem",
                }}
              >
                The {tab} has been added to the official tournament database.
              </p>
              <button className="btn btn-primary" onClick={resetForm}>
                Register Another {tab === "team" ? "Team" : "Player"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Registration;
