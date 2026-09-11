const User = require("../models/User");
const InterviewSession = require("../models/InterviewSession");
const bcrypt = require("bcryptjs");
const Report = require("../models/Report");
const AuditLog = require("../models/AuditLog");
const Setting = require("../models/Setting");
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

    const query = { role: "user" };

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

    // Fetch latest interview score for each
    const candidatesWithStats = await Promise.all(
      candidates.map(async (candidate) => {
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
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const candidate = await User.create({
      name,
      email,
      password,
      role: "user", // strictly enforce role
      isActive: true,
    });

    await logAudit(req.user._id, "created_candidate", "User", candidate._id);

    // Don't send back password
    const candidateObj = candidate.toObject();
    delete candidateObj.password;

    res.status(201).json(candidateObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error creating candidate." });
  }
};

const deleteCandidate = async (req, res) => {
  try {
    const candidate = await User.findOneAndUpdate(
      { _id: req.params.id, role: "user" },
      { isActive: false },
      { new: true }
    ).select("-password");

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    await logAudit(req.user._id, "deleted_candidate", "User", candidate._id);

    res.json({ message: "Candidate deactivated successfully.", candidate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error deactivating candidate." });
  }
};

const getCandidateById = async (req, res) => {
  try {
    const candidate = await User.findOne({ _id: req.params.id, role: "user" }).select("-password");
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    await logAudit(req.user._id, "viewed_candidate", "User", candidate._id);

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
      .populate("user", "name email")
      .populate("generatedBy", "name");

    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }

    await logAudit(req.user._id, "viewed_report", "Report", report._id);

    res.json(report);
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
      .populate("user", "name email")
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
      maxQuestionsLimit: 10,
      adaptiveInterviewEnabled: true,
      roleInformation: {
        admin: "Full access to settings, analytics, and all candidate data.",
        faculty: "Access to candidate interviews, reports, and basic analytics.",
        student: "Can take coding tests and AI interviews."
      },
      systemStatus: "Operational",
      timers: {
        preCodeAssessmentTimer: setting.preCodeAssessmentTimer,
        codingTestTimer: setting.codingTestTimer,
        interviewTimer: setting.interviewTimer,
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
    
    if (req.body.timers) {
      if (req.body.timers.preCodeAssessmentTimer !== undefined) {
        setting.preCodeAssessmentTimer = req.body.timers.preCodeAssessmentTimer;
      }
      if (req.body.timers.codingTestTimer !== undefined) {
        setting.codingTestTimer = req.body.timers.codingTestTimer;
      }
      if (req.body.timers.interviewTimer !== undefined) {
        setting.interviewTimer = req.body.timers.interviewTimer;
      }
    }
    
    await setting.save();
    await logAudit(req.user._id, "updated_settings", "Setting", setting._id);

    res.json({ message: "Settings updated successfully", timers: req.body.timers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating settings." });
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

module.exports = {
  createCandidate,
  deleteCandidate,
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
};
