"use strict";

const PreCodeAssessment = require("../models/PreCodeAssessment");
const Problem = require("../models/Problem");
const PRE_CODE_SESSION_TIMEOUT_MS = 10 * 60 * 1000;
const PRE_CODE_TOTAL_TIME_MS = 6 * 60 * 1000;

const {
  startAssessment,
  processResponse,
  finalizeAssessment,
  ensureSingleBasicQuestion,
  isCompoundQuestion,
  GENERIC_QUESTIONS,
  SIMPLIFIED_RECOVERY_QUESTIONS,
  isExplanationOrSolutionRequest,
  isNonsenseResponse,
  RUBRICS,
} = require("../services/preCodeAssessmentEngine");

const { classifyResponse } = require("../services/interviewEngine");

function toClientAssessment(assessment) {
  const data =
    typeof assessment?.toObject === "function"
      ? assessment.toObject()
      : assessment;

  return {
    id: data._id,
    problem: data.problem,
    status: data.status,
    problemType: data.problemType,
    relevantConcepts: data.relevantConcepts || [],
    currentQuestion: data.currentQuestion || null,
    questionCount: data.questionCount || 0,
    warningCount: data.warningCount || 0,
    integrityScore: data.integrityScore ?? 100,
    rubricSummary: (data.status === "passed" || data.status === "failed") ? (data.rubricSummary || []) : null,
    conversation: (data.conversation || []).map((message) => ({
      role: message.role,
      text: message.text,
      questionId: message.questionId || null,
      createdAt: message.createdAt,
    })),
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    rubricState: data.rubricState || {},
  };
}

/**
 * POST /api/pre-code/start
 *
 * Starts a pre-code assessment for the selected problem.
 */
const startPreCodeAssessment = async (req, res) => {
  try {
    const { problemId } = req.body;

    if (!problemId) {
      return res.status(400).json({
        message: "problemId is required.",
      });
    }

    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({
        message: "Problem not found.",
      });
    }

    // ALWAYS terminate ALL old in_progress sessions for this user+problem.
    // This prevents stale state from ever being reused.
    await PreCodeAssessment.updateMany(
      {
        user: req.user._id,
        problem: problem._id,
        status: "in_progress",
      },
      {
        $set: {
          status: "terminated",
          completedAt: new Date(),
        },
      }
    );

    // Also terminate any in_progress sessions for OTHER problems by this user
    // (a user can only have one active assessment at a time).
    await PreCodeAssessment.updateMany(
      {
        user: req.user._id,
        status: "in_progress",
      },
      {
        $set: {
          status: "terminated",
          completedAt: new Date(),
        },
      }
    );

    let assessment = new PreCodeAssessment({
      user: req.user._id,
      problem: problem._id,
      status: "generating",
    });


    await assessment.save();

    try {
      const generated = await startAssessment({
        problem,
      });

      assessment.status = "in_progress";
      assessment.startedAt = new Date();
      assessment.problemType = generated.problemType;
      assessment.relevantConcepts = generated.relevantConcepts;

      assessment.cacheContext = {
        problemType: generated.problemType,
        problemSummary: generated.problemSummary,
        relevantConcepts: generated.relevantConcepts,
        evaluationAreas: generated.evaluationAreas,
      };

      const firstQText = ensureSingleBasicQuestion(
        generated.firstQuestion.question,
        "Understanding of the Problem",
        generated.problemType
      );
      assessment.currentQuestion = firstQText;
      assessment.currentQuestionId = generated.firstQuestion.qid;
      assessment.questionCount = 1;

      assessment.conversation.push({
        role: "ai",
        text: firstQText,
        questionId: generated.firstQuestion.qid,
      });

      assessment.lastActivityAt = new Date();

      await assessment.save();

      return res.status(201).json({
        assessment: toClientAssessment(assessment),
      });
    } catch (generationError) {
      console.error(
        "[PreCode] Failed to generate first question:",
        generationError
      );

      assessment.status = "terminated";
      assessment.completedAt = new Date();
      assessment.lastActivityAt = new Date();

      await assessment.save();

      return res.status(500).json({
        message: "Unable to start the pre-code assessment.",
        code: "PRE_CODE_START_FAILED",
        details: generationError.message,
      });
    }
  } catch (error) {
    console.error("[PreCode] Start assessment error:", error);

    return res.status(500).json({
      message: "Server error while starting the pre-code assessment.",
    });
  }
};

