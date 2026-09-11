const Assignment = require("../models/Assignment");
const Batch = require("../models/Batch");
const User = require("../models/User");
const Submission = require("../models/Submission");
const InterviewSession = require("../models/InterviewSession");
const Report = require("../models/Report");

const assignToCandidate = async (req, res) => {
  try {
    const { assessmentId, candidateId, dueDate } = req.body;

    const candidate = await User.findOne({ _id: candidateId, role: "user", isActive: true });
    if (!candidate) {
      return res.status(404).json({ message: "Active candidate not found" });
    }

    const assignment = await Assignment.create({
      assessment: assessmentId,
      candidate: candidateId,
      assignedBy: req.user._id,
      dueDate,
    });

    await assignment.populate("assessment", "title difficulty");

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

    // Create individual assignments for all candidates in the batch
    const assignments = [];
    for (const candidateId of batch.candidates) {
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
      .populate("candidate", "name email")
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

module.exports = {
  assignToCandidate,
  assignToBatch,
  getCandidateAssignments,
  getAllAssignments,
  getMyAssignments,
  deleteAssignment,
};
