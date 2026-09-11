const express = require("express");
const {
  getSubmissions,
  runCode,
  submitCode,
} = require("../controllers/submissionController");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.get("/", adminOnly, getSubmissions);
router.post("/run", runCode);
router.post("/submit", submitCode);

module.exports = router;