/**
 * POST /api/pre-code/:assessmentId/answer
 *
 * Processes one candidate answer and determines
 * whether to continue, pass, fail, or terminate.
 */
const submitPreCodeAnswer = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { answer } = req.body;

    if (!assessmentId) {
      return res.status(400).json({
        message: "assessmentId is required.",
      });
    }

    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(400).json({
        message: "answer is required.",
      });
    }

    const assessment = await PreCodeAssessment.findOne({
      _id: assessmentId,
      user: req.user._id,
    });

    if (!assessment) {
      return res.status(404).json({
        message: "Pre-code assessment not found.",
      });
    }

    if (assessment.status !== "in_progress") {
      return res.status(409).json({
        message: "This pre-code assessment is no longer active.",
        status: assessment.status,
      });
    }

    const sessionExpired =
      !assessment.lastActivityAt ||
      Date.now() - assessment.lastActivityAt.getTime() >
      PRE_CODE_SESSION_TIMEOUT_MS;

    if (sessionExpired) {
      assessment.status = "terminated";
      assessment.completedAt = new Date();
      await assessment.save();

      return res.status(409).json({
        message:
          "This pre-code assessment session has expired. Please start a new assessment.",
        status: "terminated",
      });
    }

    const assessmentTimeExpired =
      !assessment.startedAt ||
      Date.now() - assessment.startedAt.getTime() >= PRE_CODE_TOTAL_TIME_MS;

    if (assessmentTimeExpired) {
      assessment.status = "terminated";
      assessment.completedAt = new Date();
      assessment.lastActivityAt = new Date();

      await assessment.save();

      return res.status(409).json({
        message: "The pre-code assessment time limit has expired.",
        status: "terminated",
        code: "PRE_CODE_TIME_EXPIRED",
      });
    }

    const problem = await Problem.findById(assessment.problem);

    if (!problem) {
      return res.status(404).json({
        message: "Associated problem not found.",
      });
    }

    /*
     * Candidate Intent Check (Skip / I don't know)
     */
    let isExplicitSkip = false;
    const cleanAnswer = answer.trim();

    // Strict exact match
    const strictSkipRegex = /^\s*(skip|i\s*don'?t\s*know(?:\s*the\s*answer)?|i\s*do\s*not\s*know|i'?m\s*not\s*sure|i\s*can'?t\s*answer\s*this|i'?m\s*not\s*familiar\s*with\s*this|i\s*don'?t\s*know\s*how\s*to\s*approach\s*(?:it|this)?|can\s*we\s*move\s*to\s*(?:the\s*)?next\s*(?:q|question)?|next\s*(?:q|question)?\s*please|move\s*to\s*(?:the\s*)?next\s*(?:q|question)?|go\s*to\s*(?:the\s*)?next\s*(?:q|question)?|i\s*(?:would\s*)?want\s*to\s*skip\s*(?:this|it|one)?|i'?d\s*like\s*to\s*skip\s*(?:this|it|one)?|next\s*(?:q|question)|next|idk)\s*[.?!]*\s*$/i;

    if (strictSkipRegex.test(cleanAnswer)) {
      isExplicitSkip = true;
    } else {
      // Loose match for short sentences (e.g., "I don't know, maybe we can skip this one?")
      const words = cleanAnswer.split(/\s+/);
      if (words.length < 20) {
        const looseSkipRegex = /\b(skip|i\s*don'?t\s*know|i\s*do\s*not\s*know|i'?m\s*not\s*sure|i\s*can'?t\s*answer|i'?m\s*not\s*familiar|i\s*don'?t\s*know\s*how\s*to\s*approach|move\s*to\s*(?:the\s*)?next|go\s*to\s*(?:the\s*)?next|idk)\b/i;
        if (looseSkipRegex.test(cleanAnswer)) {
          isExplicitSkip = true;
        }
      }
    }

    /*
     * ML Moderation Check (ABUSIVE, PROMPT_INJECTION, and SOLUTION_REQUEST)
     */
    let classification = { blocking: false };
    if (!isExplicitSkip) {
      const questionObj = {
        qid: assessment.currentQuestionId,
        question: assessment.currentQuestion,
        rubric: assessment.currentRubric,
        concept_tags: [
          ...(assessment.relevantConcepts || []),
          ...(problem?.tags || []),
          ...(problem?.title ? [problem.title] : []),
        ],
      };
      classification = await classifyResponse(answer.trim(), questionObj);
    }

    if (classification.blocking) {
      const isConductViolation =
        classification.warning === "prompt_injection" ||
        classification.warning === "abusive_language";

      if (!isConductViolation) {
        // Unrelated, nonsense, explanation requests, and solution requests are NOT conduct violations
        classification.blocking = false;
      } else {
        assessment.warningCount = (assessment.warningCount || 0) + 1;
        assessment.integrityScore = Math.max(
          0,
          (assessment.integrityScore || 100) -
          (classification.warning === "abusive_language" ? 20 : 10)
        );
        if (assessment.warningCount >= 2) {
          assessment.status = "terminated";
          assessment.completedAt = new Date();
        }

        assessment.lastActivityAt = new Date();
        await assessment.save();

        let responseMessage = classification.reason;
        if (assessment.status === "terminated") {
          responseMessage =
            "Assessment Terminated: The interview was terminated because of repeated conduct violations.";
        } else {
          responseMessage = `Conduct Warning (${assessment.warningCount}/2): ${classification.reason}`;
        }

        return res.json({
          acknowledged: false,
          advance: false,
          classification: classification.classification,
          warningType: classification.warning,
          warningCount: assessment.warningCount || 0,
          terminated: assessment.status === "terminated",
          message: responseMessage,
          assessment: toClientAssessment(assessment),
        });
      }
    }

    /*
     * Store the candidate's answer before asking the LLM to evaluate it.
     */
    assessment.conversation.push({
      role: "candidate",
      text: answer.trim(),
      questionId: assessment.currentQuestionId,
    });

    let result;
    let state = assessment.rubricState || {};
    let curRubricObj = state[assessment.currentRubric] || {};
    let interceptedSkip = false;

    if (isExplicitSkip && !curRubricObj.probeUsed) {
      interceptedSkip = true;
      isExplicitSkip = false;
      result = {
        rubricStatus: "probe",
        evaluation: {
          rating: "weak",
          reason: "Candidate attempted to skip. Probe issued instead."
        },
        decision: "continue",
        nextQuestion: {
          qid: `generic_${assessment.currentRubric.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_probe`,
          question: GENERIC_QUESTIONS[assessment.currentRubric] || "Could you try explaining your thoughts on this part?",
          targetArea: assessment.currentRubric
        },
        responseClassification: "skip_intercept"
      };
    }

    if (isExplicitSkip) {
      const currentIndex = RUBRICS.indexOf(assessment.currentRubric);
      let nextQuestion = null;
      if (currentIndex >= 0 && currentIndex < RUBRICS.length - 1) {
        const nextRubric = RUBRICS[currentIndex + 1];
        nextQuestion = {
          qid: `generic_${nextRubric.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
          question: GENERIC_QUESTIONS[nextRubric],
          targetArea: nextRubric
        };
      }

      result = {
        rubricStatus: "completed",
        evaluation: {
          rating: "weak",
          reason: "Candidate explicitly skipped the question or stated they do not know the answer."
        },
        decision: "continue",
        nextQuestion: nextQuestion,
        responseClassification: "skip"
      };
    } else if (!interceptedSkip) {
      result = await processResponse({
        problem,
        assessment,
        candidateAnswer: answer.trim(),
      });
    }

    // Explicitly handle LLM-detected prompt injection
    if (result.responseClassification === "prompt_injection") {
      assessment.warningCount = (assessment.warningCount || 0) + 1;
      assessment.integrityScore = Math.max(
        0,
        (assessment.integrityScore || 100) - 10
      );
      if (assessment.warningCount >= 2) {
        assessment.status = "terminated";
        assessment.completedAt = new Date();
      }

      assessment.lastActivityAt = new Date();
      await assessment.save();

      let responseMessage = "Assessment instructions cannot be changed. Please answer the current question or type Skip.";
      if (assessment.status === "terminated") {
        responseMessage =
          "Assessment Terminated: The interview was terminated because of repeated conduct violations.";
      } else {
        responseMessage = `Conduct Warning (${assessment.warningCount}/2): ${responseMessage}`;
      }

      return res.json({
        acknowledged: false,
        advance: false,
        classification: "Prompt Injection",
        warningType: "prompt_injection",
        warningCount: assessment.warningCount || 0,
        terminated: assessment.status === "terminated",
        message: responseMessage,
        assessment: toClientAssessment(assessment),
      });
    }


    const isUnrelatedOrNonsenseOrReq =
      result.responseClassification === "off_topic" ||
      result.responseClassification === "irrelevant" ||
      result.responseClassification === "non_responsive" ||
      isExplanationOrSolutionRequest(answer) ||
      isNonsenseResponse(answer);

    if (isUnrelatedOrNonsenseOrReq) {
      if (!curRubricObj.probeUsed) {
        result.rubricStatus = "probe";
        result.evaluation = result.evaluation || {};
        result.evaluation.rating = "weak";
        result.evaluation.reason = "Candidate response was insufficient or unrelated. Probing for clarification on current rubric.";
        // Force the simplified recovery probe for nonsense/unrelated
        result.nextQuestion = {
          qid: `generic_${assessment.currentRubric.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_recovery`,
          question: SIMPLIFIED_RECOVERY_QUESTIONS[assessment.currentRubric] || GENERIC_QUESTIONS[assessment.currentRubric],
          targetArea: assessment.currentRubric
        };
      } else {
        result.rubricStatus = "completed";
        result.evaluation = result.evaluation || {};
        result.evaluation.rating = "weak";
        result.evaluation.reason = "Candidate provided an insufficient response and recovery probe was already used.";
        result.nextQuestion = null;
      }
    }

    assessment.lastEvaluation = result.evaluation;

    if (Array.isArray(result.evaluation?.evidence)) {
      assessment.evidence = [
        ...(assessment.evidence || []),
        ...result.evaluation.evidence,
      ];
    }

    curRubricObj.questionsAsked = curRubricObj.questionsAsked || [];
    curRubricObj.candidateAnswers = curRubricObj.candidateAnswers || [];
    curRubricObj.questionsAsked.push(assessment.currentQuestion);
    curRubricObj.candidateAnswers.push(answer.trim());
    if (result.rubricStatus === "probe") {
      if (curRubricObj.probeUsed) {
        // Deterministic override: only one probe allowed per rubric.
        result.rubricStatus = "completed";
        result.evaluation = result.evaluation || {};
        result.evaluation.rating = "weak";
        result.evaluation.reason = "Candidate failed to provide sufficient evidence after the probe.";
        // Wipe the next question since we are completing it and need a new one
        result.nextQuestion = null;
      } else {
        curRubricObj.probeUsed = true;
        curRubricObj.firstAttemptRating = result.evaluation?.rating || "weak";
        curRubricObj.firstAttemptReason = result.evaluation?.reason || "";
        // Strictly enforce probe target is the current rubric
        if (!result.nextQuestion || !result.nextQuestion.question) {
          result.nextQuestion = {
            qid: `generic_${assessment.currentRubric.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_probe_fallback`,
            question: SIMPLIFIED_RECOVERY_QUESTIONS[assessment.currentRubric] || GENERIC_QUESTIONS[assessment.currentRubric] || "Could you provide a bit more detail about your reasoning here?",
            targetArea: assessment.currentRubric
          };
        } else {
          result.nextQuestion.targetArea = assessment.currentRubric;
        }
        result.nextQuestion.question = ensureSingleBasicQuestion(
          result.nextQuestion.question,
          assessment.currentRubric,
          assessment.problemType
        );
      }
    }
    state[assessment.currentRubric] = curRubricObj;
    assessment.rubricState = state;
    assessment.markModified("rubricState");

    if (result.rubricStatus === "completed") {
      let rating = result.evaluation?.rating || "weak";
      let reason = result.evaluation?.reason || "Candidate completed the rubric.";

      if (isExplicitSkip) {
        rating = "weak";
        reason = "Candidate explicitly skipped the question or stated they do not know the answer.";
      } else if (curRubricObj.firstAttemptRating) {
        // Keep the best rating between the first attempt and the probe response
        const ranks = { "weak": 1, "average": 2, "strong": 3 };
        const oldRank = ranks[curRubricObj.firstAttemptRating] || 1;
        const newRank = ranks[rating] || 1;
        if (oldRank > newRank) {
          rating = curRubricObj.firstAttemptRating;
          reason = curRubricObj.firstAttemptReason || reason;
        }
      }

      curRubricObj.status = "completed";
      curRubricObj.rating = rating;
      curRubricObj.reason = reason;
      state[assessment.currentRubric] = curRubricObj;

      if (!assessment.completedRubrics) assessment.completedRubrics = [];
      if (!assessment.completedRubrics.includes(assessment.currentRubric)) {
        assessment.completedRubrics.push(assessment.currentRubric);
      }

      // Only process side-evidence if the response was on-topic
      const isUnrelated = result.responseClassification === "off_topic" || result.responseClassification === "irrelevant" || isUnrelatedOrNonsenseOrReq;
      if (!isUnrelated && Array.isArray(result.evaluation?.evidence)) {
        result.evaluation.evidence.forEach(item => {
          if (RUBRICS.includes(item.area) && item.area !== assessment.currentRubric) {
            if (item.status === "strong" || item.status === "average") {
              let itemState = state[item.area] || {};
              if (itemState.status !== "completed") {
                itemState.status = "completed";
                itemState.rating = item.status;
                itemState.reason = item.reason || "Evaluated alongside another rubric.";
                state[item.area] = itemState;
                if (!assessment.completedRubrics.includes(item.area)) {
                  assessment.completedRubrics.push(item.area);
                }
              }
            }
          }
        });
      }

      assessment.rubricState = state;
      assessment.markModified("rubricState");
      assessment.markModified("completedRubrics");

      const unevaluatedRubrics = RUBRICS.filter(r => !assessment.completedRubrics.includes(r));

      // Never trust early LLM pass/finalize if there are unevaluated rubrics
      if ((result.decision === "pass" || result.decision === "finalize") && unevaluatedRubrics.length > 0) {
        result.decision = "continue";
      }

      const isRecoveryFailure = Boolean(curRubricObj.probeUsed && rating === "weak");

      if (unevaluatedRubrics.length === 0) {
        result.decision = "finalize";
      } else {
        const nextRubric = unevaluatedRubrics[0];

        if (result.nextQuestion && result.nextQuestion.targetArea && unevaluatedRubrics.includes(result.nextQuestion.targetArea)) {
          assessment.currentRubric = result.nextQuestion.targetArea;
          result.nextQuestion.question = ensureSingleBasicQuestion(
            result.nextQuestion.question,
            result.nextQuestion.targetArea,
            assessment.problemType
          );
        } else {
          assessment.currentRubric = nextRubric;
          result.nextQuestion = {
            qid: `generic_${nextRubric.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
            question: GENERIC_QUESTIONS[nextRubric] || `What is your approach for ${nextRubric}?`,
            targetArea: nextRubric
          };
        }

        // Show transition message on recovery failure when advancing to next question
        if (isRecoveryFailure) {
          result.interviewerMessage = "Seems like you didn't understand it well, fine we move on to the next question.";
        } else {
          result.interviewerMessage = null;
        }
      }
    }

    if (result.decision === "finalize") {
      await assessment.save();

      result = await finalizeAssessment({
        problem,
        assessment,
      });
    }

    if (result.decision === "pass") {
      assessment.status = "passed";
      assessment.completedAt = new Date();
    } else if (result.decision === "fail") {
      assessment.status = "failed";
      assessment.completedAt = new Date();
    } else if (result.decision === "terminate") {
      assessment.status = "terminated";
      assessment.completedAt = new Date();
    } else {
      if (result.nextQuestion) {
        result.nextQuestion.question = ensureSingleBasicQuestion(
          result.nextQuestion.question,
          result.nextQuestion.targetArea || assessment.currentRubric,
          assessment.problemType
        );
        assessment.currentQuestion = result.nextQuestion.question;
        assessment.currentQuestionId = result.nextQuestion.qid;
        assessment.questionCount += 1;

        if (result.interviewerMessage) {
          assessment.conversation.push({
            role: "ai",
            text: result.interviewerMessage,
            questionId: "transition_msg",
          });
        }

        assessment.conversation.push({
          role: "ai",
          text: result.nextQuestion.question,
          questionId: result.nextQuestion.qid,
        });
      }
    }

    assessment.lastActivityAt = new Date();
    await assessment.save();

    return res.json({
      acknowledged: true,
      assessment: toClientAssessment(assessment),
      result: {
        responseClassification: result.responseClassification,
        evaluation: result.evaluation,
        decision: result.decision,
        interviewerMessage: result.interviewerMessage,
        nextQuestion: result.nextQuestion,
      },
    });
  } catch (error) {
    console.error("[PreCode] Submit answer error:", error);

    return res.status(500).json({
      message: "Server error while processing the pre-code answer.",
      code: "PRE_CODE_ANSWER_FAILED",
      details: error.message,
    });
  }
};

/**
 * POST /api/pre-code/:assessmentId/timeout
 *
 * Finalizes the assessment when the total assessment time has expired.
 */
const timeoutPreCodeAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await PreCodeAssessment.findOne({
      _id: assessmentId,
      user: req.user._id,
    });

    if (!assessment) {
      return res.status(404).json({
        message: "Pre-code assessment not found.",
      });
    }

    if (assessment.status !== "in_progress") {
      return res.status(409).json({
        message: "This pre-code assessment is no longer active.",
        status: assessment.status,
      });
    }

    const problem = await Problem.findById(assessment.problem);

    if (!problem) {
      return res.status(404).json({
        message: "Associated problem not found.",
      });
    }

    const result = await finalizeAssessment({
      problem,
      assessment,
    });

    assessment.lastEvaluation = result.evaluation;

    if (result.decision === "pass") {
      assessment.status = "passed";
    } else {
      assessment.status = "failed";
    }

    assessment.completedAt = new Date();
    assessment.lastActivityAt = new Date();

    await assessment.save();

    return res.json({
      assessment: toClientAssessment(assessment),
      result: {
        responseClassification: result.responseClassification,
        evaluation: result.evaluation,
        decision: result.decision,
        interviewerMessage: result.interviewerMessage,
        nextQuestion: null,
      },
    });
  } catch (error) {
    console.error("[PreCode] Timeout assessment error:", error);

    return res.status(500).json({
      message: "Server error while finalizing the timed-out pre-code assessment.",
      code: "PRE_CODE_TIMEOUT_FAILED",
      details: error.message,
    });
  }
};

