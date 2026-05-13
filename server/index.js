const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const matchRoutes = require("./routes/matchRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const clientOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = clientOrigins.length
  ? {
      origin: clientOrigins,
      credentials: false,
    }
  : undefined;

app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/matches", matchRoutes);

app.get("/", (_req, res) => {
  res.json({
    status: "online",
    message: "Kabaddi managemant system by INDOCREONIX API",
    version: "1.0.0",
  });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Invalid JSON in request body:", err.message);
    return res.status(400).json({ error: "Invalid JSON payload format" });
  }

  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
  console.log(
    `Kabaddi managemant system by INDOCREONIX API is running at http://localhost:${PORT}`,
  );
});
