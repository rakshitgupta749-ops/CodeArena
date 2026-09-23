const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Setting = require("../models/Setting");
const Problem = require("../models/Problem");
const Assignment = require("../models/Assignment");
const User = require("../models/User");

router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({});
    }

    let resolvedPreCodeTimer = setting.preCodeAssessmentTimer ?? 15;
    let resolvedCodingTimer = setting.codingTestTimer ?? 60;
    let resolvedInterviewTimer = setting.interviewTimer ?? 30;
    let resolvedPreCodeQuestions = setting.preCodeMaxQuestions ?? 7;
    let resolvedPostCodeQuestions = setting.postCodeMaxQuestions ?? 10;

    const problemId = req.query.problemId;
    let user = null;

    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      try {
        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id).select("_id role");
      } catch (err) {
        // Token invalid/expired; continue with unauthenticated resolution
      }
    }

    if (problemId) {
      let problem = null;
      try {
        problem = await Problem.findById(problemId);
      } catch (err) {
        // Invalid ObjectId
      }

      // Check problem-level defaults first
      if (problem) {
        if (problem.timeConfig?.preCodeAssessmentTimer) {
          resolvedPreCodeTimer = problem.timeConfig.preCodeAssessmentTimer;
        }
        if (problem.timeConfig?.codingTestTimer) {
          resolvedCodingTimer = problem.timeConfig.codingTestTimer;
        }
        if (problem.timeConfig?.interviewTimer) {
          resolvedInterviewTimer = problem.timeConfig.interviewTimer;
        }
        if (problem.questionsConfig?.preCodeMaxQuestions) {
          resolvedPreCodeQuestions = problem.questionsConfig.preCodeMaxQuestions;
        }
        if (problem.questionsConfig?.postCodeMaxQuestions) {
          resolvedPostCodeQuestions = problem.questionsConfig.postCodeMaxQuestions;
        }
      }

      // If user is candidate, check if they have a specific assignment with overrides
      if (user && problem) {
        const assignment = await Assignment.findOne({
          candidate: user._id,
          assessment: problem._id,
        }).sort({ assignedAt: -1 });

        if (assignment) {
          if (assignment.timeConfig?.preCodeAssessmentTimer) {
            resolvedPreCodeTimer = assignment.timeConfig.preCodeAssessmentTimer;
          }
          if (assignment.timeConfig?.codingTestTimer) {
            resolvedCodingTimer = assignment.timeConfig.codingTestTimer;
          }
          if (assignment.timeConfig?.interviewTimer) {
            resolvedInterviewTimer = assignment.timeConfig.interviewTimer;
          }
          if (assignment.questionsConfig?.preCodeMaxQuestions) {
            resolvedPreCodeQuestions = assignment.questionsConfig.preCodeMaxQuestions;
          }
          if (assignment.questionsConfig?.postCodeMaxQuestions) {
            resolvedPostCodeQuestions = assignment.questionsConfig.postCodeMaxQuestions;
          }
        }
      }
    }

    res.json({
      timers: {
        preCodeAssessmentTimer: resolvedPreCodeTimer,
        codingTestTimer: resolvedCodingTimer,
        interviewTimer: resolvedInterviewTimer,
      },
      preCodeMaxQuestions: resolvedPreCodeQuestions,
      postCodeMaxQuestions: resolvedPostCodeQuestions,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Server error fetching settings." });
  }
});

module.exports = router;
