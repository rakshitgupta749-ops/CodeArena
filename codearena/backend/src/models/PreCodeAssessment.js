const mongoose = require("mongoose");

const preCodeMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["ai", "candidate"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    questionId: {
      type: String,
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const preCodeAssessmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "generating",
        "in_progress",
        "passed",
        "failed",
        "terminated",
      ],
      default: "generating",
      index: true,
    },

    problemType: {
      type: String,
      default: "unknown",
    },

    relevantConcepts: {
      type: [String],
      default: [],
    },

    cacheContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    currentQuestion: {
      type: String,
      default: "",
    },

    currentQuestionId: {
      type: String,
      default: null,
    },

    questionCount: {
      type: Number,
      default: 0,
    },

    meaningfulAnswerCount: {
      type: Number,
      default: 0,
    },

    maxQuestions: {
      type: Number,
      default: 10,
    },

    currentRubric: {
      type: String,
      default: "Understanding of the Problem",
    },

    completedRubrics: {
      type: [String],
      default: [],
    },

    rubricState: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    rubricSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    conversation: {
      type: [preCodeMessageSchema],
      default: [],
    },

    lastEvaluation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    integrityScore: {
      type: Number,
      default: 100,
    },

    warningCount: {
      type: Number,
      default: 0,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

preCodeAssessmentSchema.index({
  user: 1,
  problem: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "PreCodeAssessment",
  preCodeAssessmentSchema
);