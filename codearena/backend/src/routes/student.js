const express = require("express");
const { auth } = require("../middleware/auth");
const {
  getDashboardData,
  getStudentAssessments,
  getStudentReports,
  getSystemHealth,
} = require("../controllers/studentController");

const router = express.Router();

router.use(auth);

router.get("/dashboard", getDashboardData);
router.get("/assessments", getStudentAssessments);
router.get("/reports", getStudentReports);
router.get("/system-check", getSystemHealth);

module.exports = router;
