const Problem = require("../models/Problem");
const Assignment = require("../models/Assignment");

// GET /api/problems
const getProblems = async (req, res) => {
  try {
    let query = {};

    // Users only see active problems AND only problems they are assigned to
    if (req.user.role === "user") {
      query.isActive = true;
      const assignments = await Assignment.find({ candidate: req.user._id, status: { $ne: "Completed" } });
      const assignedProblemIds = assignments.map(a => a.assessment);
      query._id = { $in: assignedProblemIds };
    }

    const problems = await Problem.find(query)
      .populate("submissionCount")
      .sort({ createdAt: -1 });

    if (req.user.role === "user") {
      // Strip hidden test cases
      const safeProblems = problems.map(p => {
        const pObj = p.toObject();
        pObj.testCases = pObj.testCases.filter(tc => !tc.isHidden);
        return pObj;
      });
      return res.json(safeProblems);
    }

    res.json(problems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/problems/:id
const getProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id).populate(
      "submissionCount"
    );

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    // Users can only see active problems they are assigned to
    if (req.user.role === "user") {
      if (!problem.isActive) {
        return res.status(404).json({ message: "Problem not found" });
      }

      const assignment = await Assignment.findOne({
        candidate: req.user._id,
        assessment: problem._id,
      });

      // If no assignment exists for this user, block access
      if (!assignment) {
        return res.status(403).json({ message: "You are not assigned to this problem" });
      }

      // Strip hidden test cases
      const pObj = problem.toObject();
      pObj.testCases = pObj.testCases.filter(tc => !tc.isHidden);
      return res.json(pObj);
    }

    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/problems (admin only)
const createProblem = async (req, res) => {
  try {
    const problem = await Problem.create(req.body);
    res.status(201).json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/problems/:id (admin only)
const updateProblem = async (req, res) => {
  try {
    const problem = await Problem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/problems/:id/toggle (admin only)
const toggleProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    problem.isActive = !problem.isActive;
    await problem.save();

    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/problems/:id (admin only)
const deleteProblem = async (req, res) => {
  try {
    const problem = await Problem.findByIdAndDelete(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    res.json({ message: "Problem deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  toggleProblem,
  deleteProblem,
};
