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
  updateUserRole,
  deleteCandidate,
  reactivateCandidate,
  deleteCandidatePermanently,
  updateSettings,
  getAssessmentDashboard,
  getAssessmentCandidates,
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
  updateAssignment,
} = require("../controllers/assignmentController");

// Protect all admin routes with auth and at least faculty level
router.use(auth);
router.use(adminOrFaculty);

// Analytics
router.get("/analytics", getAnalytics);

// Assessment Dashboard & Candidates Detail
router.get("/assessment-dashboard", getAssessmentDashboard);
router.get("/assessments/:id/candidates", getAssessmentCandidates);

// Candidates / Users
router.get("/candidates", getCandidates);
router.post("/candidates", createCandidate);
router.get("/candidates/:id", getCandidateById);
router.patch("/candidates/:id/role", updateUserRole);
router.delete("/candidates/:id", deleteCandidate);
router.patch("/candidates/:id/reactivate", reactivateCandidate);
router.delete("/candidates/:id/permanent", deleteCandidatePermanently);
router.get("/candidates/:id/interviews", getCandidateInterviews);
router.get("/candidates/:id/assignments", getCandidateAssignments);

// Batches (Creation & Management is Admin-Only; Assign to Batch is accessible to Faculty)
router.get("/batches", getBatches);
router.post("/batches", adminOnly, createBatch);
router.get("/batches/:id", adminOnly, getBatchById);
router.put("/batches/:id", adminOnly, updateBatch);
router.delete("/batches/:id", adminOnly, deleteBatch);
router.post("/batches/:id/assign-assessment", assignToBatch);

// Assignments
router.get("/assignments", getAllAssignments);
router.post("/assignments", assignToCandidate);
router.put("/assignments/:id", updateAssignment);
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