/**
 * GET /api/pre-code/:assessmentId
 *
 * Returns the current assessment state.
 */
const getPreCodeAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await PreCodeAssessment.findOne({
      _id: assessmentId,
      user: req.user._id,
    });

    if (!assessment) {
      return res.status(404).json({
        message: "Pre-code assessment not found.",
      });
    }

    return res.json({
      assessment: toClientAssessment(assessment),
    });
  } catch (error) {
    console.error("[PreCode] Get assessment error:", error);

    return res.status(500).json({
      message: "Server error while retrieving the pre-code assessment.",
    });
  }
};

/**
 * GET /api/pre-code/status/:problemId
 *
 * Returns the status of the latest pre-code assessment for this problem.
 */
const getPreCodeStatus = async (req, res) => {
  try {
    const { problemId } = req.params;

    const assessment = await PreCodeAssessment.findOne({
      user: req.user._id,
      problem: problemId,
    }).sort({ createdAt: -1 });

    if (!assessment) {
      return res.json({ status: "none" });
    }

    return res.json({ status: assessment.status });
  } catch (error) {
    console.error("[PreCode] Get status error:", error);
    return res.status(500).json({
      message: "Server error while retrieving pre-code assessment status.",
    });
  }
};

/**
 * POST /api/pre-code/:assessmentId/terminate
 *
 * Terminates an assessment session (e.g. due to inactivity).
 * The frontend calls this when the 2-minute away timer fires.
 */
const terminatePreCodeAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await PreCodeAssessment.findOne({
      _id: assessmentId,
      user: req.user._id,
    });

    if (!assessment) {
      return res.status(404).json({
        message: "Pre-code assessment not found.",
      });
    }

    // If already finalized, just confirm
    if (assessment.status !== "in_progress" && assessment.status !== "generating") {
      return res.json({
        message: "Assessment is already finalized.",
        status: assessment.status,
      });
    }

    assessment.status = "terminated";
    assessment.completedAt = new Date();
    assessment.lastActivityAt = new Date();
    await assessment.save();

    return res.json({
      message: "Assessment terminated due to inactivity.",
      status: "terminated",
    });
  } catch (error) {
    console.error("[PreCode] Terminate assessment error:", error);
    return res.status(500).json({
      message: "Server error while terminating the pre-code assessment.",
    });
  }
};

module.exports = {
  startPreCodeAssessment,
  submitPreCodeAnswer,
  timeoutPreCodeAssessment,
  terminatePreCodeAssessment,
  getPreCodeAssessment,
  getPreCodeStatus,
};