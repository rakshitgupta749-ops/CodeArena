const Problem = require("../models/Problem");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const InterviewSession = require("../models/InterviewSession");
const { executeJava } = require("../services/javaExecutor");

// GET /api/submissions (admin only)
const getSubmissions = async (req, res) => {
  try {
    const { problemId, status } = req.query;
    const query = {};

    if (problemId) query.problem = problemId;
    if (status) query.status = status;

    const submissions = await Submission.find(query).sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyAssignment = async (req, problemId) => {
  if (req.user.role === "admin" || req.user.role === "faculty") return true;

  const assignment = await Assignment.findOne({
    candidate: req.user._id,
    assessment: problemId,
  }).sort({ _id: -1 });

  return !!assignment;
};

const sanitizeResults = (results, problem, role) => {
  if (role === "admin" || role === "faculty") return results;

  let visiblePassed = 0;
  let visibleTotal = 0;
  let hiddenPassed = 0;
  let hiddenTotal = 0;

  const safeResults = results.map((r, i) => {
    const tc = problem.testCases[i];
    const isHidden = tc ? tc.isHidden : false;
    
    if (isHidden) {
      hiddenTotal++;
      if (r.passed) hiddenPassed++;
      return { passed: r.passed, isHidden: true };
    } else {
      visibleTotal++;
      if (r.passed) visiblePassed++;
      return { ...r, isHidden: false };
    }
  });

  return {
    results: safeResults,
    aggregate: {
      visiblePassed,
      visibleTotal,
      hiddenPassed,
      hiddenTotal,
      totalPassed: visiblePassed + hiddenPassed,
      totalTestCases: visibleTotal + hiddenTotal,
    }
  };
};

// POST /api/submissions/run (user — run code without saving)
const runCode = async (req, res) => {
  try {
    const { code, problemId } = req.body;

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const hasAccess = await verifyAssignment(req, problemId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Not assigned to this problem" });
    }

    // Filter out hidden test cases for RUN
    const visibleTestCases = problem.testCases.filter(tc => !tc.isHidden);

    // Run against VISIBLE test cases only
    const result = await executeJava(code, visibleTestCases);
    const sanitized = sanitizeResults(result.results, { testCases: visibleTestCases }, req.user.role);

    res.json({
      status: result.status,
      results: sanitized.results,
      aggregate: sanitized.aggregate,
      executionTime: result.executionTime,
      compileError: result.compileError,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/submissions/submit (user — run all test cases + save)
const submitCode = async (req, res) => {
  try {
    const { code, problemId } = req.body;

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const hasAccess = await verifyAssignment(req, problemId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Not assigned to this problem" });
    }

    // Check if an interview session has already been started or completed
    const session = await InterviewSession.findOne({ user: req.user._id, problem: problemId });
    if (session) {
      return res.status(403).json({ message: "You cannot resubmit code after proceeding to the interview round." });
    }

    const assignment = await Assignment.findOne({
      candidate: req.user._id,
      assessment: problemId,
    }).sort({ _id: -1 });

    if (req.user.role === "user" && assignment.submissionAttempts >= 3) {
      return res.status(403).json({ message: "Maximum submission attempts reached." });
    }

    // Run against all test cases
    const result = await executeJava(code, problem.testCases);

    // Save hidden flag alongside results
    const resultsWithHiddenFlag = result.results.map((r, i) => ({
      ...r,
      isHidden: problem.testCases[i] ? problem.testCases[i].isHidden : false
    }));

    // Save submission (do not delete old submissions)
    const submission = await Submission.create({
      user: req.user._id,
      problem: problemId,
      code,
      language: "Java",
      status: result.status,
      executionTime: result.executionTime,
      testCaseResults: resultsWithHiddenFlag,
    });

    // Populate for response
    await submission.populate("user", "name email");
    await submission.populate("problem", "title");

    // Calculate Coding Score
    const hiddenTests = resultsWithHiddenFlag.filter(r => r.isHidden);
    const visibleTests = resultsWithHiddenFlag.filter(r => !r.isHidden);

    let codingScore = 0;
    if (hiddenTests.length > 0) {
      const passedHidden = hiddenTests.filter(r => r.passed).length;
      codingScore = Math.round((passedHidden / hiddenTests.length) * 100);
    } else if (visibleTests.length > 0) {
      const passedVisible = visibleTests.filter(r => r.passed).length;
      codingScore = Math.round((passedVisible / visibleTests.length) * 100);
    }

    const allHiddenTestsPassed = hiddenTests.length > 0 && hiddenTests.every(r => r.passed);

    // Update assignment tracking
    if (req.user.role === "user") {
      assignment.submissionAttempts += 1;
      
      if (codingScore >= assignment.bestCodingScore) {
        assignment.bestCodingScore = codingScore;
        assignment.bestSubmission = submission._id;
      }

      if (allHiddenTestsPassed || assignment.bestCodingScore >= 50) {
        assignment.codingPassed = true;
      }
      
      if (result.status === "Accepted") {
        assignment.status = "In Progress";
      }

      if (assignment.submissionAttempts >= 3 && !assignment.codingPassed) {
        assignment.status = "Completed";
      }

      await assignment.save();
    }

    // Sanitize what is returned to user
    const sanitized = sanitizeResults(result.results, problem, req.user.role);

    // If candidate, replace submission's testCaseResults with sanitized results
    const submissionResponse = submission.toObject();
    if (req.user.role === "user") {
      submissionResponse.testCaseResults = sanitized.results;
    }

    res.status(201).json({
      submission: submissionResponse,
      status: result.status,
      results: sanitized.results,
      aggregate: sanitized.aggregate,
      executionTime: result.executionTime,
      compileError: result.compileError,
      
      attemptsUsed: assignment.submissionAttempts || 0,
      attemptsRemaining: Math.max(0, 3 - (assignment.submissionAttempts || 0)),
      maxAttempts: 3,
      currentScore: codingScore,
      bestScore: assignment.bestCodingScore || 0,
      bestSubmissionId: assignment.bestSubmission,
      codingPassed: assignment.codingPassed || false,
      allHiddenTestsPassed,
      canProceedToNextRound: assignment.codingPassed || false,
      canContinueCoding: (assignment.submissionAttempts || 0) < 3
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSubmissions, runCode, submitCode };
