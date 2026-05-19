const {
  db,
  isFirestoreAvailable,
  markFirestoreUnavailable,
} = require("../config/firebase");
const { generateFixtures: genFix } = require("../utils/fixtureGenerator");
const {
  cacheDel,
  cacheFlushPrefix,
  cacheGet,
  cacheSet,
  makeKey,
} = require("../utils/cache");
const {
  deleteCloudinaryAssetsFromRecord,
} = require("../utils/cloudinaryCleanup");
const {
  getAllStates,
  getDistricts,
  getCurrentState,
} = require("india-state-district");
const fs = require("fs");
const path = require("path");

const fallbackStorePath = path.join(
  __dirname,
  "..",
  "data",
  "local-store.json",
);

const defaultStore = {
  events: [],
  teams: [],
  players: [],
  matches: [],
};

const ensureFallbackStore = () => {
  const storeDir = path.dirname(fallbackStorePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  if (!fs.existsSync(fallbackStorePath)) {
    fs.writeFileSync(fallbackStorePath, JSON.stringify(defaultStore, null, 2));
  }
};

const readFallbackStore = () => {
  try {
    ensureFallbackStore();
    const raw = fs.readFileSync(fallbackStorePath, "utf8");
    return { ...defaultStore, ...JSON.parse(raw) };
  } catch (error) {
    console.error("Fallback store read error:", error.message);
    return { ...defaultStore };
  }
};

const writeFallbackStore = (nextStore) => {
  try {
    ensureFallbackStore();
    fs.writeFileSync(fallbackStorePath, JSON.stringify(nextStore, null, 2));
  } catch (error) {
    console.error("Fallback store write error:", error.message);
  }
};

let memoryDB = readFallbackStore();

const mutateFallbackStore = (mutator) => {
  memoryDB = readFallbackStore();
  const nextStore = mutator(memoryDB) || memoryDB;
  memoryDB = nextStore;
  writeFallbackStore(memoryDB);
  return memoryDB;
};

const generateId = () =>
  `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const normalizeString = (value) => (value || "").toString().trim();
const normalizePhone = (value) =>
  normalizeString(value).replace(/\D/g, "").slice(0, 10);

const getEventIdFromReq = (req) =>
  normalizeString(req.query.eventId || req.body.eventId);

const buildLocationData = () => {
  const statesRaw = getAllStates() || [];
  const states = statesRaw
    .map((state) => state?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const districtsByState = {};
  const allDistrictsSet = new Set();
  const stateCodeByName = {};

  statesRaw.forEach((entry) => {
    if (entry?.name && entry?.code) stateCodeByName[entry.name] = entry.code;
  });

  states.forEach((state) => {
    const stateCode = stateCodeByName[state] || "";
    const districts = (getDistricts(stateCode) || [])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    districtsByState[state] = districts;
    districts.forEach((district) => allDistrictsSet.add(district));
  });

  return {
    states,
    districtsByState,
    allDistricts: [...allDistrictsSet].sort((a, b) => a.localeCompare(b)),
  };
};

const locationData = buildLocationData();

const findClosestState = (stateName) => {
  if (!stateName) return "";
  const normalized = stateName.toLowerCase();
  return (
    locationData.states.find((state) => state.toLowerCase() === normalized) ||
    locationData.states.find((state) =>
      state.toLowerCase().includes(normalized),
    ) ||
    ""
  );
};

const findDistrictForState = (state, districtName) => {
  if (!state || !districtName) return "";
  const pool = locationData.districtsByState[state] || [];
  const normalized = districtName.toLowerCase();
  return (
    pool.find((district) => district.toLowerCase() === normalized) ||
    pool.find((district) => district.toLowerCase().includes(normalized)) ||
    ""
  );
};

const ensureEventInMemory = (eventId) =>
  memoryDB.events.some((event) => event.id === eventId);

const invalidateDataCaches = async (eventId) => {
  const keys = [
    makeKey("events", "all"),
    makeKey("teams", "all"),
    makeKey("players", "all"),
    makeKey("matches", "all"),
    makeKey("stats", "all"),
    makeKey("live", "all"),
    makeKey("location", "options"),
  ];

  if (eventId) {
    keys.push(
      makeKey("teams", eventId),
      makeKey("players", eventId),
      makeKey("matches", eventId),
      makeKey("stats", eventId),
      makeKey("live", eventId),
    );
  }

  await cacheDel(keys);
};

const readOrFetch = async ({
  cacheKey,
  ttl = 60,
  fallback,
  firestoreFetch,
}) => {
  const cachedValue = await cacheGet(cacheKey);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  if (isFirestoreAvailable()) {
    try {
      const firestoreValue = await firestoreFetch();
      await cacheSet(cacheKey, firestoreValue, ttl);
      return firestoreValue;
    } catch (error) {
      markFirestoreUnavailable(error);
      console.error(
        "Firestore access failed, switching to memory fallback:",
        error.message,
      );
    }
  }

  const fallbackValue = await fallback();
  await cacheSet(cacheKey, fallbackValue, ttl);
  return fallbackValue;
};

// Location and metadata
const getLocationOptions = (_req, res) => {
  res.json(locationData);
};

const detectLocationFromIp = async (req, res) => {
  const requestIp =
    normalizeString(req.query.ip) ||
    normalizeString(req.headers["x-forwarded-for"]) ||
    normalizeString(req.ip).replace("::ffff:", "");

  try {
    const cacheKey = makeKey("location", "detect", requestIp || "local");
    const cached = await cacheGet(cacheKey);
    if (cached !== undefined) {
      return res.json(cached);
    }

    const endpoint =
      requestIp && requestIp !== "::1" && requestIp !== "127.0.0.1"
        ? `https://ipapi.co/${encodeURIComponent(requestIp)}/json/`
        : "https://ipapi.co/json/";

    const response = await fetch(endpoint, { method: "GET" });
    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();

    let payload = {};
    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(rawBody);
      } catch (parseError) {
        throw new Error(
          `Invalid JSON response from location service: ${parseError.message}`,
        );
      }
    } else {
      throw new Error(
        rawBody.slice(0, 120) || "Unexpected location service response",
      );
    }

    const guessedState = findClosestState(
      payload.region || payload.region_name || getCurrentState() || "",
    );
    const guessedDistrict = findDistrictForState(
      guessedState,
      payload.city_district || payload.city || payload.district || "",
    );

    const result = {
      ip: payload.ip || requestIp || "",
      state: guessedState,
      district: guessedDistrict,
      city: payload.city || "",
      source: "ipapi",
    };

    await cacheSet(cacheKey, result, 3600);
    res.json(result);
  } catch (error) {
    console.error("IP location lookup failed:", error.message);
    res.json({
      state: "",
      district: "",
      city: "",
      source: "fallback",
    });
  }
};

