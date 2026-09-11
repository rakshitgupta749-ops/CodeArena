const mongoose = require("mongoose");
const InterviewSession = require("./src/models/InterviewSession");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/codearena").then(async () => {
  const sessions = await InterviewSession.find({});
  console.log("Sessions:", JSON.stringify(sessions, null, 2));
  process.exit(0);
});
