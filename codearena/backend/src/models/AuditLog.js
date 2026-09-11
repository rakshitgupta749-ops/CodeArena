const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  resourceType: {
    type: String,
    required: true,
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1, action: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