// Events
const getEvents = async (_req, res) => {
  const cacheKey = makeKey("events", "all");
  const events = await readOrFetch({
    cacheKey,
    ttl: 30,
    firestoreFetch: async () => {
      if (!db) throw new Error("Database not initialized");
      const snapshot = await db
        .collection("events")
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    fallback: async () => {
      memoryDB = readFallbackStore();
      return [...memoryDB.events].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });

  res.json(events);
};

const addEvent = async (req, res) => {
  const name = normalizeString(req.body.name);
  if (!name) return res.status(400).json({ error: "Event name is required." });

  const event = {
    name,
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    startDate: normalizeString(req.body.startDate),
    endDate: normalizeString(req.body.endDate),
    isActive: Boolean(req.body.isActive),
    createdAt: new Date().toISOString(),
  };

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const docRef = await db.collection("events").add(event);
    if (event.isActive) {
      const snapshot = await db
        .collection("events")
        .where("isActive", "==", true)
        .get();
      const batch = db.batch();
      snapshot.docs
        .filter((doc) => doc.id !== docRef.id)
        .forEach((doc) => batch.update(doc.ref, { isActive: false }));
      await batch.commit();
    }
    await invalidateDataCaches();
    res.status(201).json({ id: docRef.id, ...event });
  } catch (error) {
    console.error(
      "Firestore Error in addEvent, using memory fallback:",
      error.message,
    );
    const newEvent = { id: generateId(), ...event };
    mutateFallbackStore((store) => {
      if (event.isActive) {
        store.events = store.events.map((entry) => ({
          ...entry,
          isActive: false,
        }));
      }
      store.events.push(newEvent);
      return store;
    });
    await invalidateDataCaches();
    res.status(201).json(newEvent);
  }
};

const updateEvent = async (req, res) => {
  const { id } = req.params;
  const updates = {
    name: normalizeString(req.body.name),
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    startDate: normalizeString(req.body.startDate),
    endDate: normalizeString(req.body.endDate),
    isActive:
      req.body.isActive === undefined ? undefined : Boolean(req.body.isActive),
  };

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const eventRef = db.collection("events").doc(id);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found." });
    }

    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );

    await eventRef.update(payload);

    if (payload.isActive) {
      const snapshot = await db
        .collection("events")
        .where("isActive", "==", true)
        .get();
      const batch = db.batch();
      snapshot.docs
        .filter((doc) => doc.id !== id)
        .forEach((doc) => batch.update(doc.ref, { isActive: false }));
      await batch.commit();
    }

    await invalidateDataCaches(id);
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updateEvent, using memory fallback:",
      error.message,
    );
    let updated = false;
    mutateFallbackStore((store) => {
      const index = store.events.findIndex((event) => event.id === id);
      if (index === -1) return store;
      const nextEvent = {
        ...store.events[index],
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.state ? { state: updates.state } : {}),
        ...(updates.district ? { district: updates.district } : {}),
        ...(updates.startDate ? { startDate: updates.startDate } : {}),
        ...(updates.endDate ? { endDate: updates.endDate } : {}),
        ...(updates.isActive === undefined
          ? {}
          : { isActive: updates.isActive }),
      };
      store.events[index] = nextEvent;
      updated = true;
      if (nextEvent.isActive) {
        store.events = store.events.map((event) => ({
          ...event,
          isActive: event.id === id,
        }));
      }
      return store;
    });
    if (!updated) return res.status(404).json({ error: "Event not found." });
    await invalidateDataCaches(id);
    res.json({ success: true });
  }
};

const deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const eventRef = db.collection("events").doc(id);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found." });
    }

    const [teamsSnapshot, playersSnapshot, matchesSnapshot] = await Promise.all(
      [
        db.collection("teams").where("eventId", "==", id).get(),
        db.collection("players").where("eventId", "==", id).get(),
        db.collection("matches").where("eventId", "==", id).get(),
      ],
    );

    await Promise.all([
      ...teamsSnapshot.docs.map((doc) =>
        deleteCloudinaryAssetsFromRecord(doc.data(), [
          "logoUrl",
          "imageUrl",
          "photoUrl",
        ]),
      ),
      ...playersSnapshot.docs.map((doc) =>
        deleteCloudinaryAssetsFromRecord(doc.data(), [
          "photoUrl",
          "aadharFrontUrl",
          "aadharBackUrl",
        ]),
      ),
    ]);

    const batch = db.batch();
    teamsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    playersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    matchesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(eventRef);
    await batch.commit();

    await invalidateDataCaches(id);

    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deleteEvent, using memory fallback:",
      error.message,
    );
    let deleted = false;
    mutateFallbackStore((store) => {
      const exists = store.events.some((event) => event.id === id);
      if (!exists) return store;
      store.events = store.events.filter((event) => event.id !== id);
      store.teams = store.teams.filter((team) => team.eventId !== id);
      store.players = store.players.filter((player) => player.eventId !== id);
      store.matches = store.matches.filter((match) => match.eventId !== id);
      deleted = true;
      return store;
    });
    if (!deleted) return res.status(404).json({ error: "Event not found." });
    await invalidateDataCaches(id);
    res.json({ success: true });
  }
};

