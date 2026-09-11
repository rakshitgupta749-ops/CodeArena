const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  preCodeAssessmentTimer: {
    type: Number,
    default: 15 // default in minutes
  },
  codingTestTimer: {
    type: Number,
    default: 60
  },
  interviewTimer: {
    type: Number,
    default: 30
  }
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
