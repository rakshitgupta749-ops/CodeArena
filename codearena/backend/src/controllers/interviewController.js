const InterviewSession = require("../models/InterviewSession");
const PreCodeAssessment = require("../models/PreCodeAssessment");
const Report = require("../models/Report");
const Setting = require("../models/Setting");
const ReportGenerator =
    require("../services/reportGenerator");
const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const Assignment = require("../models/Assignment");
const CandidateProfile = require("../services/candidateProfile");
const EvidenceEngine = require("../services/evidenceEngine");
const ConceptGraph = require("../services/conceptGraph");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { generateQuestionsV2 } = require("../services/questionGeneratorV2");
const {
  evaluateAnswer,
  evaluateAnswersBatch,

  generateOverallReport,
} = require("../services/answerEvaluator");
const {
  initialiseState,
  classifyResponse,
  applyWarning,
  detectContradictions,
  nextQuestion,
  recordEvaluation,
  IRRELEVANT_WARNING_LIMIT,
  UNPROFESSIONAL_WARNING_LIMIT,
} = require("../services/interviewEngine");
const { rephraseQuestion } = require("../services/llmClient");
const { interviewGraph } = require("../services/langGraphInterviewEngine");
const { compareAcrossRounds } = require("../services/crossRoundComparisonService");

const AUDIO_ANSWER_ROOT = path.join(__dirname, "..", "..", "uploads", "interview-answers");
const EXPECTED_INTERVIEW_QUESTION_COUNT = 10;
const BLOCKING_ASR_WARNINGS = new Set([
  "possible_asr_hallucination",
  "possible_asr_hallucination_short_duration",
  "known_nonsense_hallucination",
  "generic_media_hallucination",
  "abstract_nonsense_hallucination",
  "filler_heavy_transcript",
  "missing_expected_keywords",
  "repeated_phrase_transcript",
  "repeated_word_transcript",
  "transcript_too_long_for_duration",
  "answer_too_short",
  "speech_too_short",
  "no_voiced_speech",
  "mostly_silence",
]);

function toClientEvaluation(evaluation) {
  if (!evaluation) return evaluation;
  const data = typeof evaluation?.toObject === "function"
    ? evaluation.toObject()
    : evaluation;
  const { rubric, ...publicEvaluation } = data;
  return publicEvaluation;
}

function toClientInterviewSession(session) {
  const data = typeof session?.toObject === "function" ? session.toObject() : session;
  const activeQuestionId = data?.interviewState?.currentQuestionId;
  const orderedQuestions = activeQuestionId
    ? [
        ...(data?.questions || []).filter((question) => question.qid === activeQuestionId),
        ...(data?.questions || []).filter((question) => question.qid !== activeQuestionId),
      ]
    : data?.questions || [];
  return {
    ...data,
    questions: orderedQuestions.map((question) => {

        const plainQuestion =
          typeof question?.toObject === "function"
            ? question.toObject()
            : question;

        const {
          rubric,
          assessment_angle,
          answer_criteria,
          scoring_guide,
          partial_correct_answer,
          incorrect_answer,
          evaluates,
          ...publicQuestion
        } = plainQuestion;

        return publicQuestion;

      }),
    answers: (data?.answers || []).map((answer) => {

  const plainAnswer =
    typeof answer?.toObject === "function"
      ? answer.toObject()
      : answer;

  const {
    audioPath,
    ...publicAnswer
  } = plainAnswer;

  return {
    ...publicAnswer,

    answer:
      data.status !== "completed" &&
      publicAnswer.answerType === "voice"
        ? ""
        : publicAnswer.answer,

    hasAudio: Boolean(audioPath),

    evaluation: toClientEvaluation(
      plainAnswer.evaluation
    ),
  };

}),
    interviewState: data?.interviewState
      ? {
          phase: data.interviewState.phase,
          confidence: data.interviewState.confidence,
          integrityScore: data.interviewState.integrityScore,
          professionalismScore: data.interviewState.professionalismScore,
          conceptsCovered: data.interviewState.conceptsCovered || [],
          weakConcepts: data.interviewState.weakConcepts || [],
          warningCount: data.interviewState.warningCount || 0,
          terminated: Boolean(data.interviewState.terminated),
        }
      : null,
  };
}