const activateEvent = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const snapshot = await db
      .collection("events")
      .where("isActive", "==", true)
      .get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { isActive: false }));
    batch.update(db.collection("events").doc(id), { isActive: true });
    await batch.commit();
    await invalidateDataCaches();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in activateEvent, using memory fallback:",
      error.message,
    );
    mutateFallbackStore((store) => {
      store.events = store.events.map((event) => ({
        ...event,
        isActive: event.id === id,
      }));
      return store;
    });
    await invalidateDataCaches();
    res.json({ success: true });
  }
};

// Teams
const getTeams = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  const cacheKey = makeKey("teams", eventId || "all");
  const teams = await readOrFetch({
    cacheKey,
    ttl: 30,
    firestoreFetch: async () => {
      if (!db) throw new Error("Database not initialized");
      let query = db.collection("teams");
      if (eventId) query = query.where("eventId", "==", eventId);
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    fallback: async () => {
      memoryDB = readFallbackStore();
      return eventId
        ? memoryDB.teams.filter((team) => team.eventId === eventId)
        : memoryDB.teams;
    },
  });

  res.json(teams);
};

const addTeam = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId)
    return res.status(400).json({ error: "Event selection is required." });

  const team = {
    name: normalizeString(req.body.name),
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    coach: normalizeString(req.body.coach),
    eventId,
    createdAt: new Date().toISOString(),
  };

  if (!team.name || !team.state || !team.district || !team.coach) {
    return res
      .status(400)
      .json({ error: "Name, state, district, and coach are required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists)
      return res.status(400).json({ error: "Selected event does not exist." });
    const docRef = await db.collection("teams").add(team);
    await invalidateDataCaches(eventId);
    res.status(201).json({ id: docRef.id, ...team });
  } catch (error) {
    console.error(
      "Firestore Error in addTeam, using memory fallback:",
      error.message,
    );
    if (!ensureEventInMemory(eventId)) {
      return res.status(400).json({ error: "Selected event does not exist." });
    }
    const newTeam = { id: generateId(), ...team };
    mutateFallbackStore((store) => {
      store.teams.push(newTeam);
      return store;
    });
    await invalidateDataCaches(eventId);
    res.status(201).json(newTeam);
  }
};

const updateTeam = async (req, res) => {
  const { id } = req.params;
  const updates = {
    name: normalizeString(req.body.name),
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    coach: normalizeString(req.body.coach),
  };

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const teamRef = db.collection("teams").doc(id);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: "Team not found." });
    }
    await teamRef.update(updates);
    await invalidateDataCaches();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updateTeam, using memory fallback:",
      error.message,
    );
    let updated = false;
    mutateFallbackStore((store) => {
      const index = store.teams.findIndex((team) => team.id === id);
      if (index === -1) return store;
      store.teams[index] = { ...store.teams[index], ...updates };
      updated = true;
      return store;
    });
    if (!updated) return res.status(404).json({ error: "Team not found." });
    await invalidateDataCaches();
    res.json({ success: true });
  }
};

const deleteTeam = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const teamRef = db.collection("teams").doc(id);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: "Team not found." });
    }

    const [playersSnapshot, matchesSnapshot] = await Promise.all([
      db.collection("players").where("teamId", "==", id).get(),
      db.collection("matches").where("teamIds", "array-contains", id).get(),
    ]);

    await Promise.all([
      deleteCloudinaryAssetsFromRecord(teamDoc.data(), ["logoUrl", "imageUrl"]),
      ...playersSnapshot.docs.map((doc) =>
        deleteCloudinaryAssetsFromRecord(doc.data(), [
          "photoUrl",
          "aadharFrontUrl",
          "aadharBackUrl",
        ]),
      ),
    ]);

    const batch = db.batch();
    playersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    matchesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(teamRef);
    await batch.commit();

    await invalidateDataCaches();

    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deleteTeam, using memory fallback:",
      error.message,
    );
    let deleted = false;
    mutateFallbackStore((store) => {
      const exists = store.teams.some((team) => team.id === id);
      if (!exists) return store;
      store.teams = store.teams.filter((team) => team.id !== id);
      store.players = store.players.filter((player) => player.teamId !== id);
      store.matches = store.matches.filter(
        (match) => ![match.teamAId, match.teamBId].includes(id),
      );
      deleted = true;
      return store;
    });
    if (!deleted) return res.status(404).json({ error: "Team not found." });
    await invalidateDataCaches();
    res.json({ success: true });
  }
};

// Players
const getPlayers = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  const cacheKey = makeKey("players", eventId || "all");
  const players = await readOrFetch({
    cacheKey,
    ttl: 30,
    firestoreFetch: async () => {
      if (!db) throw new Error("Database not initialized");
      let query = db.collection("players");
      if (eventId) query = query.where("eventId", "==", eventId);
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    fallback: async () => {
      memoryDB = readFallbackStore();
      return eventId
        ? memoryDB.players.filter((player) => player.eventId === eventId)
        : memoryDB.players;
    },
  });

  res.json(players);
};

