const express = require("express");
const router = express.Router();
const { auth, adminOrFaculty, adminOnly } = require("../middleware/auth");
const {
  getCandidates,
  getCandidateById,
  getCandidateInterviews,
  getInterviews,
  getInterviewById,
  getSettings,
  getReports,
  getReportById,
  getAnalytics,
  createCandidate,
  deleteCandidate,
  updateSettings,
} = require("../controllers/adminController");
const {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} = require("../controllers/batchController");
const {
  assignToCandidate,
  assignToBatch,
  getCandidateAssignments,
  getAllAssignments,
  deleteAssignment,
} = require("../controllers/assignmentController");

// Protect all admin routes with auth and at least faculty level
router.use(auth);
router.use(adminOrFaculty);

// Analytics
router.get("/analytics", getAnalytics);

// Candidates
router.get("/candidates", getCandidates);
router.post("/candidates", createCandidate);
router.get("/candidates/:id", getCandidateById);
router.delete("/candidates/:id", deleteCandidate);
router.get("/candidates/:id/interviews", getCandidateInterviews);
router.get("/candidates/:id/assignments", getCandidateAssignments);

// Batches
router.get("/batches", getBatches);
router.post("/batches", createBatch);
router.get("/batches/:id", getBatchById);
router.put("/batches/:id", updateBatch);
router.delete("/batches/:id", deleteBatch);
router.post("/batches/:id/assign-assessment", assignToBatch);

// Assignments
router.get("/assignments", getAllAssignments);
router.post("/assignments", assignToCandidate);
router.delete("/assignments/:id", deleteAssignment);

// Interviews
router.get("/interviews", getInterviews);
router.get("/interviews/:id", getInterviewById);

// Reports
router.get("/reports", getReports);
router.get("/reports/:id", getReportById);

// Settings (Admin only)
router.get("/settings", adminOnly, getSettings);
router.put("/settings", adminOnly, updateSettings);

module.exports = router;
