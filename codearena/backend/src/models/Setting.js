const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  preCodeAssessmentTimer: {
    type: Number,
    default: 15, // default in minutes
    min: 5,
    max: 60,
  },
  codingTestTimer: {
    type: Number,
    default: 60,
    min: 5,
    max: 60,
  },
  interviewTimer: {
    type: Number,
    default: 30,
    min: 5,
    max: 60,
  },
  preCodeMaxQuestions: {
    type: Number,
    default: 7, // recommended default
    min: 2,
    max: 15,
  },
  postCodeMaxQuestions: {
    type: Number,
    default: 10, // recommended default
    min: 2,
    max: 15,
  },
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
