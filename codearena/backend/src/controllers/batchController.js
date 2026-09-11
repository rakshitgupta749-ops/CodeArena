const Batch = require("../models/Batch");
const User = require("../models/User");
const Assignment = require("../models/Assignment");

const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find({ status: "active" })
      .populate("createdBy", "name email")
      .populate("candidates", "name email isActive")
      .sort({ createdAt: -1 });
    
    // Also get the assignment counts for each batch
    const batchesWithCounts = await Promise.all(
      batches.map(async (batch) => {
        const assignmentCount = await Assignment.countDocuments({ batch: batch._id });
        return {
          ...batch.toObject(),
          assignmentCount
        };
      })
    );

    res.json(batchesWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("candidates", "name email isActive");

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const assignments = await Assignment.find({ batch: batch._id })
      .populate("assessment", "title difficulty")
      .populate("assignedBy", "name")
      .sort({ assignedAt: -1 });

    res.json({ ...batch.toObject(), assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBatch = async (req, res) => {
  try {
    const { name, description, candidates } = req.body;

    const validCandidates = await User.find({
      _id: { $in: candidates },
      role: "user",
      isActive: { $ne: false },
    });

    const batch = await Batch.create({
      name,
      description,
      candidates: validCandidates.map(c => c._id),
      createdBy: req.user._id,
    });

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBatch = async (req, res) => {
  try {
    const { name, description, candidates } = req.body;

    const validCandidates = await User.find({
      _id: { $in: candidates },
      role: "user",
      isActive: { $ne: false },
    });

    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        candidates: validCandidates.map(c => c._id),
        updatedAt: Date.now(),
      },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    res.json(batch);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { status: "archived" },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    res.json({ message: "Batch archived successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
};
