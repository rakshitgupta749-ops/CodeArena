const User = require("../models/User");
const InterviewSession = require("../models/InterviewSession");
const bcrypt = require("bcryptjs");
const Report = require("../models/Report");
const AuditLog = require("../models/AuditLog");
const Setting = require("../models/Setting");
const Problem = require("../models/Problem");
const PreCodeAssessment = require("../models/PreCodeAssessment");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const Batch = require("../models/Batch");
const mongoose = require("mongoose");

const logAudit = async (userId, action, resourceType, resourceId, details = {}) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      resourceType,
      resourceId,
      details,
    });
  } catch (err) {
    console.error("[AuditLog Error]", err);
  }
};

const getCandidates = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.role && req.query.role !== "all") {
      query.role = req.query.role === "student" ? "user" : req.query.role;
    } else {
      // Exclude admin role completely from user & candidate management
      query.role = { $in: ["user", "faculty"] };
    }

    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const candidates = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Fetch stats depending on role
    const candidatesWithStats = await Promise.all(
      candidates.map(async (candidate) => {
        if (candidate.role === "faculty") {
          const assessmentsCreated = await Problem.countDocuments({ createdBy: candidate._id });
          const traineesAssigned = (await Assignment.distinct("candidate", { assignedBy: candidate._id })).length;
          return {
            ...candidate.toObject(),
            assessmentsCreated,
            traineesAssigned,
          };
        }

        const latestInterview = await InterviewSession.findOne({ user: candidate._id })
          .sort({ startedAt: -1 })
          .select("status overallScore startedAt completedAt");
        const interviewCount = await InterviewSession.countDocuments({ user: candidate._id });

        return {
          ...candidate.toObject(),
          interviewCount,
          latestInterview,
        };
      })
    );

    res.json({
      candidates: candidatesWithStats,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching candidates." });
  }
};

const createCandidate = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const validRoles = ["admin", "faculty", "user", "student"];
    let assignedRole = "user";
    if (role && validRoles.includes(role)) {
      assignedRole = role === "student" ? "user" : role;
    }

    const candidate = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      isActive: true,
    });

    await logAudit(req.user._id, "created_user", "User", candidate._id, { role: assignedRole });

    // Don't send back password
    const candidateObj = candidate.toObject();
    delete candidateObj.password;

    res.status(201).json(candidateObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error creating user." });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["admin", "faculty", "user", "student"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified." });
    }

    const normalizedRole = role === "student" ? "user" : role;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: normalizedRole },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await logAudit(req.user._id, "updated_user_role", "User", user._id, { newRole: normalizedRole });

    res.json({ message: "User role updated successfully.", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating user role." });
  }
};

