const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Problem",
    required: true,
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    default: null,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed"],
    default: "Pending",
  },
  submissionAttempts: {
    type: Number,
    default: 0,
  },
  bestCodingScore: {
    type: Number,
    default: 0,
  },
  bestSubmission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    default: null,
  },
  codingPassed: {
    type: Boolean,
    default: false,
  },
});

// Compound index to prevent duplicate active assignments for the same candidate and assessment
assignmentSchema.index({ assessment: 1, candidate: 1 }, { unique: true, partialFilterExpression: { status: { $ne: "Completed" } } });

module.exports = mongoose.model("Assignment", assignmentSchema);
