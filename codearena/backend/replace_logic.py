import sys

filename = '/home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/controllers/interviewController.js'

with open(filename, 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "const classification = await classifyResponse(answer, questionObj);" in line:
        start_idx = i
    if "res.json({" in line and start_idx != -1 and end_idx == -1:
        # found res.json({ for the submitAnswer end response
        # verify if it has acknowledgment
        if i+1 < len(lines) and "acknowledgment:" in lines[i+1]:
            # we need to find the closing });
            for j in range(i, len(lines)):
                if "    });" in lines[j] or "    });\n" == lines[j]:
                    end_idx = j
                    break

if start_idx == -1 or end_idx == -1:
    print(f"Could not find indices. Start: {start_idx}, End: {end_idx}")
    sys.exit(1)

replacement = """    const initialState = {
      answer,
      questionObj,
      session,
      classification: null,
      evaluation: null,
      outcome: null,
      contradictions: [],
      result: null
    };

    const finalState = await interviewGraph.invoke(initialState);
    const updatedSession = finalState.session;
    const result = finalState.result;

    session.interviewState = updatedSession.interviewState;
    session.candidateProfile = updatedSession.interviewState.candidateProfile;
    session.conceptGraph = updatedSession.interviewState.conceptGraph;
    session.evidenceStore = updatedSession.interviewState.evidenceStore;

    if (result && !result.advance) {
        session.markModified("interviewState");
        await session.save();
        return res.json({
            ...result,
            interviewState: toClientInterviewSession(session).interviewState,
        });
    }

    CandidateProfile.calculateConfidence(session.candidateProfile);
    session.interviewState.confidence = session.candidateProfile.confidence;

    upsertSessionAnswer(session, {
      qid,
      answer,
      evaluation: finalState.evaluation,
    });

    session.analytics = {
      confidence: session.candidateProfile.confidence,
      competencySummary: CandidateProfile.getCompetencySummary(session.candidateProfile),
      evidenceSummary: EvidenceEngine.summary(session.evidenceStore)
    };

    session.lastActivityAt = new Date();
    session.interviewState.lastUpdated = new Date();
    session.markModified("interviewState");
    await session.save();

    const ACKNOWLEDGMENTS = [
      "Got it.",
      "Understood.",
      "Okay, moving on.",
      "Thanks for your answer.",
      "Noted."
    ];
    const randomAck = finalState.classification.skip ? "Okay, skipping that one." : ACKNOWLEDGMENTS[Math.floor(Math.random() * ACKNOWLEDGMENTS.length)];

    const followingQuestion = (session.interviewState.currentQuestionId && !result.complete) 
        ? session.questions.find((q) => q.qid === session.interviewState.currentQuestionId) 
        : null;

    res.json({
      acknowledgment: randomAck,
      evaluation: toClientEvaluation(finalState.evaluation),
      acknowledged: true,
      advance: true,
      classification: finalState.classification.skip ? "Skip" : finalState.outcome,
      contradictions: finalState.contradictions || [],
      nextQuestion: followingQuestion ? toClientInterviewSession({ questions: [followingQuestion], answers: [] }).questions[0] : null,
      complete: result.complete,
      interviewState: toClientInterviewSession(session).interviewState,
    });
"""

lines = lines[:start_idx] + [replacement] + lines[end_idx+1:]

with open(filename, 'w') as f:
    f.writelines(lines)

print("Replaced successfully.")