const deleteCandidate = async (req, res) => {
  try {
    const candidate = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select("-password");

    if (!candidate) {
      return res.status(404).json({ message: "User not found." });
    }

    await logAudit(req.user._id, "deactivated_user", "User", candidate._id);

    res.json({ message: "User deactivated successfully.", candidate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error deactivating user." });
  }
};

const reactivateCandidate = async (req, res) => {
  try {
    const candidate = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select("-password");

    if (!candidate) {
      return res.status(404).json({ message: "User not found." });
    }

    await logAudit(req.user._id, "reactivated_user", "User", candidate._id);

    res.json({ message: "User reactivated successfully.", candidate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error reactivating user." });
  }
};

const getCandidateById = async (req, res) => {
  try {
    const candidate = await User.findById(req.params.id).select("-password");
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    await logAudit(req.user._id, "viewed_candidate", "User", candidate._id);

    if (candidate.role === "faculty") {
      const assessmentsCreated = await Problem.find({ createdBy: candidate._id })
        .select("title difficulty tags createdAt")
        .sort({ createdAt: -1 });

      const assignmentsCreated = await Assignment.find({ assignedBy: candidate._id })
        .populate("candidate", "name email")
        .populate("assessment", "title difficulty")
        .sort({ assignedAt: -1 });

      const traineesCount = (await Assignment.distinct("candidate", { assignedBy: candidate._id })).length;

      return res.json({
        ...candidate.toObject(),
        assessmentsCreated,
        assignmentsCreated,
        traineesCount,
        assessmentsCount: assessmentsCreated.length,
      });
    }

    const interviewCount = await InterviewSession.countDocuments({ user: candidate._id });
    
    res.json({
      ...candidate.toObject(),
      interviewCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching candidate." });
  }
};

const deleteCandidatePermanently = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const userId = user._id;

    // Cascade delete assignments, submissions, interviews, reports
    await Assignment.deleteMany({ $or: [{ candidate: userId }, { assignedBy: userId }] });
    await Submission.deleteMany({ user: userId });
    await InterviewSession.deleteMany({ user: userId });
    await Report.deleteMany({ user: userId });
    await Batch.updateMany({ candidates: userId }, { $pull: { candidates: userId } });

    await User.findByIdAndDelete(userId);

    await logAudit(req.user._id, "permanently_deleted_user", "User", userId, {
      name: user.name,
      email: user.email,
      role: user.role,
    });

    res.json({ message: "User deleted permanently." });
  } catch (error) {
    console.error("[deleteCandidatePermanently error]", error);
    res.status(500).json({ message: "Server error deleting user permanently." });
  }
};

const getCandidateInterviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await InterviewSession.countDocuments({ user: req.params.id });
    const interviews = await InterviewSession.find({ user: req.params.id })
      .populate("problem", "title difficulty")
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      interviews,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching interviews." });
  }
};

const getInterviewById = async (req, res) => {
  try {
    const interview = await InterviewSession.findById(req.params.id)
      .populate("user", "name email")
      .populate("problem", "title difficulty");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found." });
    }

    await logAudit(req.user._id, "viewed_interview", "InterviewSession", interview._id);

    res.json(interview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching interview details." });
  }
};

const getReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.candidateId) query.user = req.query.candidateId;
    if (req.query.interviewId) query.interviewSession = req.query.interviewId;

    // If caller is faculty, only show reports for assessments created or assigned by that faculty
    if (req.user && req.user.role === "faculty") {
      const facultyAssignments = await Assignment.find({ assignedBy: req.user._id });
      const assignedProblemIds = facultyAssignments.map((a) => a.assessment);
      const assignedCandidateIds = facultyAssignments.map((a) => a.candidate);

      const facultyProblems = await Problem.find({ createdBy: req.user._id }).select("_id");
      const createdProblemIds = facultyProblems.map((p) => p._id);

      const facultySessions = await InterviewSession.find({
        $or: [
          { problem: { $in: createdProblemIds } },
          { problem: { $in: assignedProblemIds }, user: { $in: assignedCandidateIds } },
        ],
      }).select("_id");
      const facultySessionIds = facultySessions.map((s) => s._id);

      query.interviewSession = { $in: facultySessionIds };
    }

    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate("user", "name email")
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      reports,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching reports." });
  }
};

