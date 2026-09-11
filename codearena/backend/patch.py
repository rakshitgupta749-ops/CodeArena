import re

with open("/home/labuser/Desktop/Project/3207854-CodeArena/codearena/backend/src/controllers/interviewController.js", "r", encoding="utf-8") as f:
    content = f.read()

# Replace startInterview check
content = re.sub(
    r'if\s*\(\s*session\s*&&\s*session\.status\s*===\s*"in_progress"\s*&&\s*!sessionHasMalformedQuestions\(session\)\s*\)\s*\{\s*return\s*res\.json\(toClientInterviewSession\(session\)\);\s*\}\s*if\s*\(\s*session\s*&&\s*session\.status\s*===\s*"completed"\s*\)\s*\{\s*return\s*res\.status\(403\)\.json\(\{.*?\}\);\s*\}',
    '''if (session && !sessionHasMalformedQuestions(session)) {
      if (["in_progress", "evaluating", "completed", "failed", "terminated"].includes(session.status)) {
        return res.json(toClientInterviewSession(session));
      }
    }''',
    content,
    flags=re.DOTALL
)

# Replace submitAnswer termination check
content = re.sub(
    r'session\.markModified\("interviewState"\);\s*await\s*session\.save\(\);\s*return\s*res\.json\(\{\s*acknowledged:\s*false,\s*advance:\s*false,\s*classification:\s*classification\.classification,\s*message:\s*state\.terminated\s*\?\s*"The interview has ended because the conduct warning limit was reached\."\s*:\s*classification\.reason,\s*interviewState:\s*toClientInterviewSession\(session\)\.interviewState,\s*\}\);',
    '''session.markModified("interviewState");
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
      });''',
    content,
    flags=re.DOTALL
)

# Replace completeInterview idempotency
content = re.sub(
    r'if\s*\(\s*session\.status\s*===\s*"completed"\s*&&\s*!sessionHasManualReviewAnswers\(session\)\s*\)\s*\{\s*return\s*res\.json\(toClientInterviewSession\(session\)\);\s*\}',
    '''if (session.status === "completed" && !sessionHasManualReviewAnswers(session)) {
      const response = toClientInterviewSession(session);
      response.report = session.report;
      return res.json(response);
    }

    if (session.status === "evaluating") {
      return res.json({
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
    
    session.status = "evaluating";''',
    content,
    flags=re.DOTALL
)

with open("/home/labuser/Desktop/Project/3207854-CodeArena/codearena/backend/src/controllers/interviewController.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully.")
