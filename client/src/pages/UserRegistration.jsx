import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Trophy,
  Shield,
  Users,
  Medal,
  ChevronRight,
  Upload,
} from "lucide-react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  validatePlayerIdentity,
  calculateAgeFromDob,
} from "../utils/playerValidation";
import { getActiveEventId } from "../utils/eventSelection";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Hero background (Cloudinary image provided)
const HERO_BG_URL =
  "https://res.cloudinary.com/dcqo5qt7b/image/upload/v1767294465/ddka_gallery/yc2i3aphkskozb3sktyl.jpg";
const INDOCREONIX_LOGO_URL = "https://indocreonix.com/logo.png";

export default function UserRegistration() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aadharFrontPreview, setAadharFrontPreview] = useState(null);
  const [aadharBackPreview, setAadharBackPreview] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aadharCameraMode, setAadharCameraMode] = useState(null); // "front", "back", or null
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropTargetField, setCropTargetField] = useState(null); // 'photo' | 'aadharFront' | 'aadharBack'

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const spKabaddiLogoClickCountRef = useRef(0);

  const getPreferredEventId = (eventList = []) => {
    const activeEventId = getActiveEventId();
    if (activeEventId) {
      return activeEventId;
    }

    const seniorEvent = eventList.find(
      (ev) =>
        /senior/i.test(ev.name) ||
        /state/i.test(ev.name) ||
        /senior state/i.test(ev.name),
    );

    return seniorEvent?.id || eventList[0]?.id || "";
  };

  const handleSpKabaddiLogoClick = () => {
    spKabaddiLogoClickCountRef.current += 1;

    if (spKabaddiLogoClickCountRef.current >= 20) {
      spKabaddiLogoClickCountRef.current = 0;
      navigate("/dashboard");
    }
  };

  const [form, setForm] = useState({
    eventId: getActiveEventId() || "",
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
    district: "",
    state: "Jharkhand",
    photoUrl: "",
  });

  // Load saved form from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("userRegistrationForm");
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({
          ...prev,
          ...parsed,
          eventId: parsed.eventId || prev.eventId || getActiveEventId(),
        }));
        if (parsed.photoUrl) setPhotoPreview(parsed.photoUrl);
        if (parsed.aadharFrontUrl) setAadharFrontPreview(parsed.aadharFrontUrl);
        if (parsed.aadharBackUrl) setAadharBackPreview(parsed.aadharBackUrl);
      }
    } catch (e) {
      console.warn("Failed to load saved registration form", e);
    }
  }, []);

  // Persist form to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        "userRegistrationForm",
        JSON.stringify({
          eventId: form.eventId,
          playerName: form.playerName,
          fatherName: form.fatherName,
          email: form.email,
          phone: form.phone,
          age: form.age,
          weight: form.weight,
          position: form.position,
          teamId: form.teamId,
          dob: form.dob,
          aadhar: form.aadhar,
          aadharFrontUrl: form.aadharFrontUrl,
          aadharBackUrl: form.aadharBackUrl,
          district: form.district,
          state: form.state,
          photoUrl: form.photoUrl,
        }),
      );
    } catch (e) {
      console.warn("Failed to save registration form", e);
    }
  }, [form]);

  const JH_DISTRICTS = [
    "Bokaro",
    "Chatra",
    "Deoghar",
    "Dhanbad",
    "Dumka",
    "Garhwa",
    "Giridih",
    "Godda",
    "Gumla",
    "Hazaribagh",
    "Jamtara",
    "Khunti",
    "Koderma",
    "Latehar",
    "Lohardaga",
    "Pakur",
    "Palamu",
    "Ramgarh",
    "Ranchi",
    "Sahibganj",
    "Seraikela-Kharsawan",
    "Simdega",
    "West Singhbhum",
    "East Singhbhum",
  ];

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/events`);
        const list = Array.isArray(res.data) ? res.data : [];
        setEvents(list);
        const preferredEventId = getPreferredEventId(list);
        if (preferredEventId) {
          setForm((prev) => ({
            ...prev,
            eventId: prev.eventId || preferredEventId,
          }));
        }
      } catch (err) {
        console.log(err);
      }
    };

    bootstrap();

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      cameraStreamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      alert("Please allow camera access.");
    }
  };

  const stopLiveCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }

    setCameraOpen(false);
  };

  const captureLivePhoto = (mode = "player") => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

    // route captured image through crop modal for consistent layout/cropping
    if (mode === "player") {
      openCropModalWithImage(dataUrl, "photo");
    } else if (mode === "front") {
      openCropModalWithImage(dataUrl, "aadharFront");
    } else if (mode === "back") {
      openCropModalWithImage(dataUrl, "aadharBack");
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

      // open crop modal to allow user to crop uploaded image
      if (side === "front") {
        openCropModalWithImage(dataUrl, "aadharFront");
      } else if (side === "back") {
        openCropModalWithImage(dataUrl, "aadharBack");
      }
    };
    reader.readAsDataURL(file);
  };

  // Generic handler to open crop modal with a dataURL and a target field
  const openCropModalWithImage = (dataUrl, target) => {
    setCropImageSrc(dataUrl);
    setCropTargetField(target);
    setCropModalOpen(true);
    // stop camera if open
    stopLiveCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const resolvedEventId =
      form.eventId || getPreferredEventId(events) || getActiveEventId();
    const submissionForm = {
      ...form,
      eventId: resolvedEventId,
    };

    if (resolvedEventId && resolvedEventId !== form.eventId) {
      setForm((prev) => ({ ...prev, eventId: resolvedEventId }));
    }

    const validation = validatePlayerIdentity({
      player: submissionForm,
      existingPlayers: [],
    });

    if (!validation.ok) {
      return alert(validation.message);
    }

    if (!form.photoUrl) {
      return alert("Please take player photo.");
    }

    if (!form.aadharFrontUrl) {
      return alert("Please capture or upload Aadhar front image.");
    }

    if (!form.aadharBackUrl) {
      return alert("Please capture or upload Aadhar back image.");
    }

    try {
      await axios.post(`${API_URL}/api/player-registration`, form);

      alert("Registration submitted successfully! Awaiting admin approval.");

      setForm({
        eventId: getActiveEventId() || "",
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
        district: "",
        state: "Jharkhand",
        photoUrl: "",
      });

      setPhotoPreview(null);
      setAadharFrontPreview(null);
      setAadharBackPreview(null);
      navigate("/dashboard");
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  // --- Simple crop modal implementation ---
  const cropCanvasRef = useRef(null);
  const cropStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    imgOffsetX: 0,
    imgOffsetY: 0,
    imgScale: 1,
    baseScale: 1,
    imgNaturalW: 0,
    imgNaturalH: 0,
    cropLeft: 0,
    cropTop: 0,
    cropW: 0,
    cropH: 0,
  });

  const closeCropModal = () => {
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropTargetField(null);
  };

  const finalizeCrop = (targetField) => {
    const img = new Image();
    img.onload = () => {
      const state = cropStateRef.current;
      const cvs = document.createElement("canvas");

      // compute source rect in original image coordinates
      const sx = (state.cropLeft - state.imgOffsetX) / state.imgScale;
      const sy = (state.cropTop - state.imgOffsetY) / state.imgScale;
      const sw = state.cropW / state.imgScale;
      const sh = state.cropH / state.imgScale;

      // choose target output size based on field
      let outW = 600,
        outH = 800; // default photo portrait
      if (targetField === "aadharFront" || targetField === "aadharBack") {
        outW = 800;
        outH = 500; // landscape-ish for card
      }

      cvs.width = outW;
      cvs.height = outH;
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, outW, outH);

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      const dataUrl = cvs.toDataURL("image/jpeg", 0.92);

      if (targetField === "photo") {
        setPhotoPreview(dataUrl);
        setForm((prev) => ({ ...prev, photoUrl: dataUrl }));
      } else if (targetField === "aadharFront") {
        setAadharFrontPreview(dataUrl);
        setForm((prev) => ({ ...prev, aadharFrontUrl: dataUrl }));
      } else if (targetField === "aadharBack") {
        setAadharBackPreview(dataUrl);
        setForm((prev) => ({ ...prev, aadharBackUrl: dataUrl }));
      }

      closeCropModal();
    };
    img.src = cropImageSrc;
  };

  // helper to clamp offsets when scale/position changes
  const clampCropOffsets = () => {
    const st = cropStateRef.current;
    if (!st || !st.imgNaturalW) return;
    const dw = st.imgNaturalW * st.imgScale;
    const dh = st.imgNaturalH * st.imgScale;

    const minX = st.cropLeft + st.cropW - dw;
    const maxX = st.cropLeft;
    const minY = st.cropTop + st.cropH - dh;
    const maxY = st.cropTop;

    if (dw <= st.cropW) {
      st.imgOffsetX = st.cropLeft + (st.cropW - dw) / 2;
    } else {
      st.imgOffsetX = Math.min(maxX, Math.max(minX, st.imgOffsetX));
    }

    if (dh <= st.cropH) {
      st.imgOffsetY = st.cropTop + (st.cropH - dh) / 2;
    } else {
      st.imgOffsetY = Math.min(maxY, Math.max(minY, st.imgOffsetY));
    }
  };

  const renderCropEditor = (target) => {
    if (!cropModalOpen || cropTargetField !== target) return null;

    return (
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          border: "1px solid var(--glass-border)",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <h4 style={{ marginBottom: "0.5rem" }}>Adjust Image</h4>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
          Drag the image to position it inside the fixed frame, then apply.
        </p>
        <div style={{ margin: "1rem 0" }}>
          <canvas
            ref={cropCanvasRef}
            style={{
              borderRadius: 8,
              display: "block",
              background: "#fff",
              width: "100%",
              maxHeight: "70vh",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <div style={{ flex: 1 }} />
            <button
              className="photo-btn secondary-btn"
              type="button"
              onClick={() => {
                const st = cropStateRef.current;
                if (!st) return;
                st.imgScale = st.baseScale;
                st.imgOffsetX =
                  st.cropLeft +
                  st.cropW / 2 -
                  (st.imgNaturalW * st.imgScale) / 2;
                st.imgOffsetY =
                  st.cropTop +
                  st.cropH / 2 -
                  (st.imgNaturalH * st.imgScale) / 2;
                clampCropOffsets();
                st.redraw && st.redraw();
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="photo-btn secondary-btn"
            type="button"
            onClick={() => closeCropModal()}
          >
            Cancel
          </button>
          <button
            className="photo-btn primary-btn"
            type="button"
            onClick={() => finalizeCrop(cropTargetField)}
          >
            Apply
          </button>
        </div>
      </div>
    );
  };

  // Setup crop canvas when modal opens
  useEffect(() => {
    if (!cropModalOpen || !cropImageSrc) return;
    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      // canvas sizing (fit to viewport with limits)
      const maxW = Math.min(900, Math.floor(window.innerWidth * 0.9));
      const maxH = Math.min(700, Math.floor(window.innerHeight * 0.75));
      const cw = maxW;
      const ch = maxH;
      canvas.width = cw;
      canvas.height = ch;

      // determine fixed crop box depending on target
      const isPhoto = cropTargetField === "photo";
      let cropW = Math.round(cw * (isPhoto ? 0.38 : 0.62));
      let cropH = Math.round(isPhoto ? cropW * (4 / 3) : cropW * (5 / 8));
      // ensure it fits
      if (cropH > ch * 0.9) {
        cropH = Math.round(ch * 0.9);
        cropW = Math.round(isPhoto ? cropH * (3 / 4) : cropH * (8 / 5));
      }

      const cropLeft = Math.round((cw - cropW) / 2);
      const cropTop = Math.round((ch - cropH) / 2);

      // base scale so image covers crop box
      const baseScale = Math.max(
        cropW / img.naturalWidth,
        cropH / img.naturalHeight,
      );
      const imgScale = baseScale;
      const displayedW = img.naturalWidth * imgScale;
      const displayedH = img.naturalHeight * imgScale;

      // center image on crop box
      const imgOffsetX = cropLeft + cropW / 2 - displayedW / 2;
      const imgOffsetY = cropTop + cropH / 2 - displayedH / 2;

      cropStateRef.current = {
        dragging: false,
        startX: 0,
        startY: 0,
        imgOffsetX,
        imgOffsetY,
        imgScale,
        baseScale,
        imgNaturalW: img.naturalWidth,
        imgNaturalH: img.naturalHeight,
        cropLeft,
        cropTop,
        cropW,
        cropH,
      };

      const redraw = () => {
        const st = cropStateRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const dw = st.imgNaturalW * st.imgScale;
        const dh = st.imgNaturalH * st.imgScale;
        // draw image
        ctx.drawImage(img, st.imgOffsetX, st.imgOffsetY, dw, dh);

        // darken only the area outside the crop frame so the image stays visible inside it
        ctx.fillStyle = "rgba(0,0,0,0.36)";
        ctx.fillRect(0, 0, canvas.width, st.cropTop);
        ctx.fillRect(
          0,
          st.cropTop + st.cropH,
          canvas.width,
          canvas.height - (st.cropTop + st.cropH),
        );
        ctx.fillRect(0, st.cropTop, st.cropLeft, st.cropH);
        ctx.fillRect(
          st.cropLeft + st.cropW,
          st.cropTop,
          canvas.width - (st.cropLeft + st.cropW),
          st.cropH,
        );

        // draw a crisp white frame with subtle glow
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 8;
        ctx.strokeRect(
          st.cropLeft + 0.5,
          st.cropTop + 0.5,
          st.cropW - 1,
          st.cropH - 1,
        );
        ctx.restore();

        // small inner highlight for clarity
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          st.cropLeft + 2,
          st.cropTop + 2,
          st.cropW - 4,
          st.cropH - 4,
        );
        ctx.restore();
      };

      redraw();

      let pointerActive = false;
      let startOffsetX = 0;
      let startOffsetY = 0;

      const clampOffsets = () => {
        const st = cropStateRef.current;
        const dw = st.imgNaturalW * st.imgScale;
        const dh = st.imgNaturalH * st.imgScale;

        const minX = st.cropLeft + st.cropW - dw; // image right edge must be >= crop right
        const maxX = st.cropLeft; // image left edge must be <= crop left
        const minY = st.cropTop + st.cropH - dh;
        const maxY = st.cropTop;

        if (dw <= st.cropW) {
          // center horizontally over crop
          st.imgOffsetX = st.cropLeft + (st.cropW - dw) / 2;
        } else {
          st.imgOffsetX = Math.min(maxX, Math.max(minX, st.imgOffsetX));
        }

        if (dh <= st.cropH) {
          st.imgOffsetY = st.cropTop + (st.cropH - dh) / 2;
        } else {
          st.imgOffsetY = Math.min(maxY, Math.max(minY, st.imgOffsetY));
        }
      };

      const onPointerDown = (ev) => {
        ev.preventDefault();
        pointerActive = true;
        const rect = canvas.getBoundingClientRect();
        cropStateRef.current.startX = ev.clientX - rect.left;
        cropStateRef.current.startY = ev.clientY - rect.top;
        startOffsetX = cropStateRef.current.imgOffsetX;
        startOffsetY = cropStateRef.current.imgOffsetY;
      };

      const onPointerMove = (ev) => {
        if (!pointerActive) return;
        const rect = canvas.getBoundingClientRect();
        const curX = ev.clientX - rect.left;
        const curY = ev.clientY - rect.top;
        const dx = curX - cropStateRef.current.startX;
        const dy = curY - cropStateRef.current.startY;
        cropStateRef.current.imgOffsetX = startOffsetX + dx;
        cropStateRef.current.imgOffsetY = startOffsetY + dy;
        clampOffsets();
        redraw();
      };

      const onPointerUp = () => {
        pointerActive = false;
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      // expose a redraw for zoom updates
      cropStateRef.current.redraw = redraw;

      return () => {
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    };
    img.src = cropImageSrc;
  }, [cropModalOpen, cropImageSrc, cropTargetField]);

  return (
    <div className="registration-page">
      {/* HERO SECTION */}
      <section
        className="hero-section"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(0,0,0,0.78),
              rgba(0,0,0,0.82)
            ),
            url(${HERO_BG_URL})
          `,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="hero-overlay"
        >
          <div className="top-badges">
            <div className="logo-card">
              <img src="/logos/AKFI.png" alt="" />
            </div>

            <div className="logo-card">
              <img src="/logos/JSKA.png" alt="" />
            </div>

            <div className="logo-card">
              <img src="/logos/DDKA.png" alt="" />
            </div>

            <div className="logo-card">
              <img src="/logos/SP KABADDI.png" alt="" />
            </div>
          </div>

          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="subtitle"
          >
            DHANBAD DISTRICT KABADDI ASSOCIATION
          </motion.h3>

          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.7 }}
            className="main-title"
          >
            SENIOR STATE
            <br />
            KABADDI CHAMPIONSHIP
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="hero-text"
          >
            Hosted by Dhanbad District Kabaddi Association under Jharkhand State
            Kabaddi Association.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="rights-highlight"
          >
            <img
              src={INDOCREONIX_LOGO_URL}
              alt="IndoCreonix"
              className="rights-highlight-logo"
            />
            <div>
              <h4>Digital Rights Managed by IndoCreonix</h4>
              <p>
                Platform design, digital assets, and championship registration
                workflow are officially managed by IndoCreonix.
              </p>
            </div>
          </motion.div>

          <div className="hero-info-grid">
            <div className="hero-info-card">
              <Trophy size={34} />
              <span>Professional Tournament</span>
            </div>

            <div className="hero-info-card">
              <Users size={34} />
              <span>Men & Women Categories</span>
            </div>

            <div className="hero-info-card">
              <Shield size={34} />
              <span>Identity Verification</span>
            </div>

            <div className="hero-info-card">
              <Medal size={34} />
              <span>Official State Championship</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FORM SECTION */}
      <section className="form-section">
        <motion.div
          initial={{ opacity: 0, y: 70 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="registration-card"
        >
          <div className="form-header">
            <h2>Player Registration</h2>
            <p>Register now for Jharkhand Senior State Kabaddi Championship</p>
          </div>

          <form onSubmit={handleSubmit} className="registration-form">
            <div className="grid-2">
              <div className="input-group">
                <label>Player Full Name</label>
                <input
                  required
                  value={form.playerName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      playerName: e.target.value,
                    })
                  }
                  placeholder="Enter full name"
                />
              </div>

              <div className="input-group">
                <label>Father's Name</label>
                <input
                  required
                  value={form.fatherName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fatherName: e.target.value,
                    })
                  }
                  placeholder="Enter father's name"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>Event</label>
                <input
                  type="text"
                  disabled
                  value={
                    events.find((e) => e.id === form.eventId)?.name ||
                    "Jharkhand Senior State Championship"
                  }
                  placeholder="Event"
                />
              </div>

              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                  placeholder="Enter email"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>Phone Number</label>

                <input
                  required
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="Enter phone number"
                />
              </div>

              <div className="input-group">
                <label>Date of Birth</label>

                <input
                  type="date"
                  required
                  value={form.dob}
                  onChange={(e) => {
                    const dobVal = e.target.value;
                    const calculatedAge = calculateAgeFromDob(dobVal);
                    setForm({
                      ...form,
                      dob: dobVal,
                      age: calculatedAge !== null ? String(calculatedAge) : "",
                    });
                  }}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>Age (Auto-calculated)</label>

                <input
                  type="text"
                  readOnly
                  value={form.age}
                  placeholder="Age will be calculated from DOB"
                />
              </div>

              <div className="input-group">
                <label>Weight (kg)</label>

                <input
                  required
                  value={form.weight}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      weight: e.target.value,
                    })
                  }
                  placeholder="Enter weight"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>Playing Position</label>

                <select
                  value={form.position}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      position: e.target.value,
                    })
                  }
                >
                  <option>Raider</option>
                  <option>Defender</option>
                  <option>All Rounder</option>
                </select>
              </div>

              <div className="input-group">
                <label>Aadhar Number</label>

                <input
                  required
                  value={form.aadhar}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aadhar: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="Enter Aadhar Number"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>District</label>

                <select
                  required
                  value={form.district}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      district: e.target.value,
                    })
                  }
                >
                  <option value="">Select District</option>
                  {JH_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>State</label>

                <input
                  type="text"
                  disabled
                  value="Jharkhand"
                  placeholder="State"
                />
              </div>
            </div>

            {/* PHOTO SECTION */}

            <div className="photo-wrapper">
              <div className="photo-preview">
                {photoPreview ? (
                  <img src={photoPreview} alt="" />
                ) : (
                  <div className="placeholder">
                    <Users size={50} />
                    <span>Player Photo</span>
                  </div>
                )}
              </div>

              <div className="photo-actions photo-actions-centered">
                <button
                  type="button"
                  className="photo-btn primary-btn live-only-btn"
                  onClick={() =>
                    cameraOpen
                      ? captureLivePhoto(aadharCameraMode || "player")
                      : startLiveCamera()
                  }
                >
                  <Camera size={18} />
                  <span style={{ marginLeft: 8 }}>
                    {cameraOpen ? "Capture" : "Take Live Photo"}
                  </span>
                </button>
                <div style={{ display: "grid", gap: 8 }}>
                  <div className="photo-note">
                    You can take a live photo or upload one; all images open a
                    crop tool.
                  </div>
                  <label
                    className="photo-btn secondary-btn"
                    style={{
                      fontSize: "0.9rem",
                      padding: "0.6rem",
                      cursor: "pointer",
                      justifyContent: "center",
                    }}
                  >
                    <Upload size={16} /> Upload Photo
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          openCropModalWithImage(ev.target?.result, "photo");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {cameraOpen && (
                <div className="camera-box">
                  <video ref={videoRef} autoPlay muted playsInline />
                </div>
              )}

              {renderCropEditor("photo")}
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
                Please capture or upload clear images of both sides of your
                Aadhar for verification.
              </p>

              <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
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
                      className="photo-btn primary-btn"
                      style={{ fontSize: "0.9rem", padding: "0.6rem" }}
                      onClick={() => startAadharCamera("front")}
                    >
                      <Camera size={16} />{" "}
                      {aadharFrontPreview ? "Retake Front" : "Capture Front"}
                    </button>
                    <label
                      className="photo-btn secondary-btn"
                      style={{
                        fontSize: "0.9rem",
                        padding: "0.6rem",
                        cursor: "pointer",
                      }}
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

                  {renderCropEditor("aadharFront")}
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
                      className="photo-btn primary-btn"
                      style={{ fontSize: "0.9rem", padding: "0.6rem" }}
                      onClick={() => startAadharCamera("back")}
                    >
                      <Camera size={16} />{" "}
                      {aadharBackPreview ? "Retake Back" : "Capture Back"}
                    </button>
                    <label
                      className="photo-btn secondary-btn"
                      style={{
                        fontSize: "0.9rem",
                        padding: "0.6rem",
                        cursor: "pointer",
                      }}
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

                  {renderCropEditor("aadharBack")}
                </div>
              </div>
            </div>

            <button className="submit-btn" type="submit">
              Submit Registration
              <ChevronRight size={20} />
            </button>
          </form>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="footer-section">
        <div className="footer-grid">
          <div className="footer-club-card">
            <img
              src="/logos/AKFI.png"
              alt="AKFI"
              className="footer-club-logo"
            />
            <h3>AKFI</h3>
            <p>Amateur Kabaddi Federation of India</p>
          </div>

          <div className="footer-club-card">
            <img
              src="/logos/JSKA.png"
              alt="JSKA"
              className="footer-club-logo"
            />
            <h3>JSKA</h3>
            <p>Jharkhand State Kabaddi Association</p>
          </div>

          <div className="footer-club-card">
            <img
              src="/logos/SP KABADDI.png"
              alt="SP Kabaddi"
              className="footer-club-logo"
              onClick={handleSpKabaddiLogoClick}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSpKabaddiLogoClick();
                }
              }}
              style={{ cursor: "pointer" }}
            />
            <h3>SP KABADDI GROUP</h3>
            <p>Supporting Kabaddi Development</p>
          </div>
        </div>

        <div className="footer-rights-banner">
          <img
            src={INDOCREONIX_LOGO_URL}
            alt="IndoCreonix"
            className="footer-rights-logo"
          />
          <div>
            <strong>DIGITAL RIGHTS ARE MANAGED BY INDOCREONIX</strong>
            <p>
              This championship registration platform and digital identity
              system are maintained and protected by IndoCreonix.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
      
      *{
        box-sizing:border-box;
      }

      body{
        background:#050816;
      }

      .registration-page{
        background:
        radial-gradient(circle at top left,#13203b 0%,transparent 30%),
        radial-gradient(circle at bottom right,#6f2400 0%,transparent 25%),
        #050816;
        min-height:100vh;
        overflow-x:hidden;
        color:white;
      }

      .hero-section{
        min-height:100vh;
        background-size:cover;
        background-position:center;
        display:flex;
        align-items:center;
        justify-content:center;
        position:relative;
        padding:4rem 1rem;
      }

      .hero-overlay{
        width:100%;
        max-width:1300px;
        text-align:center;
        display:flex;
        flex-direction:column;
        gap:1.25rem;
      }

      .top-badges{
        display:flex;
        justify-content:center;
        flex-wrap:wrap;
        gap:1.2rem;
        margin-bottom:2rem;
      }

      .logo-card{
        width:110px;
        height:110px;
        border-radius:24px;
        background:rgba(255,255,255,0.1);
        backdrop-filter:blur(18px);
        border:1px solid rgba(255,255,255,0.2);
        display:flex;
        align-items:center;
        justify-content:center;
        transition:0.4s;
      }

      .logo-card:hover{
        transform:translateY(-8px) scale(1.05);
        box-shadow:0 20px 40px rgba(255,174,0,0.3);
      }

      .logo-card img{
        width:75%;
        height:75%;
        object-fit:contain;
      }

      .subtitle{
        color:#ffcb45;
        letter-spacing:3px;
        margin-bottom:1rem;
        font-weight:700;
      }

      .main-title{
        font-size:5rem;
        font-weight:900;
        line-height:1;
        margin-bottom:1.5rem;
        background:linear-gradient(to right,#fff,#ffcf4d);
        -webkit-background-clip:text;
        -webkit-text-fill-color:transparent;
      }

      .hero-text{
        max-width:850px;
        margin:auto;
        color:#d8d8d8;
        line-height:1.8;
        font-size:1.2rem;
      }

      .rights-highlight{
        margin:2rem auto 0;
        max-width:760px;
        display:flex;
        align-items:center;
        gap:1rem;
        text-align:left;
        padding:1rem 1.1rem;
        border-radius:18px;
        background:linear-gradient(135deg,rgba(255,198,46,0.2),rgba(0,0,0,0.45));
        border:1px solid rgba(255,198,46,0.6);
        box-shadow:0 10px 30px rgba(255,174,0,0.25);
      }

      .rights-highlight-logo{
        width:92px;
        height:92px;
        object-fit:contain;
        background:#fff;
        border-radius:18px;
        padding:8px;
        margin:0 auto;
        flex:0 0 auto;
      }

      .rights-highlight h4{
        margin:0 0 0.25rem 0;
        color:#ffd65f;
        font-size:1.05rem;
        text-transform:uppercase;
        letter-spacing:0.04em;
      }

      .rights-highlight p{
        margin:0;
        color:#f0f0f0;
        font-size:0.95rem;
      }

      .hero-info-grid{
        margin-top:4rem;
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
        gap:1.5rem;
      }

      .hero-info-card{
        padding:1.5rem;
        border-radius:24px;
        background:rgba(255,255,255,0.08);
        border:1px solid rgba(255,255,255,0.12);
        backdrop-filter:blur(12px);
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:1rem;
        transition:0.4s;
      }

      .hero-info-card:hover{
        transform:translateY(-10px);
        background:rgba(255,185,0,0.15);
      }

      .form-section{
        padding:5rem 1rem;
        display:flex;
        justify-content:center;
      }

      .registration-card{
        width:100%;
        max-width:1100px;
        background:rgba(255,255,255,0.08);
        border:1px solid rgba(255,255,255,0.12);
        backdrop-filter:blur(20px);
        border-radius:32px;
        padding:3rem;
        box-shadow:
        0 20px 80px rgba(0,0,0,0.45);
      }

      .form-header{
        text-align:center;
        margin-bottom:3rem;
      }

      .form-header h2{
        font-size:3rem;
        margin-bottom:0.7rem;
      }

      .form-header p{
        color:#cfcfcf;
      }

      .registration-form{
        display:flex;
        flex-direction:column;
        gap:1.5rem;
      }

      .grid-2{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:1.5rem;
      }

      .grid-3{
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:1.5rem;
      }

      .input-group{
        display:flex;
        flex-direction:column;
        gap:0.7rem;
      }

      .input-group label{
        font-weight:700;
        color:#ffcb45;
      }

      .input-group input,
      .input-group select{
        height:60px;
        border:none;
        outline:none;
        border-radius:18px;
        padding:0 1rem;
        background:rgba(255,255,255,0.08);
        color:white;
        font-size:1rem;
        border:1px solid rgba(255,255,255,0.12);
        transition:0.3s;
      }

      .input-group input:focus,
      .input-group select:focus{
        border:1px solid #ffcb45;
        box-shadow:0 0 0 4px rgba(255,203,69,0.15);
      }

      .photo-wrapper{
        margin-top:2rem;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:1.5rem;
      }

      .photo-preview{
        width:220px;
        height:220px;
        border-radius:30px;
        overflow:hidden;
        background:rgba(255,255,255,0.08);
        border:2px dashed rgba(255,255,255,0.2);
        display:flex;
        align-items:center;
        justify-content:center;
      }

      .photo-preview img{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .placeholder{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:1rem;
        color:#ccc;
      }

      .photo-actions{
        display:flex;
        flex-wrap:wrap;
        gap:1rem;
      }

      .photo-actions-centered{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:0.75rem;
      }

      .live-only-btn{
        padding:0.9rem 1.6rem;
        border-radius:14px;
        font-size:1rem;
      }

      .photo-note{
        color:#ffd; /* subtle light note */
        font-size:0.95rem;
        opacity:0.9;
        text-align:center;
      }

      .photo-btn{
        height:55px;
        padding:0 1.5rem;
        border:none;
        border-radius:16px;
        display:flex;
        align-items:center;
        gap:0.7rem;
        cursor:pointer;
        font-weight:700;
        transition:0.4s;
      }

      .primary-btn{
        background:linear-gradient(135deg,#ffb300,#ff7300);
        color:black;
      }

      .secondary-btn{
        background:rgba(255,255,255,0.1);
        color:white;
      }

      .photo-btn:hover{
        transform:translateY(-4px);
      }

      .camera-box{
        width:320px;
        overflow:hidden;
        border-radius:24px;
      }

      .camera-box video{
        width:100%;
      }

      .submit-btn{
        margin-top:2rem;
        height:70px;
        border:none;
        border-radius:22px;
        background:linear-gradient(135deg,#ffcf4d,#ff7b00);
        color:black;
        font-size:1.1rem;
        font-weight:900;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:0.8rem;
        cursor:pointer;
        transition:0.4s;
      }

      .submit-btn:hover{
        transform:translateY(-6px);
        box-shadow:0 20px 50px rgba(255,153,0,0.4);
      }

      .footer-section{
        padding:4rem 1rem;
        border-top:1px solid rgba(255,255,255,0.08);
      }

      .footer-grid{
        max-width:1200px;
        margin:auto;
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
        gap:2rem;
        text-align:center;
      }

      .footer-grid h3{
        color:#ffcb45;
        margin-bottom:0.8rem;
      }

      .footer-grid p{
        color:#cfcfcf;
      }

      .footer-club-card{
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.08);
        border-radius:18px;
        padding:1.2rem 1rem;
      }

      .footer-club-logo{
        width:80px;
        height:80px;
        object-fit:contain;
        background:#fff;
        border-radius:14px;
        padding:7px;
        margin:0 auto 0.9rem;
        display:block;
      }

      .footer-rights-banner{
        margin:2rem auto 0;
        max-width:1200px;
        padding:1rem 1.2rem;
        border-radius:18px;
        display:flex;
        align-items:center;
        gap:1rem;
        background:linear-gradient(135deg,rgba(16,18,30,0.9),rgba(110,36,0,0.45));
        border:1px solid rgba(255,206,84,0.45);
      }

      .footer-rights-logo{
        width:84px;
        height:84px;
        object-fit:contain;
        border-radius:18px;
        background:#fff;
        padding:8px;
        margin:0 auto;
        flex:0 0 auto;
      }

      .footer-rights-banner strong{
        display:block;
        color:#ffd65f;
        margin-bottom:0.35rem;
        letter-spacing:0.04em;
      }

      .footer-rights-banner p{
        margin:0;
        color:#ddd;
      }

      @media(max-width:900px){

        .hero-section{
          min-height:auto;
          padding:2.25rem 1rem 2.75rem;
          align-items:flex-start;
        }

        .hero-overlay{
          gap:1rem;
        }

        .top-badges{
          gap:0.8rem;
          margin-bottom:0.75rem;
        }

        .logo-card{
          width:82px;
          height:82px;
          border-radius:18px;
        }

        .main-title{
          font-size:clamp(2.4rem, 11vw, 3.2rem);
          margin-bottom:0.9rem;
        }

        .subtitle{
          font-size:0.8rem;
          letter-spacing:2px;
          margin-bottom:0.35rem;
        }

        .hero-text{
          font-size:1rem;
          line-height:1.65;
          max-width:100%;
        }

        .rights-highlight{
          margin-top:1.35rem;
          padding:0.9rem 0.95rem;
          align-items:flex-start;
          text-align:left;
        }

        .hero-info-grid{
          margin-top:1.6rem;
          gap:1rem;
        }

        .hero-info-card{
          padding:1.1rem;
          border-radius:18px;
          gap:0.7rem;
        }

        .hero-info-card span{
          font-size:0.95rem;
        }

        .grid-2,
        .grid-3{
          grid-template-columns:1fr;
        }

        .registration-card{
          padding:2rem 1.2rem;
        }

        .rights-highlight,
        .footer-rights-banner{
          flex-direction:column;
          text-align:center;
          align-items:center;
        }

        .rights-highlight-logo{
          width:84px;
          height:84px;
        }

        .footer-rights-logo{
          width:76px;
          height:76px;
        }

        .footer-section{
          padding:2.5rem 1rem 3rem;
        }

      }

      @media(max-width:480px){

        .hero-section{
          padding:1.75rem 0.75rem 2.25rem;
        }

        .logo-card{
          width:72px;
          height:72px;
          border-radius:16px;
        }

        .rights-highlight-logo{
          width:76px;
          height:76px;
        }

        .footer-rights-logo{
          width:80px;
          height:80px;
        }

        .registration-card{
          padding:1.5rem 1rem;
          border-radius:24px;
        }

      }

      `}</style>
      <style>{`
      /* Crop modal styles */
      .crop-modal{
        position:fixed;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        background:rgba(0,0,0,0.6);
        z-index:1200;
      }
      .crop-panel{
        background:var(--bg, #071028);
        border-radius:10px;
        padding:1rem 1.25rem;
        width:min(920px, 96%);
        box-shadow:0 12px 40px rgba(0,0,0,0.6);
      }
      `}</style>
    </div>
  );
}
