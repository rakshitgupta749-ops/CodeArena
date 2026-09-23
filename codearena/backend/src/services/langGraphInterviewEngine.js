const { StateGraph, END, START } = require("@langchain/langgraph");
const {
  classifyResponse,
  applyWarning,
  detectContradictions,
  nextQuestion,
  recordEvaluation,
  UNPROFESSIONAL_WARNING_LIMIT,
  IRRELEVANT_WARNING_LIMIT
} = require("./interviewEngine");
const { evaluateAnswer } = require("./answerEvaluator");
const { rephraseQuestion } = require("./llmClient");
const CandidateProfile = require("./candidateProfile");
const EvidenceEngine = require("./evidenceEngine");

const graphState = {
  answer: { value: (x, y) => y ?? x },
  questionObj: { value: (x, y) => y ?? x },
  session: { value: (x, y) => y ?? x }, // The session document/object
  classification: { value: (x, y) => y ?? x },
  evaluation: { value: (x, y) => y ?? x },
  outcome: { value: (x, y) => y ?? x },
  contradictions: { value: (x, y) => y ?? x },
  result: { value: (x, y) => y ?? x } // Final response for API
};

async function classifyNode(state) {
  const { answer, questionObj } = state;
  const classification = await classifyResponse(answer, questionObj);
  return { classification };
}

async function handleRephraseNode(state) {
  const { classification, questionObj, session } = state;
  const qid = questionObj.qid;
  const interviewState = session.interviewState;
  
  const currentCount = interviewState.rephraseCount?.[qid] || 0;
  if (currentCount >= 2) {
    return {
      result: {
        acknowledged: false,
        advance: false,
        classification: "RephraseLimitReached",
        message: "I've rephrased this as much as I can. Please try to answer the question to the best of your ability, or type Skip to move on."
      }
    };
  }
  
  interviewState.rephraseCount = interviewState.rephraseCount || {};
  interviewState.rephraseCount[qid] = currentCount + 1;
  
  const rephrasedText = await rephraseQuestion(questionObj.question);
  const isFallback = rephrasedText.startsWith("I'm having trouble");
  
  return {
    result: {
      acknowledged: false,
      advance: false,
      classification: "Rephrased",
      message: isFallback ? rephrasedText : `Here's a simpler version of the question:\n\n"${rephrasedText}"\n\nTake your time to answer or type Skip.`
    }
  };
}

async function handleBlockingNode(state) {
  const { classification, session } = state;
  const interviewState = session.interviewState;
  
  applyWarning(interviewState, classification.warning);
  
  let finalMessage = classification.reason;
  if (interviewState.terminated) {
     finalMessage = interviewState.terminationReason || "The interview has ended because the conduct warning limit was reached.";
  } else if (["abusive_language", "prompt_injection"].includes(classification.warning)) {
     finalMessage = `⚠️ Unprofessional behaviour detected.\nWarning ${interviewState.unprofessionalWarningCount} of ${UNPROFESSIONAL_WARNING_LIMIT}.\n${classification.reason}\n${UNPROFESSIONAL_WARNING_LIMIT - (interviewState.unprofessionalWarningCount || 0)} warning(s) remaining.`;
  } else if (["irrelevant_answer", "gibberish"].includes(classification.warning)) {
     finalMessage = `⚠️ Irrelevant response detected.\nWarning ${interviewState.irrelevantWarningCount} of ${IRRELEVANT_WARNING_LIMIT}.\n${classification.reason}\n${IRRELEVANT_WARNING_LIMIT - (interviewState.irrelevantWarningCount || 0)} warning(s) remaining.`;
  }
  
  return {
    result: {
      acknowledged: false,
      advance: false,
      complete: interviewState.terminated,
      classification: interviewState.terminated ? "Terminated" : classification.classification,
      message: finalMessage
    }
  };
}

function buildEvaluationRubric(question, candidateCode) {
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
    .join("\n") + `\n\nSubmitted code excerpt:\n${question.code_snippet || candidateCode || "No code submitted."}`;
}

