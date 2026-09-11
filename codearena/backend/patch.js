const fs = require('fs');

let content = fs.readFileSync('/home/labuser/Desktop/Project/3207854-CodeArena/codearena/backend/src/controllers/interviewController.js', 'utf8');

// Replace startInterview check
content = content.replace(
  /if \(\s*session &&\s*session\.status === "in_progress" &&\s*!sessionHasMalformedQuestions\(session\)\s*\) \{\s*return res\.json\(toClientInterviewSession\(session\)\);\s*\}\s*if \(session && session\.status === "completed"\) \{\s*return res\.status\(403\)\.json\({ message: "You have already completed the interview for this assignment\." }\);\s*\}/s,
  `if (session && !sessionHasMalformedQuestions(session)) {
      if (["in_progress", "evaluating", "completed", "failed", "terminated"].includes(session.status)) {
        return res.json(toClientInterviewSession(session));
      }
    }`
);

// Replace submitAnswer termination check
content = content.replace(
  /session\.markModified\("interviewState"\);\s*await session\.save\(\);\s*return res\.json\({\s*acknowledged: false,\s*advance: false,\s*classification: classification\.classification,\s*message: state\.terminated\s*\?\s*"The interview has ended because the conduct warning limit was reached\."\s*:\s*classification\.reason,\s*interviewState: toClientInterviewSession\(session\)\.interviewState,\s*}\);/s,
  `session.markModified("interviewState");
      await session.save();
      return res.json({
        acknowledged: false,
        advance: false,
        complete: state.terminated,
        classification: classification.classification,
        message: state.terminated
          ? "The interview has ended because the conduct warning limit was reached."
          : classification.reason,
        interviewState: toClientInterviewSession(session).interviewState,
      });`
);

// Replace completeInterview idempotency
content = content.replace(
  /if \(session\.status === "completed" && !sessionHasManualReviewAnswers\(session\)\) \{\s*return res\.json\(toClientInterviewSession\(session\)\);\s*\}/s,
  `if (session.status === "completed" && !sessionHasManualReviewAnswers(session)) {
      const response = toClientInterviewSession(session);
      response.report = session.report;
      return res.json(response);
    }

    if (session.status === "evaluating") {
      return res.status(202).json({
        ...toClientInterviewSession(session),
        status: "evaluating",
        message: "Evaluation is currently in progress. Please check back shortly.",
      });
    }

    const updateResult = await InterviewSession.updateOne(
      { _id: sessionId, status: "in_progress" },
      { $set: { status: "evaluating" } }
    );
    
    if (updateResult.modifiedCount === 0 && session.status !== "evaluating") {
       const freshSession = await InterviewSession.findById(sessionId);
       if (freshSession) {
         const response = toClientInterviewSession(freshSession);
         if (freshSession.status === "completed") response.report = freshSession.report;
         return res.json(response);
       }
    }
    
    session.status = "evaluating";`
);

fs.writeFileSync('/home/labuser/Desktop/Project/3207854-CodeArena/codearena/backend/src/controllers/interviewController.js', content, 'utf8');
console.log('Patched interviewController.js');