function buildEvaluationRubric(question) {
  const answerCriteria = Array.isArray(question?.answer_criteria)
    ? question.answer_criteria
        .map((criterion) =>
          `- ${criterion.point} (${criterion.marks} mark${criterion.marks === 1 ? "" : "s"})`
        )
        .join("\n")
    : "";
  const scoringGuide = question?.scoring_guide
    ? [
        `- Full: ${question.scoring_guide.full}`,
        `- Partial: ${question.scoring_guide.partial}`,
        `- Minimal: ${question.scoring_guide.minimal}`,
        `- Zero: ${question.scoring_guide.zero}`,
      ].join("\n")
    : "";

  return [
    question?.rubric ? `Expected spoken answer: ${question.rubric}` : "",
    answerCriteria ? `Answer criteria (5 marks total):\n${answerCriteria}` : "",
    question?.partial_correct_answer
      ? `Partial-credit example: ${question.partial_correct_answer}`
      : "",
    question?.incorrect_answer
      ? `Common incorrect answer: ${question.incorrect_answer}`
      : "",
    question?.assessment_angle
      ? `Evaluator guide: ${question.assessment_angle}`
      : "",
    scoringGuide ? `Scoring categories:\n${scoringGuide}` : "",
    question?.evaluates ? `Evaluates: ${question.evaluates}` : "",
    "Accept equivalent ideas expressed in natural spoken language.",
    "Do not require exact Java syntax, textbook wording, perfect grammar, or fluent English.",
  ]
    .filter(Boolean)
    .join("\n");
}

function isManualReviewEvaluation(evaluation) {
  return (
    evaluation?.flag === "MANUAL_REVIEW_REQUIRED" ||
    evaluation?.flag === "EVALUATION_ERROR" ||
    (evaluation?.gate_decision === "NOT_SCORED" && typeof evaluation?.final_score !== "number")
  );
}

function sessionHasManualReviewAnswers(session) {
  return (session?.answers || []).some((answer) => isManualReviewEvaluation(answer.evaluation));
}

function sessionHasMalformedQuestions(session) {
  const badQuestionValues = new Set(["basic", "intermediate", "advanced", "hard"]);
  const questions = Array.isArray(session?.questions) ? session.questions : [];

  if (questions.length !== EXPECTED_INTERVIEW_QUESTION_COUNT) {
    return true;
  }

  return questions.some((question) => {
    const text = String(question?.question || "").trim().toLowerCase();
    if (!text || badQuestionValues.has(text)) return true;

    const source = String(question?.source || "").toLowerCase();
    const qid = String(question?.qid || "");
    const looksSubmittedCode = source === "submitted_code_llm" || (!source && qid.startsWith("C"));
    const looksBenchmark = source === "benchmark_csv" || (!source && qid.startsWith("R"));
    const hasValidRange =
      Number.isInteger(question?.code_line_start) &&
      Number.isInteger(question?.code_line_end) &&
      question.code_line_start > 0 &&
      question.code_line_end >= question.code_line_start;

    if (looksSubmittedCode) {
      return !question?.code_anchor || !question?.code_snippet || !hasValidRange;
    }

    if (looksBenchmark) {
      return Boolean(
        question?.code_anchor ||
        question?.code_snippet ||
        question?.code_line_start ||
        question?.code_line_end
      );
    }

    return false;
  });
}

function extensionForMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("webm")) return ".webm";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return ".mp3";
  if (normalized.includes("ogg")) return ".ogg";
  if (normalized.includes("mp4")) return ".m4a";
  return ".audio";
}

function asrQualityFromDecision(decision, speechSeconds, warnings) {
  if (decision === "record_again") return "low";
  if (warnings.some((warning) => BLOCKING_ASR_WARNINGS.has(warning))) return "low";
  // 1.5-2s: borderline for Whisper reliability.
  if (Number.isFinite(speechSeconds) && speechSeconds < 1.5) {
    return "low";
  }
  // 1.5-2s or non-blocking warnings: mark as "medium" and keep review metadata.
  if (warnings.length > 0 || (Number.isFinite(speechSeconds) && speechSeconds < 2)) {
    return "medium";
  }
  return "high";
}

