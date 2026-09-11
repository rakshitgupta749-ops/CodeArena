const express = require("express");
const { auth } = require("../middleware/auth");
const {
  VoiceServiceError,
  getVoiceStatus,
  synthesizeSpeech,
} = require("../services/localVoiceService");

const router = express.Router();

router.use(auth);

function audioLimit() {
  const configured = String(process.env.WHISPER_MAX_AUDIO_MB || 25).trim();
  return /^\d+(\.\d+)?$/.test(configured) ? `${configured}mb` : configured;
}

function sendVoiceError(res, err, fallback) {
  const status = err instanceof VoiceServiceError ? err.status : 500;
  const code = err instanceof VoiceServiceError ? err.code : "VOICE_SERVICE_ERROR";

  if (!(err instanceof VoiceServiceError)) {
    console.error("[Voice] Unexpected voice service error:", err);
  } else {
    console.warn(`[Voice] ${code}: ${err.message}${err.details ? ` (${err.details})` : ""}`);
  }

  res.status(status).json({
    message: err.message || "Voice service failed.",
    code,
    fallback,
  });
}

router.get("/status", (req, res) => {
  res.json(getVoiceStatus());
});

router.post("/tts", async (req, res) => {
  try {
    const result = await synthesizeSpeech({ text: req.body?.text });
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.send(result.audio);
  } catch (err) {
    sendVoiceError(res, err, "browser_speech_synthesis");
  }
});

module.exports = router;
