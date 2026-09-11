const express = require("express");
const router = express.Router();
const Setting = require("../models/Setting");

router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({});
    }
    res.json({
      timers: {
        preCodeAssessmentTimer: setting.preCodeAssessmentTimer,
        codingTestTimer: setting.codingTestTimer,
        interviewTimer: setting.interviewTimer,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching settings." });
  }
});

module.exports = router;