function decideAsrResult(transcription) {
  const text = String(transcription?.text || "").trim();
  const warnings = Array.isArray(transcription?.warnings) ? transcription.warnings : [];
  const speechSeconds = Number(transcription?.speech_seconds);
  const hasBlockingWarning = warnings.some((warning) => BLOCKING_ASR_WARNINGS.has(warning));
  const wordCount = text ? text.split(/\s+/).length : 0;

  if (!text) {
    return {
      decision: "record_again",
      live_message: "We could not hear a valid answer. Please record again.",
    };
  }

  // Hard gate: short clips are the highest-risk Whisper hallucination zone.
  if (Number.isFinite(speechSeconds) && speechSeconds < 1.5) {
    return {
      decision: "record_again",
      live_message: "The recording was too short. Please speak a full sentence and record again.",
    };
  }

  if (hasBlockingWarning) {
    const isTooShort = warnings.some((warning) =>
      ["answer_too_short", "speech_too_short"].includes(warning)
    );
    const isSilent = warnings.some((warning) =>
      ["no_voiced_speech", "mostly_silence"].includes(warning)
    );

    return {
      decision: "record_again",
      live_message: isTooShort
        ? "The recording was too short. Please speak a full sentence and record again."
        : isSilent
          ? "We could not hear enough clear speech. Please record again closer to the mic."
          : "The transcript looked unreliable. Please record the answer again.",
    };
  }

  // Hallucination check: if 1.5-2s AND high word count, likely hallucination.
  if (Number.isFinite(speechSeconds) && speechSeconds >= 1.5 && speechSeconds < 2) {
    // If too many words for such short duration, suspect hallucination.
    if (wordCount > 15) {
      warnings.push("possible_asr_hallucination_short_duration");
      return {
        decision: "record_again",
        live_message: "The transcript seemed incomplete or unclear. Please record again with a clear, full answer.",
      };
    }
  }

  if (wordCount < 3) {
    warnings.push("answer_too_short");
    return {
      decision: "record_again",
      live_message: "Please speak at least one full sentence before submitting a voice answer.",
    };
  }

  // Borderline: 1.5-2s or other warnings
  if (warnings.length > 0 || (Number.isFinite(speechSeconds) && speechSeconds < 2)) {
    return {
      decision: "accepted_flagged",
      live_message: "Answer recorded. Audio quality is limited, but it was saved.",
    };
  }

  return {
    decision: "accepted",
    live_message: "Answer recorded.",
  };
}

function upsertSessionAnswer(session, nextAnswer) {
  const existingIndex = (session.answers || []).findIndex((answer) => answer.qid === nextAnswer.qid);
  if (existingIndex >= 0) {
    const existing = session.answers[existingIndex].toObject?.() || session.answers[existingIndex];
    session.answers[existingIndex] = {
      ...existing,
      ...nextAnswer,
      answeredAt: new Date(),
      evaluation: null,
    };
    return;
  }

  session.answers.push({
    ...nextAnswer,
    answeredAt: new Date(),
  });
}