const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("user", "name email role isActive")
      .populate("generatedBy", "name")
      .populate({
        path: "interviewSession",
        populate: [
          { path: "problem" },
          { path: "submission" },
        ],
      });

    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }

    // If caller is faculty, restrict access to reports for assessments created or assigned by that faculty
    if (req.user && req.user.role === "faculty") {
      const problemCreatorId =
        report.interviewSession?.problem?.createdBy?._id ||
        report.interviewSession?.problem?.createdBy;
      const isCreator = problemCreatorId && problemCreatorId.toString() === req.user._id.toString();

      const candidateId = report.user?._id || report.user;
      const problemId = report.interviewSession?.problem?._id || report.interviewSession?.problem;
      const hasAssigned = await Assignment.exists({
        candidate: candidateId,
        assessment: problemId,
        assignedBy: req.user._id,
      });

      if (!isCreator && !hasAssigned) {
        return res.status(403).json({
          message: "Access restricted: You can only view reports for assessments assigned or created by you.",
        });
      }
    }

    await logAudit(req.user._id, "viewed_report", "Report", report._id);

    const reportObj = report.toObject();
    const candidateId = report.user?._id || report.user;

    // Fallback: If interviewSession wasn't populated or was missing links
    let session = reportObj.interviewSession;
    if (!session || typeof session === "string" || !session.questions) {
      const foundSession = await InterviewSession.findOne({
        $or: [
          { _id: report.interviewSession },
          { user: candidateId },
        ],
      })
      .populate("problem")
      .populate("submission")
      .sort({ startedAt: -1, createdAt: -1 });

      if (foundSession) {
        reportObj.interviewSession = foundSession.toObject();
        session = reportObj.interviewSession;
      }
    }

    const problemId = session?.problem?._id || session?.problem;

    // If session submission is missing, find candidate's submission
    if (session && (!session.submission || typeof session.submission === "string")) {
      const sub = await Submission.findOne({
        user: candidateId,
        ...(problemId ? { problem: problemId } : {}),
      }).sort({ submittedAt: -1 });
      if (sub) {
        reportObj.interviewSession.submission = sub.toObject();
      }
    }

    // If session problem is missing or just ID, populate it
    if (session && problemId && (!session.problem?.title || typeof session.problem === "string")) {
      const prob = await Problem.findById(problemId);
      if (prob) {
        reportObj.interviewSession.problem = prob.toObject();
      }
    }

    // Fetch related PreCodeAssessment for candidate and problem
    let preCode = null;
    if (problemId) {
      preCode = await PreCodeAssessment.findOne({
        user: candidateId,
        problem: problemId,
      }).sort({ createdAt: -1 });
    }
    if (!preCode) {
      preCode = await PreCodeAssessment.findOne({
        user: candidateId,
      }).sort({ createdAt: -1 });
    }

    if (preCode) {
      reportObj.preCodeAssessment = preCode.toObject();
    } else {
      reportObj.preCodeAssessment = null;
    }

    // Generate/format personalized improvement path suggestion if not already present
    if (!reportObj.reportData?.improvementPath) {
      const weaknesses = Array.isArray(reportObj.reportData?.weaknesses)
        ? reportObj.reportData.weaknesses
        : (typeof reportObj.reportData?.weaknesses === "string" ? [reportObj.reportData.weaknesses] : []);

      const competencies = reportObj.reportData?.competencies?.scores || {};
      const score = reportObj.reportData?.overallScore || 0;

      const pathItems = [];
      if (competencies.problemSolving < 70 || weaknesses.some(w => /algorithm|complexity|edge case|loop/i.test(w))) {
        pathItems.push({
          area: "Algorithmic Problem Solving & Edge Case Handling",
          priority: "High",
          recommendation: "Focus on decomposing complex constraints into smaller sub-problems. Practice boundary and extreme value verification before writing code.",
          suggestedTopics: ["Two-Pointer & Sliding Window Techniques", "Dynamic Programming Foundations", "Time/Space Complexity Trade-offs"],
        });
      }
      if (competencies.codeQuality < 70 || weaknesses.some(w => /oop|class|interface|abstraction|modular|variable/i.test(w))) {
        pathItems.push({
          area: "Software Design & OOP Fundamentals",
          priority: "High",
          recommendation: "Deepen understanding of core object-oriented principles, particularly the distinction between abstract classes vs interfaces and exception handling safety.",
          suggestedTopics: ["SOLID Design Principles", "Composition over Inheritance (HAS-A vs IS-A)", "Defensive Exception Handling"],
        });
      }
      if (competencies.communication < 70 || weaknesses.some(w => /clarify|explain|concise|detail/i.test(w))) {
        pathItems.push({
          area: "Technical Communication & Reasoning",
          priority: "Medium",
          recommendation: "Practice articulating design trade-offs verbally while writing code. Clearly explain the rationale for chosen data structures and complexity bounds.",
          suggestedTopics: ["Structured Thought Framing (STAR method)", "Technical Justification Frameworks", "Code Walkthrough Verbalization"],
        });
      }
      // General growth recommendation if empty
      if (pathItems.length === 0) {
        pathItems.push({
          area: "Advanced Optimization & Production Readiness",
          priority: "Medium",
          recommendation: "Solid foundation demonstrated. To reach senior level, focus on profiling execution bottlenecks, distributed concurrency patterns, and micro-optimizations.",
          suggestedTopics: ["Concurrency & Memory Management", "System Scalability Patterns", "Advanced Benchmarking"],
        });
      }

      reportObj.reportData.improvementPath = {
        roadmap: pathItems,
        summary: score >= 80
          ? "Candidate demonstrates strong competence with high hire potential. Follow the suggested roadmap to advance to senior architecture capabilities."
          : score >= 60
          ? "Candidate has demonstrated a solid foundational baseline. Targeted study in the highlighted problem-solving and OOP areas will significantly increase mastery."
          : "Candidate requires focused revision of foundational programming constructs, problem decomposition, and runtime safety before re-assessment."
      };
    }

    res.json(reportObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching report details." });
  }
};

const getInterviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await InterviewSession.countDocuments();
    const interviews = await InterviewSession.find()
      .populate("user", "name email isActive")
      .populate("problem", "title difficulty")
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      interviews,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching interviews." });
  }
};

const getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({});
    }
    res.json({
      maxQuestionsLimit: setting.postCodeMaxQuestions || 10,
      preCodeMaxQuestions: setting.preCodeMaxQuestions || 7,
      postCodeMaxQuestions: setting.postCodeMaxQuestions || 10,
      adaptiveInterviewEnabled: true,
      roleInformation: {
        admin: "Full access to settings, analytics, and all candidate data.",
        faculty: "Access to candidate interviews, reports, and basic analytics.",
        student: "Can take coding tests and AI interviews."
      },
      systemStatus: "Operational",
      timers: {
        preCodeAssessmentTimer: setting.preCodeAssessmentTimer || 15,
        codingTestTimer: setting.codingTestTimer || 60,
        interviewTimer: setting.interviewTimer || 30,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching settings." });
  }
};

const updateSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }
    
    // Validate and update timers
    if (req.body.timers) {
      const preTimer = req.body.timers.preCodeAssessmentTimer ?? req.body.timers.preCoding;
      const codeTimer = req.body.timers.codingTestTimer ?? req.body.timers.coding;
      const intTimer = req.body.timers.interviewTimer ?? req.body.timers.postCoding ?? req.body.timers.interview;

      const timersToCheck = [
        { name: "Pre-Code Assessment", val: preTimer },
        { name: "Coding Test", val: codeTimer },
        { name: "Interview", val: intTimer },
      ];

      for (const t of timersToCheck) {
        if (t.val !== undefined) {
          const num = Number(t.val);
          if (isNaN(num) || num < 5 || num > 60) {
            return res.status(400).json({
              message: "The timing should be greater then 5 min and can be upto 60 min for a single round."
            });
          }
        }
      }

      if (preTimer !== undefined) setting.preCodeAssessmentTimer = Number(preTimer);
      if (codeTimer !== undefined) setting.codingTestTimer = Number(codeTimer);
      if (intTimer !== undefined) setting.interviewTimer = Number(intTimer);
    }

    // Validate and update max questions (for pre-coding and post-coding interviews)
    if (req.body.interviewConfig || req.body.preCodeMaxQuestions !== undefined || req.body.postCodeMaxQuestions !== undefined) {
      const preQ = req.body.preCodeMaxQuestions ?? req.body.interviewConfig?.preCodeMaxQuestions;
      const postQ = req.body.postCodeMaxQuestions ?? req.body.interviewConfig?.postCodeMaxQuestions ?? req.body.maxQuestionsLimit;

      if (preQ !== undefined) {
        const num = Number(preQ);
        if (isNaN(num) || num <= 1 || num > 15) {
          return res.status(400).json({
            message: "Pre-coding maximum questions must be greater than 1 and not more than 15."
          });
        }
        setting.preCodeMaxQuestions = num;
      }

      if (postQ !== undefined) {
        const num = Number(postQ);
        if (isNaN(num) || num <= 1 || num > 15) {
          return res.status(400).json({
            message: "Post-coding maximum questions must be greater than 1 and not more than 15."
          });
        }
        setting.postCodeMaxQuestions = num;
      }
    }
    
    await setting.save();
    await logAudit(req.user._id, "updated_settings", "Setting", setting._id);

    res.json({
      message: "Settings updated successfully",
      timers: {
        preCodeAssessmentTimer: setting.preCodeAssessmentTimer,
        codingTestTimer: setting.codingTestTimer,
        interviewTimer: setting.interviewTimer,
      },
      preCodeMaxQuestions: setting.preCodeMaxQuestions,
      postCodeMaxQuestions: setting.postCodeMaxQuestions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Server error updating settings." });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const totalCandidates = await User.countDocuments({ role: "user" });
    const totalInterviews = await InterviewSession.countDocuments();
    const completedInterviews = await InterviewSession.countDocuments({ status: "completed" });
    const pendingInterviews = await InterviewSession.countDocuments({ status: "in_progress" });

    // Aggregate average score
    const avgScoreResult = await InterviewSession.aggregate([
      { $match: { status: "completed", overallScore: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: "$overallScore" } } }
    ]);
    const avgScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;

    // Pass rate (score >= 50)
    const passedInterviews = await InterviewSession.countDocuments({ status: "completed", overallScore: { $gte: 50 } });
    const passRate = completedInterviews > 0 ? Math.round((passedInterviews / completedInterviews) * 100) : 0;

    // Score distribution (buckets)
    const scoreDistributionResult = await InterviewSession.aggregate([
      { $match: { status: "completed", overallScore: { $ne: null } } },
      {
        $bucket: {
          groupBy: "$overallScore",
          boundaries: [0, 20, 40, 60, 80, 100, 101],
          default: "Other",
          output: { count: { $sum: 1 } }
        }
      }
    ]);
    const scoreDistribution = {
      "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0
    };
    scoreDistributionResult.forEach(b => {
      if (b._id === 0) scoreDistribution["0-20"] = b.count;
      if (b._id === 20) scoreDistribution["21-40"] = b.count;
      if (b._id === 40) scoreDistribution["41-60"] = b.count;
      if (b._id === 60) scoreDistribution["61-80"] = b.count;
      if (b._id === 80 || b._id === 100) scoreDistribution["81-100"] += b.count;
    });

    // Classification distribution from answers
    const classificationDistributionResult = await InterviewSession.aggregate([
      { $unwind: "$answers" },
      { $match: { "answers.evaluation.gate_decision": { $exists: true } } },
      { $group: { _id: "$answers.evaluation.gate_decision", count: { $sum: 1 } } }
    ]);
    const classificationDistribution = classificationDistributionResult.map(c => ({
      name: c._id, value: c.count
    }));

    // Most frequently asked concepts
    const conceptDistributionResult = await InterviewSession.aggregate([
      { $unwind: "$questions" },
      { $unwind: { path: "$questions.concept_tags", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$questions.concept_tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const conceptAnalytics = conceptDistributionResult.filter(c => c._id).map(c => ({
      name: c._id, count: c.count
    }));

    res.json({
      totalCandidates,
      totalInterviews,
      completedInterviews,
      pendingInterviews,
      avgScore,
      passRate,
      overview: {
        totalCandidates,
        totalInterviews,
        completedInterviews,
        pendingInterviews,
        avgScore,
        passRate
      },
      performance: {
        scoreDistribution: Object.entries(scoreDistribution).map(([name, value]) => ({ name, value })),
        classificationDistribution
      },
      conceptAnalytics,
      adaptiveAnalytics: []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching analytics." });
  }
};

const getAssessmentDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: "i" };
    }
    if (req.query.difficulty && req.query.difficulty !== "all") {
      query.difficulty = req.query.difficulty;
    }
    if (req.query.status && req.query.status !== "all") {
      query.isActive = req.query.status === "active";
    }

    // When accessed by faculty, show assessments assigned by that faculty (creator can be anyone) or created by that faculty
    if (req.user && req.user.role === "faculty") {
      const assignedProblemIds = await Assignment.distinct("assessment", {
        assignedBy: req.user._id,
      });
      const facultyScope = [
        { _id: { $in: assignedProblemIds } },
        { createdBy: req.user._id },
      ];
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: facultyScope },
        ];
        delete query.$or;
      } else {
        query.$or = facultyScope;
      }
    }

    const total = await Problem.countDocuments(query);
    const problems = await Problem.find(query)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Compute metrics for each problem
    const assessments = await Promise.all(
      problems.map(async (problem) => {
        const problemId = problem._id;

        let candidateIdFilter = null;
        if (req.user && req.user.role === "faculty") {
          const isCreator =
            problem.createdBy &&
            (problem.createdBy._id || problem.createdBy).toString() === req.user._id.toString();
          if (!isCreator) {
            const facultyAssigns = await Assignment.find({
              assessment: problemId,
              assignedBy: req.user._id,
            }).select("candidate");
            candidateIdFilter = facultyAssigns.map((a) => a.candidate?.toString()).filter(Boolean);
          }
        }

        // 1. PreCode assessments
        const preCodeFilter = { problem: problemId };
        if (candidateIdFilter) preCodeFilter.user = { $in: candidateIdFilter };
        const preCodeList = await PreCodeAssessment.find(preCodeFilter);
        const precodingTotal = preCodeList.length;
        const precodingPassed = preCodeList.filter((p) => p.status === "passed").length;
        const precodingFailed = preCodeList.filter(
          (p) => p.status === "failed" || p.status === "terminated"
        ).length;
        const precodingInProgress = preCodeList.filter(
          (p) => p.status === "in_progress" || p.status === "generating"
        ).length;
        const precodingPassRate =
          precodingTotal > 0 ? Math.round((precodingPassed / precodingTotal) * 100) : 0;

        // 2. Coding submissions
        const subFilter = { problem: problemId };
        if (candidateIdFilter) subFilter.user = { $in: candidateIdFilter };
        const submissions = await Submission.find(subFilter);
        const codingCandidateMap = new Map();
        submissions.forEach((sub) => {
          const uId = sub.user?._id?.toString() || sub.user?.toString();
          if (!uId) return;
          const prev = codingCandidateMap.get(uId) || { passed: false, count: 0 };
          prev.count += 1;
          if (sub.status === "Accepted") prev.passed = true;
          codingCandidateMap.set(uId, prev);
        });
        const codingTotal = codingCandidateMap.size;
        let codingPassed = 0;
        codingCandidateMap.forEach((c) => {
          if (c.passed) codingPassed++;
        });
        const codingFailed = codingTotal - codingPassed;
        const codingPassRate =
          codingTotal > 0 ? Math.round((codingPassed / codingTotal) * 100) : 0;

        // 3. PostCode Interview sessions
        const interviewFilter = { problem: problemId };
        if (candidateIdFilter) interviewFilter.user = { $in: candidateIdFilter };
        const interviews = await InterviewSession.find(interviewFilter);
        const postcodingTotal = interviews.length;
        const postcodingCompleted = interviews.filter((i) => i.status === "completed").length;
        const postcodingInProgress = interviews.filter(
          (i) => i.status === "in_progress" || i.status === "generating"
        ).length;
        const postcodingPassed = interviews.filter(
          (i) =>
            i.status === "completed" &&
            (i.overallPassed === true ||
              i.interviewPassed === true ||
              (i.overallScore !== null && i.overallScore >= 50))
        ).length;
        const postcodingFailed = Math.max(0, postcodingCompleted - postcodingPassed);
        const postcodingPassRate =
          postcodingCompleted > 0 ? Math.round((postcodingPassed / postcodingCompleted) * 100) : 0;
        const completedWithScore = interviews.filter(
          (i) => i.status === "completed" && typeof i.overallScore === "number"
        );
        const avgScore =
          completedWithScore.length > 0
            ? Math.round(
                completedWithScore.reduce((sum, i) => sum + i.overallScore, 0) /
                  completedWithScore.length
              )
            : 0;

        // 4. Assignments & Total distinct candidates
        const assignFilter = { assessment: problemId };
        if (candidateIdFilter) assignFilter.assignedBy = req.user._id;
        const assignments = await Assignment.find(assignFilter);
        const allCandidatesSet = new Set();
        assignments.forEach((a) => {
          if (a.candidate) allCandidatesSet.add(a.candidate.toString());
        });
        preCodeList.forEach((p) => {
          if (p.user) allCandidatesSet.add(p.user.toString());
        });
        codingCandidateMap.forEach((_, uId) => allCandidatesSet.add(uId));
        interviews.forEach((i) => {
          if (i.user) allCandidatesSet.add(i.user.toString());
        });

        const totalTaken = allCandidatesSet.size;
        const totalCompleted = postcodingCompleted;
        const totalPending = Math.max(0, totalTaken - totalCompleted);

        // Overall Pass / Fail Percentage
        const passPercentage =
          totalCompleted > 0 ? Math.round((postcodingPassed / totalCompleted) * 100) : 0;
        const failPercentage = totalCompleted > 0 ? 100 - passPercentage : 0;

        return {
          _id: problem._id,
          title: problem.title,
          difficulty: problem.difficulty,
          description: problem.description,
          isActive: problem.isActive,
          createdAt: problem.createdAt,
          createdBy: problem.createdBy
            ? {
                _id: problem.createdBy._id,
                name: problem.createdBy.name,
                email: problem.createdBy.email,
                role: problem.createdBy.role,
              }
            : null,
          totalTaken,
          totalCompleted,
          totalPending,
          precoding: {
            total: precodingTotal,
            passed: precodingPassed,
            failed: precodingFailed,
            inProgress: precodingInProgress,
            passRate: precodingPassRate,
          },
          coding: {
            total: codingTotal,
            passed: codingPassed,
            failed: codingFailed,
            passRate: codingPassRate,
          },
          postcoding: {
            total: postcodingTotal,
            completed: postcodingCompleted,
            inProgress: postcodingInProgress,
            passed: postcodingPassed,
            failed: postcodingFailed,
            passRate: postcodingPassRate,
            avgScore,
          },
          overall: {
            passPercentage,
            failPercentage,
            totalPassed: postcodingPassed,
            totalFailed: postcodingFailed,
          },
        };
      })
    );

    let facultyStats = null;
    if (req.user && req.user.role === "faculty") {
      const facultyId = req.user._id;

      // 1. Total assignments created by that faculty
      const totalAssignmentsCreated = await Assignment.countDocuments({ assignedBy: facultyId });

      // 2. Total unique candidates that faculty assigned
      const candidateIds = await Assignment.distinct("candidate", { assignedBy: facultyId });
      const totalCandidatesAssigned = candidateIds.length;

      // 3. Assessments completed by assigned students
      const assessmentsCompleted = await Assignment.countDocuments({
        assignedBy: facultyId,
        status: "Completed",
      });

      // 4. Assessments in progress
      const assessmentsInProgress = await Assignment.countDocuments({
        assignedBy: facultyId,
        status: "In Progress",
      });

      const assessmentsPending = await Assignment.countDocuments({
        assignedBy: facultyId,
        status: "Pending",
      });

      // 5. Average pass rate of assigned students
      const facultyAssignments = await Assignment.find({ assignedBy: facultyId });
      const userIds = facultyAssignments.map((a) => a.candidate);
      const problemIds = facultyAssignments.map((a) => a.assessment);

      const completedSessions = await InterviewSession.find({
        user: { $in: userIds },
        problem: { $in: problemIds },
        status: "completed",
      });

      let passRate = 0;
      if (completedSessions.length > 0) {
        const passedSessions = completedSessions.filter(
          (s) => s.overallPassed === true || (s.overallScore != null && s.overallScore >= 50)
        ).length;
        passRate = Math.round((passedSessions / completedSessions.length) * 100);
      } else if (assessmentsCompleted > 0) {
        const passedAssigns = facultyAssignments.filter(
          (a) => a.status === "Completed" && (a.codingPassed || (a.bestCodingScore != null && a.bestCodingScore >= 50))
        ).length;
        passRate = Math.round((passedAssigns / assessmentsCompleted) * 100);
      }

      facultyStats = {
        totalAssignmentsCreated,
        totalCandidatesAssigned,
        assessmentsCompleted,
        assessmentsInProgress,
        assessmentsPending,
        avgPassRate: passRate,
      };
    }

    res.json({
      assessments,
      total,
      page,
      pages: Math.ceil(total / limit),
      isFaculty: req.user?.role === "faculty",
      facultyStats,
    });
  } catch (error) {
    console.error("[getAssessmentDashboard error]", error);
    res.status(500).json({ message: "Server error fetching assessment dashboard." });
  }
};