const addPlayer = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId)
    return res.status(400).json({ error: "Event selection is required." });

  const player = {
    name: normalizeString(req.body.name),
    fatherName: normalizeString(req.body.fatherName),
    email: normalizeString(req.body.email).toLowerCase(),
    phone: normalizePhone(req.body.phone),
    age: Number(req.body.age),
    weight: Number(req.body.weight),
    position: normalizeString(req.body.position),
    teamId: normalizeString(req.body.teamId),
    district: normalizeString(req.body.district),
    state: normalizeString(req.body.state),
    dob: normalizeString(req.body.dob),
    aadhar: normalizeString(req.body.aadhar),
    aadharFrontUrl: normalizeString(req.body.aadharFrontUrl),
    aadharBackUrl: normalizeString(req.body.aadharBackUrl),
    photoUrl: normalizeString(req.body.photoUrl),
    photoPublicId: normalizeString(req.body.photoPublicId),
    eventId,
    createdAt: new Date().toISOString(),
  };

  if (!player.name || !player.teamId || !player.position || !player.photoUrl) {
    return res.status(400).json({ error: "Missing required player fields." });
  }

  if (!player.email || !/^\S+@\S+\.\S+$/.test(player.email)) {
    return res
      .status(400)
      .json({ error: "A valid email address is required." });
  }

  if (!/^\d{10}$/.test(player.phone)) {
    return res
      .status(400)
      .json({ error: "A valid 10-digit phone number is required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const teamDoc = await db.collection("teams").doc(player.teamId).get();
    if (!teamDoc.exists || teamDoc.data().eventId !== eventId) {
      return res
        .status(400)
        .json({ error: "Selected team is not part of this event." });
    }
    const docRef = await db.collection("players").add(player);
    await invalidateDataCaches(eventId);
    res.status(201).json({ id: docRef.id, ...player });
  } catch (error) {
    console.error(
      "Firestore Error in addPlayer, using memory fallback:",
      error.message,
    );
    const team = memoryDB.teams.find(
      (entry) => entry.id === player.teamId && entry.eventId === eventId,
    );
    if (!team)
      return res
        .status(400)
        .json({ error: "Selected team is not part of this event." });
    const newPlayer = { id: generateId(), ...player };
    mutateFallbackStore((store) => {
      store.players.push(newPlayer);
      return store;
    });
    await invalidateDataCaches(eventId);
    res.status(201).json(newPlayer);
  }
};

const updatePlayer = async (req, res) => {
  const { id } = req.params;
  const updates = {
    name: normalizeString(req.body.name),
    fatherName: normalizeString(req.body.fatherName),
    email: normalizeString(req.body.email).toLowerCase(),
    phone: normalizePhone(req.body.phone),
    age: req.body.age === undefined ? undefined : Number(req.body.age),
    weight: req.body.weight === undefined ? undefined : Number(req.body.weight),
    position: normalizeString(req.body.position),
    teamId: normalizeString(req.body.teamId),
    district: normalizeString(req.body.district),
    state: normalizeString(req.body.state),
    dob: normalizeString(req.body.dob),
    aadhar: normalizeString(req.body.aadhar),
    aadharFrontUrl: normalizeString(req.body.aadharFrontUrl),
    aadharBackUrl: normalizeString(req.body.aadharBackUrl),
    photoUrl: normalizeString(req.body.photoUrl),
    photoPublicId: normalizeString(req.body.photoPublicId),
  };

  if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email)) {
    return res
      .status(400)
      .json({ error: "A valid email address is required." });
  }
  if (updates.phone && !/^\d{10}$/.test(updates.phone)) {
    return res
      .status(400)
      .json({ error: "A valid 10-digit phone number is required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const playerRef = db.collection("players").doc(id);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      return res.status(404).json({ error: "Player not found." });
    }
    const payload = Object.fromEntries(
      Object.entries(updates).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    );
    await playerRef.update(payload);
    await deleteCloudinaryAssetsFromRecord(playerDoc.data(), [
      ...(payload.photoUrl !== undefined &&
      payload.photoUrl !== playerDoc.data()?.photoUrl
        ? ["photoUrl"]
        : []),
      ...(payload.photoPublicId !== undefined &&
      payload.photoPublicId !== playerDoc.data()?.photoPublicId
        ? ["photoPublicId"]
        : []),
      ...(payload.aadharFrontUrl !== undefined &&
      payload.aadharFrontUrl !== playerDoc.data()?.aadharFrontUrl
        ? ["aadharFrontUrl"]
        : []),
      ...(payload.aadharBackUrl !== undefined &&
      payload.aadharBackUrl !== playerDoc.data()?.aadharBackUrl
        ? ["aadharBackUrl"]
        : []),
    ]);
    await invalidateDataCaches();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updatePlayer, using memory fallback:",
      error.message,
    );
    let updated = false;
    mutateFallbackStore((store) => {
      const index = store.players.findIndex((player) => player.id === id);
      if (index === -1) return store;
      store.players[index] = { ...store.players[index], ...updates };
      updated = true;
      return store;
    });
    if (!updated) return res.status(404).json({ error: "Player not found." });
    await invalidateDataCaches();
    res.json({ success: true });
  }
};

const deletePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const playerRef = db.collection("players").doc(id);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      return res.status(404).json({ error: "Player not found." });
    }
    await deleteCloudinaryAssetsFromRecord(playerDoc.data(), [
      "photoUrl",
      "photoPublicId",
      "aadharFrontUrl",
      "aadharBackUrl",
    ]);
    await playerRef.delete();
    await invalidateDataCaches();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deletePlayer, using memory fallback:",
      error.message,
    );
    const before = memoryDB.players.length;
    mutateFallbackStore((store) => {
      store.players = store.players.filter((player) => player.id !== id);
      return store;
    });
    await invalidateDataCaches();
    res.json({ success: before !== memoryDB.players.length });
  }
};

