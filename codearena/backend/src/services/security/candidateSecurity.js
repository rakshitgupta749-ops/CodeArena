"use strict";

const { spawn } = require("child_process");
const path = require("path");

const PREDICT_SERVER_SCRIPT = path.join(__dirname, "predict_server.py");
const SERVER_PORT = 5005;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}/predict`;

const PYTHON_CMD = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");

let serverProcess = null;
let serverReady = false;
let restartAttempts = 0;
const MAX_RESTARTS = 3;

function startPythonServer() {
  if (serverProcess) return;
  console.log(`[CandidateSecurity] Starting ML inference daemon using '${PYTHON_CMD}'...`);
  serverProcess = spawn(PYTHON_CMD, [PREDICT_SERVER_SCRIPT, "--port", SERVER_PORT]);

  serverProcess.stdout.on("data", (data) => {
    if (data.toString().includes("Server running")) {
      console.log("[CandidateSecurity] ML inference daemon is ready.");
      serverReady = true;
      restartAttempts = 0;
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("[CandidateSecurity] ML daemon error:", data.toString());
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      restartAttempts++;
      if (restartAttempts <= MAX_RESTARTS) {
        console.log(`[CandidateSecurity] ML daemon exited with code ${code}. Restarting (${restartAttempts}/${MAX_RESTARTS}) in 2s...`);
        serverProcess = null;
        serverReady = false;
        setTimeout(startPythonServer, 2000);
      } else {
        console.warn(`[CandidateSecurity] ML daemon failed after ${MAX_RESTARTS} attempts. Running in fallback mode without ML moderation.`);
        serverProcess = null;
        serverReady = false;
      }
    }
  });
}

function cleanupServer() {
  if (serverProcess) {
    console.log("[CandidateSecurity] Shutting down ML daemon...");
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    serverReady = false;
  }
}

// Ensure the child process is killed when the parent Node process exits (e.g. nodemon restart)
process.on("exit", cleanupServer);
process.on("SIGINT", () => { cleanupServer(); process.exit(0); });
process.on("SIGTERM", () => { cleanupServer(); process.exit(0); });
process.on("SIGUSR1", () => { cleanupServer(); process.exit(0); });
process.on("SIGUSR2", () => { cleanupServer(); process.exit(0); });

// Start the daemon when this module loads
startPythonServer();

/**
 * Candidate-input security layer.
 * Analyzes candidate text using the ML moderation model.
 */
async function analyzeCandidateInput(text) {
  if (typeof text !== "string") {
    return {
      label: "invalid",
      confidence: 1.0,
      flags: ["invalid_input"],
    };
  }

  const input = text.trim();

  if (!input) {
    return {
      label: "invalid",
      confidence: 1.0,
      flags: ["empty_input"],
    };
  }


  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const parsed = await response.json();
      return {
        label: parsed.label,
        confidence: parsed.confidence,
        probabilities: parsed.probabilities,
        flags: [],
      };
    }
  } catch (err) {
    console.error("[CandidateSecurity] ML inference fetch failed:", err.message);
  }

  return {
    label: "NORMAL",
    confidence: 1.0,
    flags: [],
  };
}

module.exports = {
  analyzeCandidateInput,
  startPythonServer
};