const getAssessmentCandidates = async (req, res) => {
  try {
    const problemId = req.params.id;
    const problem = await Problem.findById(problemId).populate(
      "createdBy",
      "name email role"
    );
    if (!problem) {
      return res.status(404).json({ message: "Assessment problem not found." });
    }

    const isFaculty = req.user && req.user.role === "faculty";
    let isCreator = false;

    // If caller is faculty, restrict access to assessments created or assigned by that faculty
    if (isFaculty) {
      const creatorId = problem.createdBy?._id || problem.createdBy;
      isCreator = creatorId && creatorId.toString() === req.user._id.toString();
      const hasAssigned = await Assignment.exists({
        assessment: problemId,
        assignedBy: req.user._id,
      });

      if (!isCreator && !hasAssigned) {
        return res.status(403).json({
          message: "Access restricted: You can only view candidate assessment reports for assessments assigned or created by you.",
        });
      }
    }

    const assignmentFilter = { assessment: problemId };
    if (isFaculty && !isCreator) {
      assignmentFilter.assignedBy = req.user._id;
    }

    const assignments = await Assignment.find(assignmentFilter)
      .populate("candidate", "name email isActive role")
      .populate("batch", "name");

    const assignedCandidateIds = assignments.map((a) => a.candidate?._id).filter(Boolean);

    let childQuery = { problem: problemId };
    if (isFaculty && !isCreator) {
      childQuery.user = { $in: assignedCandidateIds };
    }

    const [preCodes, submissions, interviews, reports] = await Promise.all([
      PreCodeAssessment.find(childQuery)
        .populate("user", "name email isActive role")
        .sort({ createdAt: -1 }),
      Submission.find(childQuery)
        .populate("user", "name email isActive role")
        .sort({ submittedAt: -1 }),
      InterviewSession.find(childQuery)
        .populate("user", "name email isActive role")
        .sort({ startedAt: -1 }),
      Report.find().select("_id interviewSession user generatedAt"),
    ]);

    const reportMap = new Map();
    reports.forEach((r) => {
      if (r.interviewSession) {
        reportMap.set(r.interviewSession.toString(), r);
      }
    });

    const candidateMap = new Map();

    const getOrCreateCandidate = (userObj) => {
      if (!userObj || !userObj._id) return null;
      const id = userObj._id.toString();
      if (!candidateMap.has(id)) {
        candidateMap.set(id, {
          candidate: {
            _id: userObj._id,
            name: userObj.name,
            email: userObj.email,
            isActive: userObj.isActive !== false,
            role: userObj.role || "user",
          },
          batch: null,
          assignment: null,
          precoding: { status: "not_started", score: null, completedAt: null },
          coding: { status: "not_started", passed: false, score: null, attempts: 0 },
          postcoding: { status: "not_started", passed: false, score: null, completedAt: null },
          overallStatus: "Pending",
          isCompleted: false,
          reportId: null,
          reportAvailable: false,
        });
      }
      return candidateMap.get(id);
    };

    // 1. Process assignments
    assignments.forEach((a) => {
      const entry = getOrCreateCandidate(a.candidate);
      if (entry) {
        entry.assignment = {
          _id: a._id,
          assignedAt: a.assignedAt,
          dueDate: a.dueDate,
          status: a.status,
        };
        if (a.batch) {
          entry.batch = a.batch.name || "Batch";
        }
      }
    });

    // 2. Process preCodes
    preCodes.forEach((p) => {
      const entry = getOrCreateCandidate(p.user);
      if (entry && entry.precoding.status === "not_started") {
        entry.precoding = {
          status: p.status,
          score: p.integrityScore ?? null,
          completedAt: p.completedAt,
        };
      }
    });

    // 3. Process submissions
    submissions.forEach((s) => {
      const entry = getOrCreateCandidate(s.user);
      if (entry) {
        entry.coding.attempts += 1;
        if (s.status === "Accepted") {
          entry.coding.passed = true;
          entry.coding.status = "Accepted";
        } else if (entry.coding.status === "not_started") {
          entry.coding.status = s.status;
        }
      }
    });

    // 4. Process interviews
    interviews.forEach((i) => {
      const entry = getOrCreateCandidate(i.user);
      if (entry && (entry.postcoding.status === "not_started" || entry.postcoding.status !== "completed")) {
        const isComp = i.status === "completed";
        const passed =
          isComp &&
          (i.overallPassed === true ||
            i.interviewPassed === true ||
            (i.overallScore !== null && i.overallScore >= 50));
        entry.postcoding = {
          _id: i._id,
          status: i.status,
          score: i.overallScore,
          passed,
          completedAt: i.completedAt,
        };

        if (isComp) {
          entry.isCompleted = true;
          entry.overallStatus = "Completed";
          const report = reportMap.get(i._id.toString());
          if (report) {
            entry.reportId = report._id;
            entry.reportAvailable = true;
          } else {
            entry.reportId = i._id;
            entry.reportAvailable = true;
          }
        } else if (i.status === "in_progress" || i.status === "generating") {
          entry.overallStatus = "In Progress";
        }
      }
    });

    // Finalize status for in-progress candidates
    candidateMap.forEach((entry) => {
      if (!entry.isCompleted) {
        if (
          entry.precoding.status === "passed" ||
          entry.precoding.status === "in_progress" ||
          entry.coding.attempts > 0 ||
          entry.postcoding.status === "in_progress" ||
          entry.assignment?.status === "In Progress"
        ) {
          entry.overallStatus = "In Progress";
        } else {
          entry.overallStatus = "Pending";
        }
      }
    });

    const candidateList = Array.from(candidateMap.values());

    res.json({
      assessment: problem,
      candidates: candidateList,
      total: candidateList.length,
      completedCount: candidateList.filter((c) => c.isCompleted).length,
      pendingCount: candidateList.filter((c) => !c.isCompleted).length,
    });
  } catch (error) {
    console.error("[getAssessmentCandidates error]", error);
    res.status(500).json({ message: "Server error fetching assessment candidates." });
  }
};

module.exports = {
  createCandidate,
  updateUserRole,
  deleteCandidate,
  reactivateCandidate,
  deleteCandidatePermanently,
  getCandidates,
  getCandidateById,
  getCandidateInterviews,
  getInterviewById,
  getInterviews,
  getSettings,
  updateSettings,
  getReports,
  getReportById,
  getAnalytics,
  getAssessmentDashboard,
  getAssessmentCandidates,
};