async function evaluateNode(state) {
  const { answer, questionObj, session, classification } = state;
  const interviewState = session.interviewState;
  
  let evaluation;
  if (classification.skip) {
    evaluation = {
      final_score: 0,
      flag: "SKIPPED",
      gate_decision: "SKIPPED",
      gate_reason: "Candidate explicitly skipped this question.",
      confidence: 1,
      best_breakdown: {},
      teacher_feedback: { what_went_well: [], what_was_missing: ["Question skipped."], better_answer: "" },
    };
  } else {
    evaluation = await evaluateAnswer({
      qid: questionObj.qid,
      question: questionObj.question,
      rubric: buildEvaluationRubric(questionObj, interviewState.candidateCode),
      answer: answer,
    });
  }
  
  return { evaluation };
}

async function updateProfileNode(state) {
  const { answer, questionObj, session, evaluation, classification } = state;
  const interviewState = session.interviewState;
  
  const contradictions = detectContradictions(interviewState, questionObj, answer);
  const outcome = recordEvaluation(interviewState, questionObj, answer, evaluation, classification.skip);
  
  CandidateProfile.recordAnswer(
    interviewState.candidateProfile,
    {
        questionId: questionObj.qid,
        classification: outcome,
        score: Number(evaluation.final_score || 0) * 20,
        concepts: questionObj.concept_tags || questionObj.source_concepts || [],
        relevanceScore: 100,
        timestamp: new Date()
    }
  );

  for (const contradiction of contradictions) {
    CandidateProfile.recordContradiction(interviewState.candidateProfile, contradiction);
  }

  const competency = Object.entries(evaluation.competencies || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "technicalKnowledge";

  EvidenceEngine.record(
    interviewState.evidenceStore,
    {
        questionId: questionObj.qid,
        competency,
        concept: (questionObj.concept_tags || questionObj.source_concepts || [])[0] || "General",
        candidateAnswer: answer,
        evaluatorScore: Number(evaluation.final_score || 0) * 20,
        confidence: Number(evaluation.confidence || 0) * 100,
        classification: outcome,
        reason: evaluation.evidence?.reasoning || evaluation.reasoning || "",
        codeEvidence: ""
    }
  );
  
  return { outcome, contradictions };
}

async function selectNextQuestionNode(state) {
  const { session } = state;
  const interviewState = session.interviewState;
  
  const nextQ = nextQuestion(interviewState, session.questions);
  
  return {
    result: {
      acknowledged: true,
      advance: true,
      classification: state.classification.skip ? "Skip" : "Answer",
      complete: nextQ === null
    }
  };
}

function routeAfterClassification(state) {
  const { classification } = state;
  if (classification.rephrase) {
    return "rephraseNode";
  } else if (classification.blocking) {
    return "blockingNode";
  } else {
    return "evaluateNode";
  }
}

const builder = new StateGraph({ channels: graphState })
  .addNode("classifyNode", classifyNode)
  .addNode("rephraseNode", handleRephraseNode)
  .addNode("blockingNode", handleBlockingNode)
  .addNode("evaluateNode", evaluateNode)
  .addNode("updateProfileNode", updateProfileNode)
  .addNode("selectNextQuestionNode", selectNextQuestionNode)
  
  .addEdge(START, "classifyNode")
  .addConditionalEdges("classifyNode", routeAfterClassification, {
    rephraseNode: "rephraseNode",
    blockingNode: "blockingNode",
    evaluateNode: "evaluateNode"
  })
  .addEdge("rephraseNode", END)
  .addEdge("blockingNode", END)
  .addEdge("evaluateNode", "updateProfileNode")
  .addEdge("updateProfileNode", "selectNextQuestionNode")
  .addEdge("selectNextQuestionNode", END);

const interviewGraph = builder.compile();

module.exports = { interviewGraph, buildEvaluationRubric };