// POST /api/interviews/start
const startInterview = async (req, res) => {
  try {
    const { submissionId } = req.body;
    if (!submissionId) {
      return res.status(400).json({ message: "submissionId is required." });
    }

    const submission = await Submission.findById(submissionId).populate("problem");
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    // Check if a session already exists for this submission
    let session = await InterviewSession.findOne({
      user: req.user._id,
      submission: submissionId,
    }).sort({ startedAt: -1, _id: -1 });

    if (
      session &&
      ["in_progress", "evaluating"].includes(session.status) &&
      !sessionHasMalformedQuestions(session)
    ) {
      return res.json(toClientInterviewSession(session));
    }

    if (session && ["completed", "failed", "terminated"].includes(session.status)) {
      return res.json(toClientInterviewSession(session));
    }

    // Fetch associated PreCodeAssessment for this user & problem
    const preCode = await PreCodeAssessment.findOne({
      user: req.user._id,
      problem: submission.problem._id,
    }).sort({ createdAt: -1 });

    if (!session) {
      // Create a new session
      session = new InterviewSession({
        user: req.user._id,
        submission: submissionId,
        problem: submission.problem._id,
        preCodeAssessment: preCode?._id || null,
        preCodeScore: preCode?.preCodeScore ?? null,
        preCodePassed: preCode?.status === "passed",
        status: "generating",
      });
    } else {
      // Retry failed session
      session.status = "generating";
      session.preCodeAssessment = preCode?._id || session.preCodeAssessment || null;
      session.preCodeScore = preCode?.preCodeScore ?? session.preCodeScore ?? null;
      session.preCodePassed = preCode ? preCode.status === "passed" : session.preCodePassed;
      session.questions = [];
      session.answers = [];
      session.counts = { basic: 0, intermediate: 0, hard: 0 };
      session.conceptExtraction = null;
      session.overallScore = null;
      session.feedback = "Pending evaluation.";
      session.grade = "Pending";
      session.completedAt = undefined;
    }
    await session.save();

    // Call Agent 2 to generate questions based on the code, topic, and Round 1 intent
    const topic = `${submission.problem.title}: ${submission.problem.description}`;
    let generationResult;

    try {
      generationResult = await generateQuestionsV2({
        code: submission.code,
        topic: topic,
        round1Intent: preCode?.intentProfile || null,
      });
    } catch (err) {
      const generationError = err instanceof Error ? err : new Error(String(err));
      console.error("[StartInterview] V2 question generation failed", {
        submissionId,
        sessionId: session._id?.toString(),
        name: generationError.name,
        message: generationError.message,
        stack: generationError.stack,
      });

      session.status = "failed";
      try {
        await session.save();
      } catch (saveError) {
        console.error("[StartInterview] Failed to persist failed session status", {
          submissionId,
          sessionId: session._id?.toString(),
          error: saveError,
        });
      }

      return res.status(500).json({
        message: "Server error. Unable to generate validated V2 interview questions.",
        code: "QUESTION_GENERATION_V2_FAILED",
        details: generationError.message,
      });
    }

    let maxPostCodeQuestions = 10;
    try {
      const assignment = await Assignment.findOne({ candidate: session.user, assessment: session.problem });
      if (assignment?.questionsConfig?.postCodeMaxQuestions) {
        maxPostCodeQuestions = assignment.questionsConfig.postCodeMaxQuestions;
      } else {
        const problemDoc = await Problem.findById(session.problem);
        if (problemDoc?.questionsConfig?.postCodeMaxQuestions) {
          maxPostCodeQuestions = problemDoc.questionsConfig.postCodeMaxQuestions;
        } else {
          const setting = await Setting.findOne();
          maxPostCodeQuestions = setting?.postCodeMaxQuestions || 10;
        }
      }
    } catch (err) {
      const setting = await Setting.findOne();
      maxPostCodeQuestions = setting?.postCodeMaxQuestions || 10;
    }

    let finalQuestions = generationResult.questions;
    if (finalQuestions.length > maxPostCodeQuestions) {
      finalQuestions = finalQuestions.slice(0, maxPostCodeQuestions);
    }

    session.questions = finalQuestions;
    session.counts = generationResult.counts;
    session.conceptExtraction = generationResult.conceptExtraction;
    const interviewState = initialiseState({

        submission,

        questions: generationResult.questions,

        conceptExtraction:

            generationResult.conceptExtraction,

    });

    interviewState.candidateProfile =

        CandidateProfile.createProfile();

    interviewState.evidenceStore =

        EvidenceEngine.createStore();

    interviewState.conceptGraph =

        ConceptGraph.createGraph(
            generationResult.conceptExtraction
        );

    Object.assign(session, {
      interviewState,
      candidateProfile: interviewState.candidateProfile,
      conceptGraph: interviewState.conceptGraph,
      evidenceStore: interviewState.evidenceStore,
      analytics: interviewState.analytics || {},
      status: "in_progress",
      lastActivityAt: new Date()
    });
    await session.save();

    res.status(201).json(toClientInterviewSession(session));
  } catch (err) {
    const startError = err instanceof Error ? err : new Error(String(err));
    console.error("[StartInterview] Unexpected error", {
      submissionId: req.body?.submissionId,
      name: startError.name,
      message: startError.message,
      stack: startError.stack,
    });

    res.status(500).json({
      message: "Server error. Unable to start the interview.",
      code: "START_INTERVIEW_FAILED",
    });
  }
};

