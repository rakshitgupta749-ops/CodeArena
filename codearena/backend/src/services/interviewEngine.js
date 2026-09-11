/**
 * Stateful interview policy. This module deliberately performs cheap, deterministic
 * safety/relevance checks before invoking an evaluator or changing interview state.
 */


const IRRELEVANT_WARNING_LIMIT = 5;
const UNPROFESSIONAL_WARNING_LIMIT = 3;

const PHASES = ["greeting", "code_review", "concept_questions", "adaptive_follow_ups", "weak_area_assessment", "final_assessment", "summary"];
const INJECTION = [/ignore\s+(?:all\s+)?(?:previous|prior|above).*?(?:instructions?|prompt|rules?)/i, /reveal\s+(?:the\s+)?(?:system|prompt)/i, /assume\s+all\s+answers?\s+(?:are\s+)?correct/i, /\[\s*(?:system|inst)\b/i];
const ABUSE = /\b(fuck|shit|bitch|asshole|idiot|moron)\b/i;
// Only an intentional skip advances the interview. "I don't know" is recorded
// as an incomplete answer and keeps the candidate on the question.
const SKIP = /^(?:skip(?:\s+(?:this|the)?\s*question)?|pass|i\s*(?:do not|don't)\s*know)\.?$/i;
const UNCERTAINTY = /\b(?:i\s*(?:do not|don't)\s*know|not sure|maybe|probably|i think)\b/i;
const STOP_WORDS = new Set("the a an and or of to in on for with is are what why how explain describe does do this that it be from about when where which your code answer".split(" "));
const CandidateProfile = require("./candidateProfile");
const ConceptGraph = require("./conceptGraph");
const AdaptiveQuestionSelector = require("./adaptiveQuestionSelector");
const { callJsonLlm } = require("./llmClient");
const { analyzeCandidateInput } = require("./security/candidateSecurity");

function addUnique(array, value) {
    if (!array.includes(value)) {
        array.push(value);
    }
}

function remove(array, value) {
    return array.filter(item => item !== value);
}

function words(value) {
  return [...new Set(String(value || "").toLowerCase().match(/[a-z][a-z0-9_]{2,}/g) || [])]
    .filter((word) => !STOP_WORDS.has(word));
}

function initialiseState({ submission, questions, conceptExtraction }) {
  const concepts = [...new Set((questions || []).flatMap((q) => q.concept_tags || q.source_concepts || []))];
  return {
    version: 1,
    codingProblem: submission?.problem?.title || "Coding challenge",
    difficulty: submission?.problem?.difficulty || "Medium",
    programmingLanguage: submission?.language || "Java",
    candidateCode: submission?.code || "",
    phase: "code_review",
    currentQuestionId: questions?.[0]?.qid || null,
    
    initialConcepts: concepts,
    conceptsSeen: [],
    conceptsCovered: [],
    conceptsNotCovered: [...concepts],
    weakConcepts: [],
    strongConcepts: [],
    conceptsMastered: [],
    
    previousMistakes: [],
    answerHistory: [],
    
    askedQuestions: questions?.[0] ? [questions[0].qid] : [],
    completedQuestions: [],
    skippedQuestions: [],
    rephraseCount: {},
    
    questionsAnswered: 0,
    lastQuestionId: null,
    lastOutcome: null,
    lastScore: null,
    lastEvaluation: null,
    lastUpdated: null,

    followUpQuestions: [],
    conceptEvidence: {},
    contradictions: [],
    warnings: [],
    warningCount: 0,
    confidence: "Medium",
    professionalismScore: 100,
    integrityScore: 100,
    currentDifficulty: "intermediate",
    codeFeatures: conceptExtraction || null,
    terminated: false,
    terminationType: null,
    terminationReason: null,
    terminationTimestamp: null,
    irrelevantWarningCount: 0,
    unprofessionalWarningCount: 0,
    candidateProfile: CandidateProfile.createProfile(),

    conceptGraph:ConceptGraph.createGraph(
    conceptExtraction
),

    plannerState: {
      currentObjective: "code_review",
      revisitQueue: [],
      completedObjectives: [],
      difficulty: "intermediate"},
  };
}

async function classifyResponse(answer, question) {
  const text = String(answer || "").trim();
  if (!text) return { classification: "Empty", blocking: true, reason: "Please provide an answer or type Skip." };
  
  if (SKIP.test(text)) return { classification: "Skip", skip: true, reason: "Question skipped." };
  if (/^\s*(?:public\s+class|function\s+|def\s+|#include|const\s+\w+\s*=)/im.test(text)) return { classification: "Code Submission", blocking: false };
  
  try {
    const mlResult = await analyzeCandidateInput(text);
    if (mlResult && mlResult.label === "PROMPT_INJECTION") {
      return { classification: "Abusive", blocking: true, warning: "prompt_injection", reason: "Assessment instructions cannot be changed. Please answer the current question or type Skip." };
    }
    if (mlResult && mlResult.label === "GENUINE_ABUSE") {
      return { classification: "Abusive", blocking: true, warning: "abusive_language", reason: "Please keep the interview professional and answer the current question or type Skip." };
    }
  } catch (err) {
    console.error("[interviewEngine] ML Security check failed, proceeding to standard classifier:", err);
  }
  
  const systemPrompt = `You are a lightweight intent classifier for a technical interview.
Classify the candidate's message into exactly one of the following categories, based on this priority order:

1. UNPROFESSIONAL: The message contains abusive, highly offensive, or clearly inappropriate language.
2. REPHRASE_REQUEST: The candidate is asking the interviewer to explain, rephrase, repeat, or clarify the question.
3. TECHNICAL_ANSWER: The candidate is attempting to answer the question, even if the answer is incorrect, partial, or poor.
4. IRRELEVANT: The message is completely unrelated to the interview or question.

Examples:
- "Can you rephrase this question?" -> REPHRASE_REQUEST
- "Rephrase this stupid fucking question." -> UNPROFESSIONAL
- "I think it uses a loop." -> TECHNICAL_ANSWER

Return ONLY valid JSON with no markdown formatting:
{
  "classification": "UNPROFESSIONAL" | "REPHRASE_REQUEST" | "TECHNICAL_ANSWER" | "IRRELEVANT",
  "reason": "Brief reason for classification"
}`;

  const userPrompt = `Question: "${question?.question || ""}"
Candidate Message: "${text}"`;

  try {
    const result = await callJsonLlm({
      systemPrompt,
      userPrompt,
      model: process.env.GROQ_FAST_MODEL,
      fallbackModel: process.env.GROQ_FALLBACK_MODEL,
      temperature: 0.0,
      maxTokens: 100,
      taskName: "MESSAGE_CLASSIFICATION"
    });

    switch(result.classification) {
      case "UNPROFESSIONAL":
        return { classification: "Abusive", blocking: true, warning: "abusive_language", reason: "Please keep the interview professional and answer the current question or type Skip." };
      case "REPHRASE_REQUEST":
        return { classification: "RephraseRequest", rephrase: true, blocking: true, reason: "User requested rephrase or clarification." };
      case "IRRELEVANT":
        return { classification: "Irrelevant", blocking: true, warning: "irrelevant_answer", reason: "Your answer appears unrelated to the current question. Please answer it or type Skip if you wish to move on." };
      case "TECHNICAL_ANSWER":
      default:
        return { classification: "Answer", blocking: false };
    }
  } catch (err) {
    console.error("[interviewEngine] Classification failed, falling back to basic checks:", err);
    if (ABUSE.test(text)) return { classification: "Abusive", blocking: true, warning: "abusive_language", reason: "Please keep the interview professional and answer the current question or type Skip." };
    return { classification: "Answer", blocking: false };
  }
}

function applyWarning(state, warning) {
  if (!warning) return;
  state.lastWarning = { type: warning, timestamp: new Date() };
  state.warnings.push({ type: warning, at: new Date() });
  
  if (["abusive_language", "prompt_injection"].includes(warning)) {
    state.unprofessionalWarningCount = (state.unprofessionalWarningCount || 0) + 1;
    state.integrityScore = Math.max(0, state.integrityScore - (warning === "abusive_language" ? 20 : 10));
    state.professionalismScore = Math.max(0, state.professionalismScore - (warning === "abusive_language" ? 25 : 5));
    
    if (state.unprofessionalWarningCount >= UNPROFESSIONAL_WARNING_LIMIT) {
      state.terminated = true;
      state.terminationType = "UNPROFESSIONAL_LIMIT";
      state.terminationReason = "Interview terminated after reaching the maximum number of unprofessional-behaviour warnings.";
      state.terminationTimestamp = new Date();
    }
  } else if (["irrelevant_answer", "gibberish"].includes(warning)) {
    state.irrelevantWarningCount = (state.irrelevantWarningCount || 0) + 1;
    
    if (state.irrelevantWarningCount >= IRRELEVANT_WARNING_LIMIT) {
      state.terminated = true;
      state.terminationType = "IRRELEVANT_LIMIT";
      state.terminationReason = "Interview terminated after reaching the maximum number of irrelevant-response warnings.";
      state.terminationTimestamp = new Date();
    }
  }
  
  switch (warning) {
    case "abusive_language":
        CandidateProfile.recordWarning(state.candidateProfile, "abuse");
        break;
    case "prompt_injection":
        CandidateProfile.recordWarning(state.candidateProfile, "prompt_injection");
        break;
    case "irrelevant_answer":
        CandidateProfile.recordWarning(state.candidateProfile, "irrelevant");
        break;
    case "skip":
        CandidateProfile.recordWarning(state.candidateProfile, "skip");
        break;
    default:
        break;
  }
}


function detectContradictions(state, question, answer) {
  const topic = (question?.concept_tags || [])[0];
  if (!topic) return [];
  const normalized = String(answer).toLowerCase();
  const prior = state.answerHistory.find((item) => item.topic === topic && item.answer !== normalized);
  if (!prior) return [];
  const complexity = /o\s*\(\s*(1|n|log\s*n|n\s*log\s*n|n\^2)\s*\)/gi;
  const previousClaim = prior.answer.match(complexity)?.[0];
  const currentClaim = normalized.match(complexity)?.[0];
  if (previousClaim && currentClaim && previousClaim !== currentClaim) {
    const contradiction = { topic, earlier: previousClaim, later: currentClaim, qid: question.qid };
    state.contradictions.push(contradiction);
    state.integrityScore = Math.max(0, state.integrityScore - 5);
    return [contradiction];
  }
  return [];
}

function nextQuestion(state, questions) {

    const result =
        AdaptiveQuestionSelector.selectNextQuestion({

            state,

            profile: state.candidateProfile,

            graph: state.conceptGraph,

            questions

        });

    if (result.interviewComplete) {

        state.phase = "final_assessment";

        return null;

    }

    const chosen = result.nextQuestion;

    if (
        chosen?.qid &&
        !state.askedQuestions.includes(chosen.qid)
    ) {
        state.askedQuestions.push(chosen.qid);
    }

    state.currentQuestionId = chosen.qid;

    state.phase =
        state.weakConcepts.length
            ? "adaptive_follow_ups"
            : "concept_questions";

    state.adaptiveLog = state.adaptiveLog || [];
    if (chosen) {
        state.adaptiveLog.push({
            qid: chosen.qid,
            concept: result.targetConcept || (chosen.concept_tags || chosen.source_concepts || [])[0],
            difficulty: result.difficulty || chosen.difficulty,
            selectionReason: result.reason,
            timestamp: new Date(),
            priorityScore: result.priority,
            weakState: state.weakConcepts?.includes(result.targetConcept || (chosen.concept_tags || [])[0]),
            masteredState: state.conceptsMastered?.includes(result.targetConcept || (chosen.concept_tags || [])[0])
        });
    }

    return chosen;

}

function recordEvaluation(
    state,
    question,
    answer,
    evaluation,
    skipped
) {
    const rawScore = evaluation?.final_score;
    const parsedScore = Number(rawScore);

    const score = Number.isFinite(parsedScore)
        ? parsedScore
        : null;

    let outcome;

    if (skipped) {
        outcome = "Skip";
    } else if (score === null) {
        outcome = "Evaluation Failed";
    } else if (score >= 4) {
        outcome = "Correct";
    } else if (score >= 2) {
        outcome = "Partially Correct";
    } else {
        outcome = "Incorrect";
    }

    const concepts = [
        ...new Set(
            question?.concept_tags ||
            question?.source_concepts ||
            []
        )
    ];

    state.initialConcepts ??= [];
    state.conceptsSeen ??= [];
    state.conceptsCovered ??= [];
    state.conceptsNotCovered ??= [];

    state.weakConcepts ??= [];
    state.strongConcepts ??= [];
    state.conceptsMastered ??= [];

    state.previousMistakes ??= [];
    state.skippedQuestions ??= [];
    state.completedQuestions ??= [];
    state.askedQuestions ??= [];
    state.answerHistory ??= [];

    state.conceptsSeen = [
        ...new Set([
            ...state.conceptsSeen,
            ...concepts
        ])
    ];

    state.conceptsNotCovered =
        state.initialConcepts.filter(
            concept => !state.conceptsSeen.includes(concept)
        );

    for (const concept of concepts) {
        if (outcome === "Correct") {
            addUnique(state.conceptsCovered, concept);
            addUnique(state.strongConcepts, concept);
            addUnique(state.conceptsMastered, concept);

            state.weakConcepts = remove(state.weakConcepts, concept);
        } else if (outcome === "Partially Correct") {
            addUnique(state.weakConcepts, concept);

            state.conceptsCovered = remove(state.conceptsCovered, concept);
            state.conceptsMastered = remove(state.conceptsMastered, concept);
            state.strongConcepts = remove(state.strongConcepts, concept);
        } else if (outcome === "Incorrect") {
            addUnique(state.weakConcepts, concept);

            state.conceptsCovered = remove(state.conceptsCovered, concept);
            state.conceptsMastered = remove(state.conceptsMastered, concept);
            state.strongConcepts = remove(state.strongConcepts, concept);
        }
    }

    if (
        outcome === "Incorrect" ||
        outcome === "Partially Correct"
    ) {
        state.previousMistakes.push({
            qid: question.qid,
            concepts,
            outcome,
            score
        });
    }

    if (outcome === "Skip") {
        if (!state.skippedQuestions.includes(question.qid)) {
            state.skippedQuestions.push(question.qid);
        }
    } else if (outcome !== "Evaluation Failed") {
        if (!state.completedQuestions.includes(question.qid)) {
            state.completedQuestions.push(question.qid);
        }
    }

    state.answerHistory.push({
        qid: question.qid,
        topic: concepts[0] || null,
        concepts,
        answer: String(answer || "").trim(),
        outcome,
        score,
        timestamp: new Date()
    });

    state.questionsAnswered = (state.questionsAnswered || 0) + 1;
    state.lastQuestionId = question.qid;
    state.lastOutcome = outcome;
    state.lastScore = score;
    state.lastEvaluation = evaluation;
    state.lastUpdated = new Date();

    console.log("[STATE AFTER EVALUATION]", {
        qid: question.qid,
        outcome,

        conceptsSeen: state.conceptsSeen,
        conceptsNotCovered: state.conceptsNotCovered,
        conceptsCovered: state.conceptsCovered,

        weakConcepts: state.weakConcepts,
        strongConcepts: state.strongConcepts,
        conceptsMastered: state.conceptsMastered,

        askedQuestions: state.askedQuestions,
        completedQuestions: state.completedQuestions,
        skippedQuestions: state.skippedQuestions,

        phase: state.phase
    });

    const allInitialConceptsMastered =
        state.initialConcepts.length > 0 &&
        state.initialConcepts.every(
            concept =>
                state.conceptsMastered.includes(concept)
        );

    if (
        allInitialConceptsMastered &&
        state.phase === "concept_questions"
    ) {
        state.phase = "adaptive_follow_ups";
    }

    return outcome;
}

module.exports = { PHASES, initialiseState, classifyResponse, applyWarning, detectContradictions, nextQuestion, recordEvaluation, IRRELEVANT_WARNING_LIMIT, UNPROFESSIONAL_WARNING_LIMIT };
