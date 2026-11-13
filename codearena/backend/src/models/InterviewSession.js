const mongoose = require("mongoose");

const interviewSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Problem",
    required: true,
  },
  preCodeAssessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PreCodeAssessment",
    default: null,
  },
  status: {
    type: String,
    enum: ["generating", "in_progress", "completed", "failed"],
    default: "generating",
  },
  // Generated questions from Agent 2
  questions: [
    {
      qid: String,
      dimension: String,
      difficulty: String,
      question: String,
      rubric: String,
      assessment_angle: String,
      partial_correct_answer: String,
      incorrect_answer: String,
      answer_criteria: mongoose.Schema.Types.Mixed,
      scoring_guide: mongoose.Schema.Types.Mixed,
      concept_tags: [String],
      source_concepts: [String],
      source: String,
      code_anchor: String,
      code_snippet: String,
      code_line_start: Number,
      code_line_end: Number,
      anchor_resolution: String,
      evaluates: String,
    }
  ],
  counts: {
    basic: { type: Number, default: 0 },
    intermediate: { type: Number, default: 0 },
    hard: { type: Number, default: 0 },
  },
  conceptExtraction: mongoose.Schema.Types.Mixed,
  // Shared memory for the adaptive interviewer. Kept as a single document so a
  // resumed session never relies on only the candidate's most recent message.
  interviewState: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  adaptiveLog: [
    {
      qid: String,
      concept: String,
      difficulty: String,
      selectionReason: String,
      timestamp: { type: Date, default: Date.now },
      priorityScore: Number,
      weakState: Boolean,
      masteredState: Boolean
    }
  ],
  candidateProfile: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
},

conceptGraph: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
},

evidenceStore: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
},

analytics: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
},
report: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
},
  // User answers and Agent 1 evaluations
  answers: [
    {
      qid: String,
      answer: String,
      answerType: {
        type: String,
        enum: ["typed", "voice"],
        default: "typed",
      },
      asrMeta: mongoose.Schema.Types.Mixed,
      audioPath: String,
      evaluation: mongoose.Schema.Types.Mixed,
      answeredAt: {
        type: Date,
        default: Date.now,
      }
    }
  ],
  preCodeScore: {
    type: Number,
    default: null,
  },
  preCodePassed: {
    type: Boolean,
    default: false,
  },
  codingScore: {
    type: Number,
    default: null,
  },
  interviewScore: {
    type: Number,
    default: null,
  },
  alignmentScore: {
    type: Number,
    default: null,
  },
  codingPassed: {
    type: Boolean,
    default: false,
  },
  interviewPassed: {
    type: Boolean,
    default: false,
  },
  overallPassed: {
    type: Boolean,
    default: false,
  },
  overallScore: {
    type: Number,
    default: null, // Computed when completed; null means scoring is pending review
  },
  roundScores: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  crossRoundComparison: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  candidateReport: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  feedback: {
    type: String,
    default: "Pending evaluation.",
  },
  grade: {
    type: String,
    default: "Pending",
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
},

reportGenerated: {
    type: Boolean,
    default: false,
},

reportVersion: {
    type: String,
    default: "2.0",
},
});

interviewSessionSchema.index({

    user: 1,

    submission: 1

});

interviewSessionSchema.index({

    status: 1

});

interviewSessionSchema.index({

    startedAt: -1

});

interviewSessionSchema.index({

    completedAt: -1

});
module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
