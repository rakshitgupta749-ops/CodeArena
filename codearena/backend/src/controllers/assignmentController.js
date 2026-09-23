const Assignment = require("../models/Assignment");
const Batch = require("../models/Batch");
const User = require("../models/User");
const Submission = require("../models/Submission");
const InterviewSession = require("../models/InterviewSession");
const Report = require("../models/Report");

const assignToCandidate = async (req, res) => {
  try {
    const { assessmentId, candidateId, dueDate, timeConfig, questionsConfig } = req.body;

    const candidate = await User.findOne({ _id: candidateId, role: "user", isActive: true });
    if (!candidate) {
      return res.status(404).json({ message: "Active candidate not found" });
    }

    const payload = {
      assessment: assessmentId,
      candidate: candidateId,
      assignedBy: req.user._id,
      dueDate,
    };

    if (timeConfig) {
      payload.timeConfig = {};
      if (timeConfig.preCodeAssessmentTimer != null && timeConfig.preCodeAssessmentTimer !== "") {
        payload.timeConfig.preCodeAssessmentTimer = Number(timeConfig.preCodeAssessmentTimer);
      }
      if (timeConfig.codingTestTimer != null && timeConfig.codingTestTimer !== "") {
        payload.timeConfig.codingTestTimer = Number(timeConfig.codingTestTimer);
      }
      if (timeConfig.interviewTimer != null && timeConfig.interviewTimer !== "") {
        payload.timeConfig.interviewTimer = Number(timeConfig.interviewTimer);
      }
    }

    if (questionsConfig) {
      payload.questionsConfig = {};
      if (questionsConfig.preCodeMaxQuestions != null && questionsConfig.preCodeMaxQuestions !== "") {
        payload.questionsConfig.preCodeMaxQuestions = Number(questionsConfig.preCodeMaxQuestions);
      }
      if (questionsConfig.postCodeMaxQuestions != null && questionsConfig.postCodeMaxQuestions !== "") {
        payload.questionsConfig.postCodeMaxQuestions = Number(questionsConfig.postCodeMaxQuestions);
      }
    }

    const assignment = await Assignment.create(payload);

    await assignment.populate("assessment", "title difficulty timeConfig questionsConfig");

    res.status(201).json(assignment);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Candidate already has an active assignment for this assessment" });
    }
    res.status(500).json({ message: error.message });
  }
};

