const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, "scores.json");
const MAX_SCORES = 10;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readScores() {
  try {
    return JSON.parse(fs.readFileSync(SCORES_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

// Top scores, highest first
app.get("/api/scores", (req, res) => {
  res.json(readScores());
});

app.post("/api/scores", (req, res) => {
  const { name, score } = req.body || {};

  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return res.status(400).json({ error: "Invalid score" });
  }
  const cleanName = String(name || "Anonymous").trim().slice(0, 20) || "Anonymous";

  const scores = readScores();
  scores.push({ name: cleanName, score: Math.floor(score), date: new Date().toISOString() });
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, MAX_SCORES);
  writeScores(top);

  res.json({ scores: top, madeLeaderboard: top.some((s) => s.score === Math.floor(score) && s.name === cleanName) });
});

app.listen(PORT, () => {
  console.log(`Flappy Gaze running at http://localhost:${PORT}`);
});
