const express = require("express");

const { auth } = require("../middleware/auth");

const {
  startPreCodeAssessment,
  submitPreCodeAnswer,
  getPreCodeAssessment,
  getPreCodeStatus,
  timeoutPreCodeAssessment,
  terminatePreCodeAssessment,
} = require("../controllers/preCodeController");

const router = express.Router();

// Every pre-code assessment endpoint requires authentication.
router.use(auth);

// Start a new pre-code assessment.
router.post("/start", startPreCodeAssessment);

// Submit the candidate's current answer.
router.post("/:assessmentId/answer", submitPreCodeAnswer);

// Terminate an assessment (e.g. inactivity).
router.post("/:assessmentId/terminate", terminatePreCodeAssessment);

// Timeout an assessment (timer expired).
router.post("/:assessmentId/timeout", timeoutPreCodeAssessment);

// Retrieve the current assessment state.
router.get("/:assessmentId", getPreCodeAssessment);

// Retrieve the status of the assessment for a specific problem.
router.get("/status/:problemId", getPreCodeStatus);

module.exports = router;