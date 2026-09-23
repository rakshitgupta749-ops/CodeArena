const express = require("express");
const {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  toggleProblem,
  deleteProblem,
} = require("../controllers/problemController");
const { auth, adminOrFaculty } = require("../middleware/auth");

const router = express.Router();

// All routes require auth
router.use(auth);

router.get("/", getProblems);
router.get("/:id", getProblem);
router.post("/", adminOrFaculty, createProblem);
router.put("/:id", adminOrFaculty, updateProblem);
router.patch("/:id/toggle", adminOrFaculty, toggleProblem);
router.delete("/:id", adminOrFaculty, deleteProblem);

module.exports = router;
