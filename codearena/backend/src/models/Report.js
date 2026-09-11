const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  interviewSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InterviewSession",
    required: true,
  },
  reportType: {
    type: String,
    default: "Interview Evaluation Report",
  },
  version: {
    type: String,
    default: "2.0",
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reportData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
});

reportSchema.index({ user: 1, interviewSession: 1 });
reportSchema.index({ generatedAt: -1 });

module.exports = mongoose.model("Report", reportSchema);
