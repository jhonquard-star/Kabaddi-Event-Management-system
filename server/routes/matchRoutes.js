const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/matchController");

const { upload, hasCloudinaryConfig } = require("../config/cloudinary");

router.get("/location/options", ctrl.getLocationOptions);
router.get("/location/detect", ctrl.detectLocationFromIp);

router.get("/events", ctrl.getEvents);
router.post("/events", ctrl.addEvent);
router.patch("/events/:id", ctrl.updateEvent);
router.delete("/events/:id", ctrl.deleteEvent);
router.patch("/events/:id/activate", ctrl.activateEvent);

router.get("/teams", ctrl.getTeams);
router.post("/teams", ctrl.addTeam);
router.patch("/teams/:id", ctrl.updateTeam);
router.delete("/teams/:id", ctrl.deleteTeam);
router.get("/players", ctrl.getPlayers);
router.post("/players", ctrl.addPlayer);
router.delete("/players/bulk", ctrl.deletePlayersBulk);
router.patch("/players/:id", ctrl.updatePlayer);
router.delete("/players/:id", ctrl.deletePlayer);
router.get("/", ctrl.getMatches);
router.get("/fixtures", ctrl.getMatches);
router.post("/generate", ctrl.generateFixtures);
router.delete("/fixtures/all", ctrl.deleteAllFixtures);
router.post("/fixtures/rearrange", ctrl.rearrangeFixtures);
router.patch("/:id", ctrl.updateMatch);
router.delete("/:id", ctrl.deleteMatch);
router.get("/live", ctrl.getLiveMatch);
router.get("/scoreboard/feed", ctrl.getScoreboardFeed);
router.get("/scoreboard/live-games", ctrl.getLiveGamesFeed);
router.get("/stats", ctrl.getStats);

// Professional Image Upload
router.post("/upload", upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload failed" });
  const url = hasCloudinaryConfig
    ? req.file.path
    : `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({
    url,
    publicId: hasCloudinaryConfig ? req.file.filename || null : null,
  });
});

module.exports = router;
