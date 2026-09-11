const express = require("express");
const {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  toggleProblem,
  deleteProblem,
} = require("../controllers/problemController");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

// All routes require auth
router.use(auth);

router.get("/", getProblems);
router.get("/:id", getProblem);
router.post("/", adminOnly, createProblem);
router.put("/:id", adminOnly, updateProblem);
router.patch("/:id/toggle", adminOnly, toggleProblem);
router.delete("/:id", adminOnly, deleteProblem);

module.exports = router;
