const mongoose = require("mongoose");

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
  },
  { _id: true }
);

const problemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  constraints: {
    type: String,
    default: "",
  },
  sampleInput: {
    type: String,
    default: "",
  },
  sampleOutput: {
    type: String,
    default: "",
  },
  testCases: {
    type: [testCaseSchema],
    default: [],
  },
  boilerplate: {
    type: String,
    default: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your code here
        
        sc.close();
    }
}`,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  timeConfig: {
    preCodeAssessmentTimer: { type: Number, min: 5, max: 60, default: null },
    codingTestTimer: { type: Number, min: 5, max: 60, default: null },
    interviewTimer: { type: Number, min: 5, max: 60, default: null },
  },
  questionsConfig: {
    preCodeMaxQuestions: { type: Number, min: 2, max: 15, default: null },
    postCodeMaxQuestions: { type: Number, min: 2, max: 15, default: null },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for submission count
problemSchema.virtual("submissionCount", {
  ref: "Submission",
  localField: "_id",
  foreignField: "problem",
  count: true,
});

problemSchema.set("toJSON", { virtuals: true });
problemSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Problem", problemSchema);