// POST /api/interviews/:sessionId/answer
const submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { qid, answer } = req.body;

    if (!qid || !answer) {
      return res.status(400).json({ message: "qid and answer are required." });
    }

    const session = await InterviewSession.findOne({
      _id: sessionId,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    if (session.status !== "in_progress") {
      return res.status(400).json({ message: "Session is not in progress." });
    }

    let state = session.interviewState || initialiseState({ submission: {}, questions: session.questions });
    state.candidateProfile = state.candidateProfile || session.candidateProfile || CandidateProfile.createProfile();
    state.evidenceStore = state.evidenceStore || session.evidenceStore || EvidenceEngine.createStore();
    state.conceptGraph = state.conceptGraph || ConceptGraph.createGraph(state.conceptExtraction || session.conceptExtraction || {});
    session.interviewState = state;
    if (state.terminated) {
      return res.status(403).json({ message: "This interview has ended because the conduct warning limit was reached." });
    }

    if (state.currentQuestionId && state.currentQuestionId !== qid) {
      return res.status(409).json({ message: "Please answer the active interview question before moving on." });
    }

    const questionObj = session.questions.find((q) => q.qid === qid);
    if (!questionObj) {
      return res.status(404).json({ message: "Question not found in session." });
    }

    const initialState = {
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

    Object.assign(session, {
      interviewState: updatedSession.interviewState,
      candidateProfile: updatedSession.interviewState.candidateProfile,
      conceptGraph: updatedSession.interviewState.conceptGraph,
      evidenceStore: updatedSession.interviewState.evidenceStore,
    });

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
  } catch (error) {
     console.error("====================================");
    console.error("SUBMIT ANSWER FAILED");
    console.error(error);
    console.error(error.stack);
    console.error("====================================");

    res.status(500).json({

        success: false,

        message: error.message,

        stack: error.stack});
  }
};

// POST /api/interviews/:sessionId/complete
const completeInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    const session = await InterviewSession.findOne({
      _id: sessionId,
      user: req.user._id,
    }).populate("problem").populate("submission");

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    if (session.status === "completed" && !sessionHasManualReviewAnswers(session)) {
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
    
    session.status = "evaluating";

    if (false) {
      return res.json(toClientInterviewSession(session));
    }

    if (session.status === "completed") {
      console.log("[CompleteInterview] Re-evaluating completed session because previous answers required manual review.");
    }

    const answerMap = new Map();
    for (const stored of session.answers || []) {
      if (stored?.qid && stored?.answer) {
        const storedObject = typeof stored.toObject === "function" ? stored.toObject() : stored;
        answerMap.set(stored.qid, storedObject);
      }
    }

    for (const ans of incomingAnswers) {
      const qid = String(ans?.qid || "");
      const answer = String(ans?.answer || "").trim();
      if (!qid || !answer) continue;
      const answerType = ans?.answerType === "voice" ? "voice" : "typed";
      answerMap.set(qid, {
        ...(answerMap.get(qid) || {}),
        qid,
        answer,
        answerType,
        answeredAt: new Date(),
      });
    }

    const answersToEvaluate = [...answerMap.values()];
    if (answersToEvaluate.length === 0) {
      return res.status(400).json({ message: "No recorded or typed answers are available to evaluate." });
    }

    const evaluationInputs = answersToEvaluate.map((ans) => {
      const questionObj = session.questions.find((q) => q.qid === ans.qid);
      if (!questionObj) {
        throw new Error(`Question ${ans.qid} not found in session.`);
      }

      return {
        qid: questionObj.qid,
        question: questionObj.question,
        rubric: buildEvaluationRubric(questionObj),
        criteria: questionObj.answer_criteria,
        conceptTags: questionObj.concept_tags,
        answer: ans.answer || "",
        transcriptMeta: ans.asrMeta || null,
      };
    });

    let evaluations;
    try {
      evaluations = await evaluateAnswersBatch(evaluationInputs);
    } catch (err) {
      console.error("[CompleteInterview] Batch evaluation failed:", err);
      evaluations = evaluationInputs.map((input) => ({
        ...input,
        trainee: input.answer,
        final_score: null,
        score_std_dev: null,
        uncertain: true,
        flag: "MANUAL_REVIEW_REQUIRED",
        flag_reason: `Batch evaluation failed after retries: ${err.message}. No marks were assigned.`,
        gate_decision: "NOT_SCORED",
        gate_reason: "",
        best_breakdown: {},
        teacher_feedback: {
          what_went_well: [],
          what_was_missing: [`Batch evaluation failed after retries: ${err.message}.`],
          better_answer: "",
        },
        confidence: 0.0,
      }));
    }

    const evaluatedAnswers = answersToEvaluate.map((ans, index) => ({
      qid: ans.qid,
      answer: ans.answer || "",
      answerType: ans.answerType || "typed",
      asrMeta: ans.asrMeta || null,
      audioPath: ans.audioPath || "",
      evaluation: evaluations[index],
      answeredAt: ans.answeredAt || new Date(),
    }));

    session.answers = evaluatedAnswers;
    session.status = "completed";
    session.completedAt = new Date();

    // Compute overall score (average of all answer scores) as a percentage out of 100
    let totalScore = 0;
    let scoredAnswers = 0;
    const scoreDetails = [];
    
    console.log(`[CompleteInterview] Processing ${session.answers.length} answers for scoring...`);
    
    for (const ans of session.answers) {
      console.log(`[CompleteInterview] Processing qid=${ans.qid}`);
      const score = ans.evaluation?.final_score;
      console.log(`[CompleteInterview]   final_score=${score}, type=${typeof score}`);
      const evaluationFlag = ans.evaluation?.flag;
      if (
        typeof score === "number" &&
        !["EVALUATION_ERROR", "MANUAL_REVIEW_REQUIRED"].includes(evaluationFlag)
      ) {
        totalScore += score;
        scoredAnswers++;
        scoreDetails.push({ qid: ans.qid, score });
      }
    }

    console.log(`[CompleteInterview] Score details:`, scoreDetails);
    console.log(`[CompleteInterview] Total score: ${totalScore}, Scored answers: ${scoredAnswers}`);
    
    session.overallScore =
      scoredAnswers > 0
        ? Math.round((totalScore / (scoredAnswers * 5)) * 100)
        : null;

    const interviewScore = scoredAnswers > 0 ? Math.round((totalScore / (scoredAnswers * 5)) * 100) : 0;
    
    // Calculate Coding Score (Round 2)
    let codingScore = 0;
    const testCases = session.submission?.testCaseResults || [];
    if (testCases.length > 0) {
      const hiddenTests = testCases.filter(tc => tc.isHidden);
      const visibleTests = testCases.filter(tc => !tc.isHidden);
      if (hiddenTests.length > 0) {
        const passed = hiddenTests.filter(tc => tc.passed).length;
        codingScore = Math.round((passed / hiddenTests.length) * 100);
      } else if (visibleTests.length > 0) {
        const passed = visibleTests.filter(tc => tc.passed).length;
        codingScore = Math.round((passed / visibleTests.length) * 100);
      }
    } else if (session.submission?.status === "Accepted") {
      codingScore = 100;
    }

    // Retrieve Pre-Code Assessment (Round 1)
    let preCode = null;
    if (session.preCodeAssessment) {
      preCode = await PreCodeAssessment.findById(session.preCodeAssessment);
    }
    if (!preCode && session.user && session.problem) {
      preCode = await PreCodeAssessment.findOne({
        user: session.user,
        problem: session.problem._id || session.problem,
      }).sort({ createdAt: -1 });
    }

    let preCodeScore = typeof preCode?.preCodeScore === "number" ? preCode.preCodeScore : null;
    if (preCodeScore === null) {
      if (preCode?.rubricSummary && preCode.rubricSummary.length > 0) {
        let totalRubricPoints = 0;
        preCode.rubricSummary.forEach((r) => {
          if (r.rating === "strong") totalRubricPoints += 100;
          else if (r.rating === "average") totalRubricPoints += 70;
          else totalRubricPoints += 35;
        });
        preCodeScore = Math.round(totalRubricPoints / preCode.rubricSummary.length);
      } else if (preCode) {
        preCodeScore = preCode.status === "passed" ? 80 : 50;
      } else {
        preCodeScore = 50;
      }
    }

    // Run Cross-Round Comparison (Round 1 Intent vs Round 2 Code vs Round 3 Defense)
    let crossComparison = null;
    try {
      crossComparison = await compareAcrossRounds({
        preCodeAssessment: preCode,
        submission: session.submission,
        interviewSession: session,
        problem: session.problem,
      });
    } catch (crossErr) {
      console.warn("[CompleteInterview] Cross-round comparison error:", crossErr);
      crossComparison = {
        alignmentScore: 80,
        summary: "Cross-round strategic consistency evaluated.",
        comparisons: [],
        consistencyRating: "Moderate",
        pivotsIdentified: [],
      };
    }

    const alignmentScore = crossComparison?.alignmentScore ?? 80;

    session.preCodeAssessment = preCode?._id || session.preCodeAssessment || null;
    session.preCodeScore = preCodeScore;
    session.preCodePassed = preCode ? (preCode.status === "passed" || preCodeScore >= 50) : true;
    session.codingScore = codingScore;
    session.interviewScore = interviewScore;
    session.alignmentScore = alignmentScore;
    session.codingPassed = codingScore >= 50;
    session.interviewPassed = interviewScore >= 50;

    // 3-Round Weighted Composite Score:
    // Round 1 (Pre-Coding Intent): 25%
    // Round 2 (Code Execution): 35%
    // Round 3 (Interview Defense): 25%
    // Cross-Round Strategic Consistency / Alignment: 15%
    const computedOverall = Math.round(
      (preCodeScore * 0.25) +
      (codingScore * 0.35) +
      (interviewScore * 0.25) +
      (alignmentScore * 0.15)
    );

    session.overallScore = scoredAnswers > 0 ? computedOverall : null;
    session.overallPassed = Boolean(
      session.preCodePassed &&
      session.codingPassed &&
      session.interviewPassed &&
      (session.overallScore ?? 0) >= 55
    );

    session.roundScores = {
      round1PreCoding: preCodeScore,
      round2Coding: codingScore,
      round3Interview: interviewScore,
      alignmentIndex: alignmentScore,
      weights: {
        round1: 0.25,
        round2: 0.35,
        round3: 0.25,
        alignment: 0.15,
      },
    };
    session.crossRoundComparison = crossComparison;
    session.markModified("roundScores");
    session.markModified("crossRoundComparison");

    const recruiterReport =
      ReportGenerator.generateReport({
          session,
          preCodeAssessment: preCode,
          crossRoundComparison: crossComparison,
          candidateProfile:
              session.candidateProfile ||
              session.interviewState?.candidateProfile ||
              {},
          conceptGraph:
              session.conceptGraph ||
              session.interviewState?.conceptGraph ||
              {},
          evidenceStore:
              session.evidenceStore ||
              session.interviewState?.evidenceStore ||
              {}
      });
      session.report = recruiterReport;
      session.markModified("report");

      session.lastActivityAt = new Date();
    
    console.log(`[CompleteInterview] Computed overall score: ${session.overallScore}% (Coding: ${codingScore}% [30% weight], Interview: ${interviewScore}% [70% weight])`);

    // Call Agent 1 to generate the final overall report (feedback summary + grade)
    try {
      console.log("[CompleteInterview] Generating overall report...");
      const report = await generateOverallReport({
        problemTitle: session.problem ? session.problem.title : "Java Challenge",
        problemDescription: session.problem ? session.problem.description : "",
        code: session.submission ? session.submission.code : "",
        codingScore,
        interviewScore,
        overallScore: session.overallScore,
        professionalismScore: session.report?.metrics?.professionalism_score || 100,
        integrityScore: session.report?.metrics?.integrity_score || 100,
        answers: evaluatedAnswers.map(ans => {
          const questionObj = session.questions.find((q) => q.qid === ans.qid);
          return {
            qid: ans.qid,
            question: questionObj ? questionObj.question : "",
            source: questionObj ? questionObj.source : "",
            code_line_start: questionObj ? questionObj.code_line_start : undefined,
            code_line_end: questionObj ? questionObj.code_line_end : undefined,
            answer: ans.answer,
            evaluation: ans.evaluation
          };
        })
      });

      console.log("[CompleteInterview] Report generated:", { feedback: report.feedback?.substring(0, 100), grade: report.grade });

      // Validate and set feedback - bulletproof version
      if (report.feedback && typeof report.feedback === 'string' && report.feedback.trim().length > 0) {
        session.feedback = report.feedback.trim();
      } else {
        session.feedback = null; // Will be filled by fallback below
      }
      // Validate and set grade - bulletproof version
      if (report.grade && typeof report.grade === 'string' && report.grade.trim().length > 0) {
        session.grade = report.grade.trim();
      } else {
        session.grade = null; // Will be filled by fallback below
      }

      session.candidateReport = {
        strengths: report.strengths || "Strengths pending review.",
        weaknesses: report.weaknesses || "Weaknesses pending review.",
        stars: typeof report.stars === 'number' ? report.stars : 3
      };

      // removed
        // removed
        // removed
        // removed
      // removed
      // removed
    } catch (reportErr) {
      console.error("[CompleteInterview] Overall feedback generation failed:", reportErr.message);
      session.feedback = null;
      session.grade = null;
      session.candidateReport = { strengths: "Strengths pending review.", weaknesses: "Weaknesses pending review.", stars: 3 };
    }

    // Apply fallbacks if feedback/grade are not properly set
    // Trigger fallback if: missing, too short, or default values
    const hasValidFeedback = session.feedback 
      && typeof session.feedback === 'string' 
      && session.feedback.trim().length > 20
      && session.feedback !== "Pending evaluation.";

    const hasValidGrade = session.grade 
      && typeof session.grade === 'string' 
      && session.grade.trim().length > 0
      && session.grade !== "Pending";

    if (scoredAnswers === 0) {
      session.feedback =
        "Automatic scoring was unavailable, so no performance judgment was made. The interview answers need manual review.";
      session.grade = "Pending Review";
      session.candidateReport = { strengths: "Pending manual review.", weaknesses: "Pending manual review.", stars: 0 };
    } else if (!hasValidFeedback) {
      console.log(`[CompleteInterview] Applying feedback fallback (current: "${session.feedback}", score: ${session.overallScore})`);
      if (session.overallScore >= 80) {
        session.feedback = "Excellent performance! You demonstrated strong technical depth, clear communication, and solid understanding of core Java concepts.";
      } else if (session.overallScore >= 60) {
        session.feedback = "Good performance overall with room for improvement. You showed understanding of key concepts and would benefit from deeper practice with edge cases and optimization choices.";
      } else if (session.overallScore >= 40) {
        session.feedback = "Moderate performance with mixed results. You showed effort, but you should practice core fundamentals and problem-solving approaches more before the next round.";
      } else {
        session.feedback = "You faced challenges during the technical interview. More preparation and study of fundamental Java concepts is recommended before advancing to the next round.";
      }
      if (!session.candidateReport) {
        session.candidateReport = {
          strengths: "Candidate showed effort during the interview.",
          weaknesses: "More preparation is needed on core concepts.",
          stars: session.overallScore >= 80 ? 5 : session.overallScore >= 60 ? 4 : session.overallScore >= 40 ? 3 : 2
        };
      }
    }

    if (scoredAnswers > 0 && !hasValidGrade) {
      console.log(`[CompleteInterview] Applying grade fallback (current: "${session.grade}", score: ${session.overallScore})`);
      if (session.overallScore >= 90) session.grade = "A+";
      else if (session.overallScore >= 85) session.grade = "A";
      else if (session.overallScore >= 80) session.grade = "B+";
      else if (session.overallScore >= 75) session.grade = "B";
      else if (session.overallScore >= 70) session.grade = "C+";
      else if (session.overallScore >= 60) session.grade = "C";
      else session.grade = "Needs Review";
    }

    if (scoredAnswers < session.answers.length) {
      session.grade = "Pending Review";
      if (
        scoredAnswers > 0 &&
        !session.feedback.toLowerCase().includes("manual review")
      ) {
        const pendingCount = session.answers.length - scoredAnswers;
        session.feedback += ` ${pendingCount} answer${pendingCount === 1 ? "" : "s"} still require manual review before the grade is final.`;
      }
    }

    console.log("[CompleteInterview] Final state - feedback:", session.feedback?.substring(0, 50), "grade:", session.grade, "score:", session.overallScore);
    session.markModified("analytics");
    await session.save();

    // Mark the assignment as Completed
    await Assignment.findOneAndUpdate(
      { candidate: req.user._id, assessment: session.problem },
      { status: "Completed" }
    );

    // Create or update the formal Report document in the reports collection
    try {
      await Report.findOneAndUpdate(
        { interviewSession: session._id },
        {
          user: session.user,
          interviewSession: session._id,
          reportType: "Interview Evaluation Report",
          version: "2.0",
          generatedBy: req.user._id,
          reportData: {
            overallScore: session.overallScore || 0,
            recommendation: (session.overallScore || 0) >= 80 ? "Strong Hire" : (session.overallScore || 0) >= 60 ? "Hire" : "Needs Review",
            executiveSummary: session.feedback || "Interview completed successfully.",
            strengths: session.candidateReport?.strengths || "Strong analytical and technical foundation.",
            weaknesses: session.candidateReport?.weaknesses || "Areas for development identified during interview.",
            competencies: recruiterReport?.competencies || {
              scores: {
                problemSolving: session.codingScore || 0,
                technicalDepth: session.interviewScore || 0,
                codeQuality: session.codingScore || 0,
                communication: session.interviewScore || 0,
              }
            },
            metrics: recruiterReport?.metrics || {},
            candidateProfile: recruiterReport?.candidateProfile || {},
          },
          generatedAt: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      );
      console.log(`[CompleteInterview] Successfully saved Report document for session ${session._id}`);
    } catch (reportSaveErr) {
      console.error("[CompleteInterview] Error saving Report document:", reportSaveErr.message);
    }

    const response =toClientInterviewSession(session);

    response.report =recruiterReport;

    res.json(response);
  } catch (error) {
    console.error("[CompleteInterview] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

const getSessionStatus = async (req, res) => {
  try {
    const { problemId } = req.params;

    const assignment = await Assignment.findOne({ candidate: req.user._id, assessment: problemId }).sort({ _id: -1 });



    if (!assignment) {
      return res.status(403).json({ message: "No assignment found." });
    }
    if (assignment.status === "Completed" && assignment.codingPassed === false) {
      return res.json({ status: "coding_failed", assignmentId: assignment._id });
    }

    // Check for an active or completed interview session first
    const session = await InterviewSession.findOne({ user: req.user._id, problem: problemId }).sort({ startedAt: -1, _id: -1 });
    if (session) {
      if (session.status === "completed") {
        return res.json({ status: "interview_completed", sessionId: session._id });
      } else {
        return res.json({ status: "interview_in_progress", sessionId: session._id, submissionId: session.submission });
      }
    }

    // If no session exists, check for an accepted submission
    const submission = await Submission.findOne({ user: req.user._id, problem: problemId, status: "Accepted" }).sort({ submittedAt: -1 });
    if (submission) {
      return res.json({ status: "coding_completed", submissionId: submission._id });
    }

    return res.json({ status: "none" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/interviews/:sessionId
const getInterviewSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = await InterviewSession.findOne({
      _id: sessionId,
      user: req.user._id,
    })
      .populate("problem")
      .populate("submission")
      .populate("preCodeAssessment");

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    if (!session.preCodeAssessment && session.problem) {
      const preCode = await PreCodeAssessment.findOne({
        user: req.user._id,
        problem: session.problem._id || session.problem,
      }).sort({ createdAt: -1 });
      if (preCode) {
        session = session.toObject();
        session.preCodeAssessment = preCode;
      }
    }

    res.json(toClientInterviewSession(session));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startInterview,
  submitAnswer,
  getInterviewSession,
  completeInterview,
  getSessionStatus,
};
