const mongoose = require("mongoose");
require("dotenv").config({ path: "backend/.env" });
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const InterviewSession = require("./backend/src/models/InterviewSession");
  const sessions = await InterviewSession.find({});
  console.log("Total sessions:", sessions.length);
  sessions.forEach(s => {
    console.log("ID:", s._id, "Status:", s.status, "Overall Score:", s.overallScore, "Scored Answers:", s.answers.length, "Grade:", s.grade);
  });
  process.exit();
});