const deletePlayersBulk = async (req, res) => {
  const eventId = normalizeString(req.query.eventId || req.body.eventId);
  const teamId = normalizeString(req.query.teamId || req.body.teamId);

  if (!eventId) {
    return res.status(400).json({ error: "Event selection is required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");

    let query = db.collection("players").where("eventId", "==", eventId);
    if (teamId) {
      query = query.where("teamId", "==", teamId);
    }

    const snapshot = await query.get();

    await Promise.all(
      snapshot.docs.map((doc) =>
        deleteCloudinaryAssetsFromRecord(doc.data(), [
          "photoUrl",
          "photoPublicId",
          "aadharFrontUrl",
          "aadharBackUrl",
        ]),
      ),
    );

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    await invalidateDataCaches(eventId);
    res.json({ success: true, deletedCount: snapshot.size });
  } catch (error) {
    console.error(
      "Firestore Error in deletePlayersBulk, using memory fallback:",
      error.message,
    );

    let deletedCount = 0;
    mutateFallbackStore((store) => {
      const before = store.players.length;
      store.players = store.players.filter((player) => {
        if (player.eventId !== eventId) return true;
        if (teamId && player.teamId !== teamId) return true;
        return false;
      });
      deletedCount = before - store.players.length;
      return store;
    });

    await invalidateDataCaches(eventId);
    res.json({ success: true, deletedCount });
  }
};

const MATCH_HALF_DURATION = 1200;

const normalizeRoundKey = (roundValue) =>
  normalizeString(roundValue || "League").toLowerCase();

const getMatchOutcome = (match) => {
  const scoreA = Number(match?.scoreA || 0);
  const scoreB = Number(match?.scoreB || 0);
  if (!match?.teamAId || !match?.teamBId) return null;

  if (match.teamBName === "BYE") {
    return {
      winnerTeamId: match.teamAId,
      winnerTeamName: match.teamAName,
      loserTeamId: match.teamBId || "",
      loserTeamName: match.teamBName || "BYE",
      resultMargin: scoreA,
    };
  }

  if (scoreA === scoreB) {
    return {
      winnerTeamId: match.teamAId,
      winnerTeamName: match.teamAName,
      loserTeamId: match.teamBId,
      loserTeamName: match.teamBName,
      resultMargin: 0,
    };
  }

  const isATop = scoreA > scoreB;
  return {
    winnerTeamId: isATop ? match.teamAId : match.teamBId,
    winnerTeamName: isATop ? match.teamAName : match.teamBName,
    loserTeamId: isATop ? match.teamBId : match.teamAId,
    loserTeamName: isATop ? match.teamBName : match.teamAName,
    resultMargin: Math.abs(scoreA - scoreB),
  };
};

const getNextRoundLabel = (currentRound) => {
  const label = normalizeString(currentRound || "League");
  if (normalizeRoundKey(label) === "league") return "Knockout Round 1";
  const roundMatch = label.match(/round\s*(\d+)/i);
  if (!roundMatch) return "Round 2";
  return `Round ${Number(roundMatch[1]) + 1}`;
};

const buildRoundFixturesFromWinners = (winners, context) => {
  const pairings = [];
  for (let i = 0; i < winners.length; i += 2) {
    const teamA = winners[i];
    const teamB = winners[i + 1];
    if (!teamA) continue;

    if (!teamB) {
      pairings.push({
        id: `match_${context.round}_${i}_${Date.now()}`,
        teamAId: teamA.id,
        teamBId: "",
        teamAName: teamA.name,
        teamBName: "BYE",
        pool: teamA.pool || "Winners",
        round: context.round,
        status: "finished",
        scoreA: 0,
        scoreB: 0,
        half: 2,
        timer: 0,
        timerAtStart: MATCH_HALF_DURATION,
        timerLastStartedAt: null,
        events: [],
        tournamentMode: context.mode,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    pairings.push({
      id: `match_${context.round}_${i}_${Date.now()}`,
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      pool: teamA.pool || teamB.pool || "Winners",
      round: context.round,
      status: "scheduled",
      scoreA: 0,
      scoreB: 0,
      half: 1,
      timer: MATCH_HALF_DURATION,
      timerAtStart: MATCH_HALF_DURATION,
      timerLastStartedAt: null,
      events: [],
      tournamentMode: context.mode,
      createdAt: new Date().toISOString(),
    });
  }

  return pairings;
};

const advanceTournamentIfReady = async (eventId, currentRound, mode) => {
  const roundKey = normalizeRoundKey(currentRound);
  const tournamentMode = normalizeString(mode || "league").toLowerCase();
  const loadMatches = async () => {
    if (db) {
      const snapshot = await db
        .collection("matches")
        .where("eventId", "==", eventId)
        .get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    memoryDB = readFallbackStore();
    return memoryDB.matches.filter((match) => match.eventId === eventId);
  };

  const allMatches = await loadMatches();
  const currentRoundMatches = allMatches.filter(
    (match) => normalizeRoundKey(match.round) === roundKey,
  );

  if (!currentRoundMatches.length) return;
  if (
    currentRoundMatches.some(
      (match) => normalizeString(match.status) !== "finished",
    )
  ) {
    return;
  }

  const winners = currentRoundMatches
    .map((match) => {
      const outcome = getMatchOutcome(match);
      if (!outcome) return null;
      return {
        id: outcome.winnerTeamId,
        name: outcome.winnerTeamName,
        pool: match.pool || "Winners",
      };
    })
    .filter(Boolean);

  if (winners.length < 2) return;

  const nextRound = getNextRoundLabel(currentRound);
  if (
    allMatches.some(
      (match) =>
        normalizeRoundKey(match.round) === normalizeRoundKey(nextRound),
    )
  ) {
    return;
  }

  const nextFixtures = buildRoundFixturesFromWinners(winners, {
    eventId,
    round: nextRound,
    mode: tournamentMode,
  });

  if (db) {
    const batch = db.batch();
    nextFixtures.forEach((fixture) => {
      batch.set(db.collection("matches").doc(fixture.id), {
        ...fixture,
        eventId,
      });
    });
    await batch.commit();
  } else {
    mutateFallbackStore((store) => {
      store.matches.push(
        ...nextFixtures.map((fixture) => ({
          ...fixture,
          eventId,
        })),
      );
      return store;
    });
  }

  await invalidateDataCaches(eventId);
};

// Matches
const generateFixtures = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId)
    return res.status(400).json({ error: "Event selection is required." });
  const tournamentMode = normalizeString(
    req.body.mode || "league",
  ).toLowerCase();

  let inputTeams = Array.isArray(req.body.teams) ? req.body.teams : [];
  if (!inputTeams.length) {
    inputTeams = memoryDB.teams.filter((team) => team.eventId === eventId);
  }

  if (inputTeams.length < 2) {
    return res
      .status(400)
      .json({ error: "At least 2 teams are required to generate fixtures." });
  }

  const numPools = parseInt(req.body.numPools) || 4;

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    if (!Array.isArray(req.body.teams) || !req.body.teams.length) {
      const snapshot = await db
        .collection("teams")
        .where("eventId", "==", eventId)
        .get();
      inputTeams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    const { pools, fixtures } = genFix(inputTeams, numPools, tournamentMode);
    const createdAt = new Date().toISOString();
    const payload = fixtures.map((fixture) => ({
      ...fixture,
      eventId,
      tournamentMode,
      createdAt,
    }));

    const existingSnapshot = await db
      .collection("matches")
      .where("eventId", "==", eventId)
      .get();

    const batch = db.batch();
    existingSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    payload.forEach((fixture) => {
      const ref = db.collection("matches").doc(fixture.id);
      batch.set(ref, fixture);
    });

    await batch.commit();
    await invalidateDataCaches(eventId);
    res.json({ pools, fixtures: payload });
  } catch (error) {
    console.error(
      "Firestore Error in generateFixtures, using memory fallback:",
      error.message,
    );
    const { pools, fixtures } = genFix(inputTeams, numPools, tournamentMode);
    const payload = fixtures.map((fixture) => ({
      ...fixture,
      eventId,
      tournamentMode,
      createdAt: new Date().toISOString(),
    }));
    mutateFallbackStore((store) => {
      store.matches = store.matches.filter(
        (match) => match.eventId !== eventId,
      );
      store.matches.push(...payload);
      return store;
    });
    await invalidateDataCaches(eventId);
    res.json({ pools, fixtures: payload });
  }
};

const deleteAllFixtures = async (req, res) => {
  const eventId = normalizeString(req.query.eventId || req.body.eventId);
  if (!eventId) {
    return res.status(400).json({ error: "Event selection is required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const snapshot = await db
      .collection("matches")
      .where("eventId", "==", eventId)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    await invalidateDataCaches(eventId);
    res.json({ success: true, deletedCount: snapshot.size });
  } catch (error) {
    console.error(
      "Firestore Error in deleteAllFixtures, using memory fallback:",
      error.message,
    );
    let deletedCount = 0;
    mutateFallbackStore((store) => {
      const before = store.matches.length;
      store.matches = store.matches.filter(
        (match) => match.eventId !== eventId,
      );
      deletedCount = before - store.matches.length;
      return store;
    });
    await invalidateDataCaches(eventId);
    res.json({ success: true, deletedCount });
  }
};

const rearrangeFixtures = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId) {
    return res.status(400).json({ error: "Event selection is required." });
  }

  const numPools = parseInt(req.body.numPools) || 4;
  const tournamentMode = normalizeString(
    req.body.mode || "league",
  ).toLowerCase();
  let inputTeams = [];

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const snapshot = await db
      .collection("teams")
      .where("eventId", "==", eventId)
      .get();
    inputTeams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (inputTeams.length < 2) {
      return res.status(400).json({
        error: "At least 2 teams are required to rearrange fixtures.",
      });
    }

    const { pools, fixtures } = genFix(inputTeams, numPools, tournamentMode);
    const createdAt = new Date().toISOString();
    const payload = fixtures.map((fixture) => ({
      ...fixture,
      eventId,
      tournamentMode,
      createdAt,
    }));

    const existingSnapshot = await db
      .collection("matches")
      .where("eventId", "==", eventId)
      .get();

    const batch = db.batch();
    existingSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    payload.forEach((fixture) => {
      const ref = db.collection("matches").doc(fixture.id);
      batch.set(ref, fixture);
    });
    await batch.commit();

    await invalidateDataCaches(eventId);
    res.json({ pools, fixtures: payload });
  } catch (error) {
    console.error(
      "Firestore Error in rearrangeFixtures, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    inputTeams = memoryDB.teams.filter((team) => team.eventId === eventId);

    if (inputTeams.length < 2) {
      return res.status(400).json({
        error: "At least 2 teams are required to rearrange fixtures.",
      });
    }

    const { pools, fixtures } = genFix(inputTeams, numPools, tournamentMode);
    const payload = fixtures.map((fixture) => ({
      ...fixture,
      eventId,
      tournamentMode,
      createdAt: new Date().toISOString(),
    }));

    mutateFallbackStore((store) => {
      store.matches = store.matches.filter(
        (match) => match.eventId !== eventId,
      );
      store.matches.push(...payload);
      return store;
    });

    await invalidateDataCaches(eventId);
    res.json({ pools, fixtures: payload });
  }
};

const getMatches = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  const status = normalizeString(req.query.status).toLowerCase();
  const mode = normalizeString(req.query.mode).toLowerCase();
  const cacheKey = makeKey("matches", eventId || "all");
  let matches = await readOrFetch({
    cacheKey,
    ttl: 30,
    firestoreFetch: async () => {
      if (!db) throw new Error("Database not initialized");
      let query = db.collection("matches");
      if (eventId) query = query.where("eventId", "==", eventId);
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    fallback: async () => {
      memoryDB = readFallbackStore();
      return eventId
        ? memoryDB.matches.filter((match) => match.eventId === eventId)
        : memoryDB.matches;
    },
  });

  if (status) {
    matches = matches.filter(
      (match) => normalizeString(match.status).toLowerCase() === status,
    );
  }

  if (mode) {
    matches = matches.filter(
      (match) =>
        normalizeString(match.tournamentMode || "league").toLowerCase() ===
        mode,
    );
  }

  res.json(matches);
};

const updateMatch = async (req, res) => {
  const { id } = req.params;
  const payload = {
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const matchRef = db.collection("matches").doc(id);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return res.status(404).json({ error: "Match not found." });
    }

    const merged = { id: matchDoc.id, ...matchDoc.data(), ...payload };
    if (normalizeString(merged.status) === "finished") {
      const outcome = getMatchOutcome(merged);
      if (outcome) {
        merged.winnerTeamId = outcome.winnerTeamId;
        merged.winnerTeamName = outcome.winnerTeamName;
        merged.loserTeamId = outcome.loserTeamId;
        merged.loserTeamName = outcome.loserTeamName;
        merged.resultMargin = outcome.resultMargin;
      }
    }

    await matchRef.update(merged);
    await invalidateDataCaches();

    if (normalizeString(merged.status) === "finished") {
      await advanceTournamentIfReady(
        merged.eventId,
        merged.round,
        merged.tournamentMode,
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updateMatch, using memory fallback:",
      error.message,
    );
    mutateFallbackStore((store) => {
      const index = store.matches.findIndex((match) => match.id === id);
      if (index !== -1) {
        const merged = { ...store.matches[index], ...payload };
        if (normalizeString(merged.status) === "finished") {
          const outcome = getMatchOutcome(merged);
          if (outcome) {
            merged.winnerTeamId = outcome.winnerTeamId;
            merged.winnerTeamName = outcome.winnerTeamName;
            merged.loserTeamId = outcome.loserTeamId;
            merged.loserTeamName = outcome.loserTeamName;
            merged.resultMargin = outcome.resultMargin;
          }
        }
        store.matches[index] = merged;
      }
      return store;
    });
    await invalidateDataCaches();

    const updatedMatch = memoryDB.matches.find((match) => match.id === id);
    if (normalizeString(updatedMatch?.status) === "finished") {
      await advanceTournamentIfReady(
        updatedMatch.eventId,
        updatedMatch.round,
        updatedMatch.tournamentMode,
      );
    }

    res.json({ success: true });
  }
};

const deleteMatch = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const matchRef = db.collection("matches").doc(id);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return res.status(404).json({ error: "Match not found." });
    }
    await matchRef.delete();
    await invalidateDataCaches();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deleteMatch, using memory fallback:",
      error.message,
    );
    let deleted = false;
    mutateFallbackStore((store) => {
      const exists = store.matches.some((match) => match.id === id);
      if (!exists) return store;
      store.matches = store.matches.filter((match) => match.id !== id);
      deleted = true;
      return store;
    });
    if (!deleted) return res.status(404).json({ error: "Match not found." });
    await invalidateDataCaches();
    res.json({ success: true });
  }
};