const assignToBatch = async (req, res) => {
  try {
    const { assessmentId, dueDate } = req.body;
    const batchId = req.params.id;

    const batch = await Batch.findById(batchId);
    if (!batch || batch.status !== "active") {
      return res.status(404).json({ message: "Active batch not found" });
    }

    // Filter to only candidates that exist in the database
    const existingCandidates = await User.find({
      _id: { $in: batch.candidates },
      role: "user",
    }).select("_id");
    const existingCandidateIds = new Set(existingCandidates.map((c) => c._id.toString()));

    // Create individual assignments for all valid candidates in the batch
    const assignments = [];
    for (const candidateId of batch.candidates) {
      if (!existingCandidateIds.has(candidateId.toString())) {
        continue;
      }
      try {
        const assignment = await Assignment.create({
          assessment: assessmentId,
          batch: batchId,
          candidate: candidateId,
          assignedBy: req.user._id,
          dueDate,
        });
        assignments.push(assignment);
      } catch (err) {
        // Skip duplicate active assignments (error code 11000)
        if (err.code !== 11000) {
          throw err;
        }
      }
    }

    res.status(201).json({ 
      message: `Successfully assigned to ${assignments.length} candidates.`,
      assignmentsCreated: assignments.length 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCandidateAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ candidate: req.params.id })
      .populate("assessment", "title difficulty")
      .populate("assignedBy", "name")
      .sort({ assignedAt: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("assessment", "title difficulty")
      .populate("candidate", "name email isActive")
      .populate("batch", "name")
      .populate("assignedBy", "name")
      .sort({ assignedAt: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ candidate: req.user._id })
      .populate("assessment", "title difficulty")
      .populate("assignedBy", "name")
      .sort({ assignedAt: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    
    if (assignment.status === "Completed") {
      return res.status(400).json({ message: "Completed assignments cannot be removed" });
    }
    
    await assignment.deleteOne();
    
    // Clear the candidate's existing progress for this assessment so a fresh assignment starts from the beginning
    const candidateId = assignment.candidate;
    const problemId = assignment.assessment;

    const interviewSessions = await InterviewSession.find({ user: candidateId, problem: problemId });
    const sessionIds = interviewSessions.map(session => session._id);

    await Report.deleteMany({ interviewSession: { $in: sessionIds } });
    await InterviewSession.deleteMany({ user: candidateId, problem: problemId });
    await Submission.deleteMany({ user: candidateId, problem: problemId });

    res.json({ message: "Assignment removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Only allow editing if status is "Pending"
    if (assignment.status !== "Pending") {
      return res.status(400).json({ 
        message: `Only assignments with 'Pending' status can be edited. This assignment is already ${assignment.status}.`
      });
    }

    const { assessmentId, dueDate, timeConfig, questionsConfig } = req.body;

    if (assessmentId) {
      assignment.assessment = assessmentId;
    }
    if (dueDate !== undefined) {
      assignment.dueDate = dueDate;
    }

    if (timeConfig) {
      assignment.timeConfig = assignment.timeConfig || {};
      if (timeConfig.preCodeAssessmentTimer !== undefined) {
        if (timeConfig.preCodeAssessmentTimer === null || timeConfig.preCodeAssessmentTimer === "") {
          assignment.timeConfig.preCodeAssessmentTimer = null;
        } else {
          const val = Number(timeConfig.preCodeAssessmentTimer);
          if (isNaN(val) || val < 5 || val > 60) {
            return res.status(400).json({ message: "Pre-code assessment timer must be between 5 and 60 minutes." });
          }
          assignment.timeConfig.preCodeAssessmentTimer = val;
        }
      }
      if (timeConfig.codingTestTimer !== undefined) {
        if (timeConfig.codingTestTimer === null || timeConfig.codingTestTimer === "") {
          assignment.timeConfig.codingTestTimer = null;
        } else {
          const val = Number(timeConfig.codingTestTimer);
          if (isNaN(val) || val < 5 || val > 60) {
            return res.status(400).json({ message: "Coding test timer must be between 5 and 60 minutes." });
          }
          assignment.timeConfig.codingTestTimer = val;
        }
      }
      if (timeConfig.interviewTimer !== undefined) {
        if (timeConfig.interviewTimer === null || timeConfig.interviewTimer === "") {
          assignment.timeConfig.interviewTimer = null;
        } else {
          const val = Number(timeConfig.interviewTimer);
          if (isNaN(val) || val < 5 || val > 60) {
            return res.status(400).json({ message: "Interview timer must be between 5 and 60 minutes." });
          }
          assignment.timeConfig.interviewTimer = val;
        }
      }
    }

    if (questionsConfig) {
      assignment.questionsConfig = assignment.questionsConfig || {};
      if (questionsConfig.preCodeMaxQuestions !== undefined) {
        if (questionsConfig.preCodeMaxQuestions === null || questionsConfig.preCodeMaxQuestions === "") {
          assignment.questionsConfig.preCodeMaxQuestions = null;
        } else {
          const val = Number(questionsConfig.preCodeMaxQuestions);
          if (isNaN(val) || val < 2 || val > 15) {
            return res.status(400).json({ message: "Pre-code maximum questions must be between 2 and 15." });
          }
          assignment.questionsConfig.preCodeMaxQuestions = val;
        }
      }
      if (questionsConfig.postCodeMaxQuestions !== undefined) {
        if (questionsConfig.postCodeMaxQuestions === null || questionsConfig.postCodeMaxQuestions === "") {
          assignment.questionsConfig.postCodeMaxQuestions = null;
        } else {
          const val = Number(questionsConfig.postCodeMaxQuestions);
          if (isNaN(val) || val < 2 || val > 15) {
            return res.status(400).json({ message: "Post-code maximum questions must be between 2 and 15." });
          }
          assignment.questionsConfig.postCodeMaxQuestions = val;
        }
      }
    }

    await assignment.save();
    await assignment.populate("assessment", "title difficulty timeConfig questionsConfig");
    await assignment.populate("candidate", "name email isActive");
    await assignment.populate("batch", "name");
    await assignment.populate("assignedBy", "name");

    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  assignToCandidate,
  assignToBatch,
  getCandidateAssignments,
  getAllAssignments,
  getMyAssignments,
  deleteAssignment,
  updateAssignment,
};
