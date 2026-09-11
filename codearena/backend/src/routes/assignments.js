const express = require("express");
const { auth } = require("../middleware/auth");
const { getMyAssignments } = require("../controllers/assignmentController");

const router = express.Router();

router.use(auth);

// Get assignments for the currently logged in user
router.get("/me", getMyAssignments);

module.exports = router;