const getLiveMatch = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  const cacheKey = makeKey("live", eventId || "all");
  const liveMatch = await readOrFetch({
    cacheKey,
    ttl: 15,
    firestoreFetch: async () => {
      if (!db) throw new Error("Database not initialized");
      let query = db.collection("matches").orderBy("createdAt", "desc");
      if (eventId) query = query.where("eventId", "==", eventId);
      const snapshot = await query.limit(1).get();
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    fallback: async () => {
      memoryDB = readFallbackStore();
      const matches = eventId
        ? memoryDB.matches.filter((match) => match.eventId === eventId)
        : memoryDB.matches;
      if (!matches.length) return null;
      return matches[matches.length - 1];
    },
  });

  if (!liveMatch)
    return res.status(404).json({ error: "No matches available" });
  res.json(liveMatch);
};

const getScoreboardFeed = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  const matchId = normalizeString(req.query.matchId);

  if (!eventId && !matchId) {
    return res
      .status(400)
      .json({ error: "eventId or matchId is required for scoreboard feed." });
  }

  try {
    let matches = [];

    if (!db) throw new Error("Database not initialized");

    if (matchId) {
      const doc = await db.collection("matches").doc(matchId).get();
      if (doc.exists) matches = [{ id: doc.id, ...doc.data() }];
    } else {
      const snapshot = await db
        .collection("matches")
        .where("eventId", "==", eventId)
        .get();
      matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    if (!matches.length) {
      return res
        .status(404)
        .json({ error: "No matches found for scoreboard." });
    }

    const ordered = [...matches].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );
    const liveMatch =
      ordered.find((match) => match.status === "live") || ordered[0];

    const payload = {
      generatedAt: new Date().toISOString(),
      eventId: liveMatch.eventId || eventId || "",
      match: {
        id: liveMatch.id,
        teamAId: liveMatch.teamAId || "",
        teamAName: liveMatch.teamAName || "",
        teamBId: liveMatch.teamBId || "",
        teamBName: liveMatch.teamBName || "",
        scoreA: Number(liveMatch.scoreA || 0),
        scoreB: Number(liveMatch.scoreB || 0),
        status: normalizeString(liveMatch.status || "scheduled"),
        timer: Number(liveMatch.timer || 0),
        timerActive: Boolean(liveMatch.timerActive),
        timerLastStartedAt: liveMatch.timerLastStartedAt || null,
        timerAtStart: liveMatch.timerAtStart || null,
        pool: liveMatch.pool || "",
        round: liveMatch.round || "",
        tournamentMode: normalizeString(liveMatch.tournamentMode || "league"),
        events: Array.isArray(liveMatch.events) ? liveMatch.events : [],
        updatedAt: liveMatch.updatedAt || liveMatch.createdAt || null,
      },
    };

    res.json(payload);
  } catch (error) {
    console.error(
      "Firestore Error in getScoreboardFeed, using memory fallback:",
      error.message,
    );

    memoryDB = readFallbackStore();
    const matches = matchId
      ? memoryDB.matches.filter((match) => match.id === matchId)
      : memoryDB.matches.filter((match) => match.eventId === eventId);

    if (!matches.length) {
      return res
        .status(404)
        .json({ error: "No matches found for scoreboard." });
    }

    const ordered = [...matches].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );
    const liveMatch =
      ordered.find((match) => match.status === "live") || ordered[0];

    res.json({
      generatedAt: new Date().toISOString(),
      eventId: liveMatch.eventId || eventId || "",
      match: {
        id: liveMatch.id,
        teamAId: liveMatch.teamAId || "",
        teamAName: liveMatch.teamAName || "",
        teamBId: liveMatch.teamBId || "",
        teamBName: liveMatch.teamBName || "",
        scoreA: Number(liveMatch.scoreA || 0),
        scoreB: Number(liveMatch.scoreB || 0),
        status: normalizeString(liveMatch.status || "scheduled"),
        timer: Number(liveMatch.timer || 0),
        timerActive: Boolean(liveMatch.timerActive),
        timerLastStartedAt: liveMatch.timerLastStartedAt || null,
        timerAtStart: liveMatch.timerAtStart || null,
        pool: liveMatch.pool || "",
        round: liveMatch.round || "",
        tournamentMode: normalizeString(liveMatch.tournamentMode || "league"),
        events: Array.isArray(liveMatch.events) ? liveMatch.events : [],
        updatedAt: liveMatch.updatedAt || liveMatch.createdAt || null,
      },
    });
  }
};

