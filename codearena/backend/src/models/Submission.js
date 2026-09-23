const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Problem",
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: "Java",
  },
  status: {
    type: String,
    enum: [
      "Accepted",
      "Wrong Answer",
      "Runtime Error",
      "Compilation Error",
      "Time Limit Exceeded",
      "System Error",
      "Pending",
    ],
    default: "Pending",
  },
  executionTime: {
    type: String,
    default: "0ms",
  },
  testCaseResults: [
    {
      passed: Boolean,
      input: String,
      expected: String,
      actual: String,
      isHidden: Boolean,
    },
  ],
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

// Populate user and problem names when querying
submissionSchema.pre(/^find/, function () {
  this.populate("user", "name email");
  this.populate("problem", "title");
});

module.exports = mongoose.model("Submission", submissionSchema);
