// Restart trigger
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// Initialize Job Queues
require("./queues/codeExecutionQueue");

const authRoutes = require("./routes/auth");
const problemRoutes = require("./routes/problems");
const submissionRoutes = require("./routes/submissions");
const interviewRoutes = require("./routes/interviews");
const assignmentRoutes = require("./routes/assignments");
const adminRoutes = require("./routes/admin");
const preCodeRoutes = require("./routes/preCode");
const settingsRoutes = require("./routes/settings");
const studentRoutes = require("./routes/student");

const app = express();

const rateLimit = require("express-rate-limit");

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: "Too many requests, please try again later." }
});
app.use(limiter);

// Specific stricter limit for code execution / submission endpoints
const codeExecutionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // max 20 code executions per minute per IP
  message: { message: "Too many code executions, please try again in a minute." }
});
app.use("/api/submissions", codeExecutionLimiter);

// CORS — manual middleware for Express 5 compatibility
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pre-code", preCodeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/student", studentRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