const getLiveGamesFeed = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  if (!eventId) {
    return res.status(400).json({ error: "eventId is required." });
  }

  try {
    if (!db) throw new Error("Database not initialized");

    const snapshot = await db
      .collection("matches")
      .where("eventId", "==", eventId)
      .where("status", "==", "live")
      .get();

    const matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({
      generatedAt: new Date().toISOString(),
      eventId,
      liveMatches: matches,
    });
  } catch (error) {
    console.error(
      "Firestore Error in getLiveGamesFeed, using memory fallback:",
      error.message,
    );

    memoryDB = readFallbackStore();
    const matches = memoryDB.matches.filter(
      (match) => match.eventId === eventId && match.status === "live",
    );

    res.json({
      generatedAt: new Date().toISOString(),
      eventId,
      liveMatches: matches,
    });
  }
};

// Stats
const getStats = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  const cacheKey = makeKey("stats", eventId || "all");
  const stats = await readOrFetch({
    cacheKey,
    ttl: 30,
    firestoreFetch: async () => {
      if (!db) throw new Error("Database not initialized");

      if (!eventId) {
        const [events, teams, players, matches] = await Promise.all([
          db.collection("events").count().get(),
          db.collection("teams").count().get(),
          db.collection("players").count().get(),
          db.collection("matches").count().get(),
        ]);

        const teamDocs = await db.collection("teams").get();
        const districts = new Set(
          teamDocs.docs.map((doc) => doc.data().district).filter(Boolean),
        );

        return {
          events: events.data().count,
          teams: teams.data().count,
          players: players.data().count,
          matches: matches.data().count,
          districts: districts.size,
        };
      }

      const [teamsSnapshot, playersSnapshot, matchesSnapshot] =
        await Promise.all([
          db.collection("teams").where("eventId", "==", eventId).get(),
          db.collection("players").where("eventId", "==", eventId).get(),
          db.collection("matches").where("eventId", "==", eventId).get(),
        ]);

      const districts = new Set(
        teamsSnapshot.docs.map((doc) => doc.data().district).filter(Boolean),
      );

      return {
        events: 1,
        teams: teamsSnapshot.size,
        players: playersSnapshot.size,
        matches: matchesSnapshot.size,
        districts: districts.size,
      };
    },
    fallback: async () => {
      memoryDB = readFallbackStore();
      const teams = eventId
        ? memoryDB.teams.filter((entry) => entry.eventId === eventId)
        : memoryDB.teams;
      const players = eventId
        ? memoryDB.players.filter((entry) => entry.eventId === eventId)
        : memoryDB.players;
      const matches = eventId
        ? memoryDB.matches.filter((entry) => entry.eventId === eventId)
        : memoryDB.matches;
      const districts = new Set(
        teams.map((entry) => entry.district).filter(Boolean),
      );

      return {
        events: eventId ? 1 : memoryDB.events.length,
        teams: teams.length,
        players: players.length,
        matches: matches.length,
        districts: districts.size,
      };
    },
  });

  res.json(stats);
};

module.exports = {
  getLocationOptions,
  detectLocationFromIp,
  getEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  activateEvent,
  getTeams,
  addTeam,
  updateTeam,
  deleteTeam,
  getPlayers,
  addPlayer,
  updatePlayer,
  deletePlayer,
  deletePlayersBulk,
  generateFixtures,
  deleteAllFixtures,
  rearrangeFixtures,
  getMatches,
  updateMatch,
  deleteMatch,
  getLiveMatch,
  getScoreboardFeed,
  getLiveGamesFeed,
  getStats,
};
