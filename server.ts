import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// 🔗 CONFIGURATION
const GITHUB_OWNER = process.env.GITHUB_OWNER || "bsexpressthailand0-commits";
const GITHUB_REPO = process.env.GITHUB_REPO || "bloom-luxe-db";
const GITHUB_PATH = process.env.GITHUB_PATH || "database.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GAS_API_URL = process.env.GAS_API_URL;

const getHeaders = () => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  return headers;
};

// API: Get Database
app.get("/api/database", async (req, res) => {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?t=${Date.now()}`;
  try {
    const response = await fetch(url, { headers: getHeaders() });
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      res.status(response.status).json({ error: "Failed to fetch from GitHub" });
    }
  } catch (e) {
    res.status(500).json({ error: "Network error" });
  }
});

// API: Update Database
app.put("/api/database", async (req, res) => {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(req.body),
    });
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      const err = await response.json();
      res.status(response.status).json({ error: err.message });
    }
  } catch (e) {
    res.status(500).json({ error: "Network error" });
  }
});

// API: Send LINE Notification
app.post("/api/notify", async (req, res) => {
  if (!GAS_API_URL) {
    res.status(503).json({ error: "GAS_API_URL is not configured" });
    return;
  }

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(req.body),
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Create DB file on GitHub if it doesn't exist
app.post("/api/database/init", async (req, res) => {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ message: "Create database.json (Auto Fix)", content: "W10=" }), // "W10=" is "[]" base64
    });
    if (response.ok) {
      res.json({ success: true });
    } else {
      const err = await response.json();
      res.status(response.status).json({ error: err.message });
    }
  } catch (e) {
    res.status(500).json({ error: "Network error" });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
