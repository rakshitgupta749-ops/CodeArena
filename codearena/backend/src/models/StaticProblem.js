const mongoose = require("mongoose");

const staticProblemSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    subTopic: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["Basic", "Intermediate", "Advanced"],
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    expectedAnswer: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaticProblem", staticProblemSchema, "staticproblems");
