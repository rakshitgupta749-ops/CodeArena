const express = require("express");
const { auth } = require("../middleware/auth");
const {
  startInterview,
  submitAnswer,
  completeInterview,
  getInterviewSession,
  getSessionStatus,
} = require("../controllers/interviewController");

const router = express.Router();

router.use(auth);

router.post("/start", startInterview);
router.post("/:sessionId/answer", submitAnswer);
router.post("/:sessionId/complete", completeInterview);
router.get("/session-status/:problemId", getSessionStatus);
router.get("/:sessionId", getInterviewSession);

module.exports = router;
