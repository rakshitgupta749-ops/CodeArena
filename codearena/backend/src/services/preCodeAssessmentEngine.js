"use strict";

const { callJsonLlm } = require("./llmClient");

const getInterviewerPrompt =
  require("../prompts/getInterviewerPrompt");

const BASE_INTERVIEWER_PROMPT =
  require("../prompts/baseInterviewerPrompt");


const MIN_ANSWERS = 4;

const MAX_QUESTIONS = Number(
  process.env.PRE_CODE_MAX_QUESTIONS || 10
);

const RUBRICS = [
  "Understanding of the Problem",
  "Algorithm / Approach",
  "Data Structure Choice",
  "Correctness",
  "Time & Space Complexity",
  "Edge Cases",
  "OOP / Design Concepts"
];


const GENERIC_QUESTIONS = {
  "Understanding of the Problem": "In your own words, what is the core goal of this problem?",
  "Algorithm / Approach": "What high-level approach or pattern would you use to solve this problem?",
  "Data Structure Choice": "What primary data structure would you use in your solution?",
  "Correctness": "How would you verify that your solution produces the correct output?",
  "Time & Space Complexity": "What is the expected time complexity of your approach?",
  "Edge Cases": "What is one important edge case to consider for this problem?",
  "OOP / Design Concepts": "What primary class or entity would you define for this problem?"
};

const SIMPLIFIED_RECOVERY_QUESTIONS = {
  "Understanding of the Problem": "In one short sentence, what is the core goal of this problem?",
  "Algorithm / Approach": "What basic algorithmic step would you start with?",
  "Data Structure Choice": "What single data structure is most appropriate here?",
  "Correctness": "What basic check ensures the result is valid?",
  "Time & Space Complexity": "What is the expected time complexity in Big-O notation?",
  "Edge Cases": "What is one minimal boundary input to check?",
  "OOP / Design Concepts": "What single class or entity is needed first?"
};

const EXPLANATION_OR_SOLUTION_REGEX = /\b(?:can you|could you|please)?\s*(?:explain|clarify|elaborate|help me understand|what does (?:this|that) mean|what do you mean|(?:give|show|write|provide)\s+(?:me\s+)?(?:the\s+)?(?:full\s+|complete\s+|entire\s+)?(?:code|solution|answer|implementation)|how do i (?:solve|code|implement)|what is the (?:code|solution|answer)|i don't understand|i do not understand|tell me the answer)\b/i;

function isExplanationOrSolutionRequest(text) {
  if (typeof text !== "string") return false;
  return EXPLANATION_OR_SOLUTION_REGEX.test(text.trim());
}

function isNonsenseResponse(text) {
  if (typeof text !== "string") return true;
  const t = text.trim();
  if (t.length < 2) return true;
  // All same character e.g. "aaaaa", "....."
  if (/^(.)\1{3,}$/i.test(t.replace(/\s/g, ""))) return true;
  // Only non-alphanumeric e.g. "???", "!@#$%"
  if (/^[^a-z0-9]+$/i.test(t)) return true;
  // Repetitive keyboard mash e.g. "asdfasdf", "qwertyqwerty"
  if (/^(?:asdf|qwer|zxcv|hjkl){2,}$/i.test(t)) return true;
  return false;
}

function isCompoundQuestion(text) {
  if (typeof text !== "string") return false;
  const t = text.trim();
  if (!t) return false;

  // 1. Multiple question marks
  const qmarkCount = (t.match(/\?/g) || []).length;
  if (qmarkCount > 1) return true;

  // 2. Multi-part phrases
  if (/\b(?:walk me through|explain your (?:entire|complete) reasoning|list (?:all|several)|classes and (?:their )?methods|methods and (?:their )?classes|attributes and (?:their )?methods|data and (?:their )?operations)\b/i.test(t)) {
    return true;
  }

  // 3. Conjunctions joining multiple clauses/questions:
  // e.g. "and which", "and what", "and how", "and why", "and where", "and also", "as well as which", "as well as what"
  const compoundConjunctions = /\b(?:and\s+(?:which|what|how|why|where|when|who|can you|could you|would you|also)|as\s+well\s+as\s+(?:which|what|how|why|the)|along\s+with\s+(?:which|what|how|why|the))\b/i;
  if (compoundConjunctions.test(t)) {
    return true;
  }

  // 4. Combined requests like "time and space complexity", "space and time complexity", "classes and methods", "data and methods"
  if (/\b(?:time\s+and\s+space\s+complexity|space\s+and\s+time\s+complexity|classes\s+and\s+methods|data\s+and\s+methods|data\s+and\s+operations|attributes\s+and\s+methods)\b/i.test(t)) {
    return true;
  }

  // 5. "and why" or "and how" at the end of a question (e.g. "What data structure would you use, and why?")
  if (/,\s*and\s+(?:why|how)\??$/i.test(t)) {
    return true;
  }

  return false;
}

function ensureSingleBasicQuestion(rawQuestion, targetRubric, problemType) {
  if (typeof rawQuestion !== "string") {
    return GENERIC_QUESTIONS[targetRubric] || "In your own words, what is the core goal of this problem?";
  }

  let text = cleanString(rawQuestion, 500);
  if (!text) {
    return GENERIC_QUESTIONS[targetRubric] || "In your own words, what is the core goal of this problem?";
  }

  if (!isCompoundQuestion(text)) {
    return text.endsWith("?") ? text : `${text}?`;
  }

  // If compound, attempt to extract the first atomic single question
  // 1. If multiple question marks exist: take the first complete sentence ending in ?
  if ((text.match(/\?/g) || []).length > 1) {
    const firstQ = text.split("?")[0].trim();
    const candidate = `${firstQ}?`;
    if (firstQ.length >= 10 && firstQ.split(/\s+/).length >= 4 && !isCompoundQuestion(candidate)) {
      return candidate;
    }
  }

  // 2. If compound conjunction joins two questions (e.g. "... and which ...")
  const splitMatch = text.match(/^(.*?)(?:,\s*and\s+(?:why|how)|\s+(?:and|as\s+well\s+as|along\s+with)\s+(?:which|what|how|why|where|when|who|can you|could you|would you|methods|operations|classes)\b)/i);
  if (splitMatch && splitMatch[1]) {
    const candidateBase = splitMatch[1].trim();
    const candidate = candidateBase.endsWith("?") ? candidateBase : `${candidateBase}?`;
    if (candidateBase.length >= 10 && candidateBase.split(/\s+/).length >= 4 && !isCompoundQuestion(candidate)) {
      return candidate;
    }
  }

  // 3. Fallback to curated single basic question for the target rubric
  return GENERIC_QUESTIONS[targetRubric] || "In your own words, what is the core goal of this problem?";
}

function calibrateRating(rating, reason, candidateAnswer, rubric) {
  let finalRating = (rating || "weak").toLowerCase();
  const lowerReason = (reason || "").toLowerCase();

  // 1. Technically incorrect answers must be WEAK
  if (
    lowerReason.includes("technically incorrect") ||
    lowerReason.includes("incorrectly claims") ||
    lowerReason.includes("incorrect approach") ||
    lowerReason.includes("fundamentally flawed") ||
    lowerReason.includes("wrong approach") ||
    lowerReason.includes("does not work for") ||
    lowerReason.includes("invalid approach") ||
    lowerReason.includes("incorrect logic") ||
    lowerReason.includes("contradicts the problem")
  ) {
    return "weak";
  }

  // 2. Long vague / repetitive / shallow answers cannot be STRONG
  if (
    lowerReason.includes("repetitive") ||
    lowerReason.includes("vague") ||
    lowerReason.includes("shallow") ||
    lowerReason.includes("superficial") ||
    lowerReason.includes("no explanation of why") ||
    lowerReason.includes("does not explain how") ||
    lowerReason.includes("lacks explanation") ||
    lowerReason.includes("missing explanation") ||
    lowerReason.includes("generic answer")
  ) {
    if (finalRating === "strong") {
      finalRating = "average";
    }
  }

  // 3. Correct but incomplete answers should be AVERAGE
  if (
    lowerReason.includes("incomplete") ||
    lowerReason.includes("partially correct") ||
    lowerReason.includes("only mentions") ||
    lowerReason.includes("only names")
  ) {
    if (finalRating === "strong") {
      finalRating = "average";
    }
  }

  return finalRating;
}

function cleanString(value, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanArray(value, maxItems = 12) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanString(item, 180))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeStartResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error("PRE_CODE_INVALID_START_RESPONSE");
  }

  const firstQuestion = result.first_question;

  if (
    !firstQuestion ||
    typeof firstQuestion.question !== "string" ||
    !firstQuestion.question.trim()
  ) {
    throw new Error("PRE_CODE_MISSING_FIRST_QUESTION");
  }

  return {
    problemType:
      cleanString(result.problem_type, 80) || "other",

    problemSummary:
      cleanString(result.problem_summary, 500),

    relevantConcepts:
      cleanArray(result.relevant_concepts),

    evaluationAreas:
      Array.isArray(result.evaluation_areas)
        ? result.evaluation_areas
          .map((item) => ({
            area: cleanString(item?.area, 100),
            description: cleanString(item?.description, 300),
          }))
          .filter((item) => item.area)
        : [],

    firstQuestion: {
      qid:
        cleanString(firstQuestion.qid, 80) || "pre_q1",

      question:
        ensureSingleBasicQuestion(
          cleanString(firstQuestion.question, 500),
          "Understanding of the Problem",
          result.problem_type
        ),

      targetArea:
        "Understanding of the Problem",
    },
  };
}

function normalizeResponseResult(result, candidateAnswer = "", currentRubric = "") {
  if (!result || typeof result !== "object") {
    throw new Error("PRE_CODE_INVALID_RESPONSE");
  }

  const allowedClassifications = new Set([
    "strong",
    "partial",
    "incorrect",
    "clarification",
    "uncertainty",
    "solution_request",
    "prompt_injection",
    "off_topic",
    "non_responsive",
  ]);

  const allowedDecisions = new Set([
    "continue",
    "pass",
    "fail",
    "terminate",
    "finalize",
  ]);

  const classification = allowedClassifications.has(
    result.response_classification
  )
    ? result.response_classification
    : "partial";

  let decision = allowedDecisions.has(result.decision)
    ? result.decision
    : "continue";

  const evaluation = result.evaluation || {};

  // The LLM sometimes places the rating at the top level (result.rating)
  // instead of inside result.evaluation.rating. Check both before defaulting.
  const resolvedRating =
    cleanString(evaluation.rating, 20) ||
    cleanString(result.rating, 20) ||
    "weak";

  const resolvedReason =
    cleanString(evaluation.reason, 500) ||
    cleanString(result.reason, 500) ||
    "";

  const calibratedRating = calibrateRating(
    resolvedRating,
    resolvedReason,
    candidateAnswer,
    currentRubric
  );

  const evidence = Array.isArray(evaluation.evidence)
    ? evaluation.evidence
      .map((item) => ({
        area: cleanString(item?.area, 100),
        status: cleanString(item?.status, 40),
        reason: cleanString(item?.reason, 300),
      }))
      .filter((item) => item.area)
    : [];

  const rawNextQuestion =
    result.next_question ||
    (
      typeof result.question === "string" ||
        typeof result.text === "string"
        ? {
          qid: result.qid || result.questionId,
          question: result.question || result.text,
          target_area: result.target_area || result.targetArea,
        }
        : null
    );

  // Clarification / explanation requests must be treated as probe on current rubric, not a free pass
  const rubricStatus = result.rubric_status === "clarification"
    ? "probe"
    : (["completed", "probe"].includes(result.rubric_status) ? result.rubric_status : "completed");

  const targetArea = rubricStatus === "probe"
    ? currentRubric
    : (cleanString(rawNextQuestion?.target_area || rawNextQuestion?.targetArea, 100) || currentRubric);

  const nextQuestion =
    rawNextQuestion &&
      typeof rawNextQuestion.question === "string" &&
      rawNextQuestion.question.trim()
      ? {
        qid:
          cleanString(rawNextQuestion.qid, 80) ||
          "pre_followup",
        question:
          ensureSingleBasicQuestion(
            cleanString(rawNextQuestion.question, 500),
            targetArea || currentRubric
          ),
        targetArea:
          targetArea || currentRubric,
      }
      : null;

  if (
    decision === "terminate"
  ) {
    return {
      responseClassification: classification,
      rubricStatus,
      evaluation: {
        rating: calibratedRating,
        overall:
          cleanString(evaluation.overall, 40) || "partial",

        reason: resolvedReason,

        evidence,

        newlyEstablished:
          cleanArray(evaluation.newly_established),

        stillMissing:
          cleanArray(evaluation.still_missing),

        misconceptions:
          cleanArray(evaluation.misconceptions),
      },

      decision: "terminate",

      // Keep the LLM's proposed next question available.
      // The application policy below decides whether it is actually used.
      nextQuestion,

      interviewerMessage:
        cleanString(result.interviewer_message, 500),
    };
  }

  return {
    responseClassification: classification,
    rubricStatus,
    evaluation: {
      rating: calibratedRating,
      overall:
        cleanString(evaluation.overall, 40) || "partial",
      reason: resolvedReason,
      evidence,
      newlyEstablished:
        cleanArray(evaluation.newly_established),
      stillMissing:
        cleanArray(evaluation.still_missing),
      misconceptions:
        cleanArray(evaluation.misconceptions),
    },
    decision: "continue",
    nextQuestion,
    interviewerMessage:
      cleanString(result.interviewer_message, 500),
  };
}

/*
 * Stable assessment context.
 *
 * This is deliberately kept in the system prompt so that the same
 * assessment prefix can be reused by Groq's automatic prompt cache
 * across subsequent RESPONSE calls.
 */
function buildAssessmentSystemPrompt({
  problem,
  assessment
}) {

  return `${getInterviewerPrompt(
    assessment?.problemType
  )}

ASSESSMENT CONTEXT
This context is fixed for the lifetime of this assessment.

ASSIGNED CODING PROBLEM
Title:
${problem.title || ""}

Difficulty:
${problem.difficulty || ""}

Description:
${problem.description || ""}

Constraints:
${problem.constraints || ""}

Sample Input:
${problem.sampleInput || ""}

Sample Output:
${problem.sampleOutput || ""}

ASSESSMENT ANALYSIS
${JSON.stringify(
    assessment?.cacheContext || {},
    null,
    2
  )}
`;
}

async function startAssessment({ problem }) {
  if (!problem) {
    throw new Error("PRE_CODE_PROBLEM_REQUIRED");
  }

  const userPrompt = `
  START A NEW PRE-CODE ASSESSMENT.

  PROBLEM
  Title: ${problem.title || ""}
  Difficulty: ${problem.difficulty || ""}
  Description: ${problem.description || ""}
  Constraints: ${problem.constraints || ""}
  Sample Input: ${problem.sampleInput || ""}
  Sample Output: ${problem.sampleOutput || ""}

  Identify:
  1. problem type: DSA, OOP, or Other
  2. the most relevant concepts
  3. the important evaluation areas
  4. one strong first interview question

  The first_question must be exactly ONE useful technical interview question specifically targeting the rubric: "Understanding of the Problem".

  Return ONLY the required JSON.
  `;

  /*
   * START has no existing assessment yet, so we must use the base
   * system prompt here. The assessment-specific cacheable context
   * is created for subsequent RESPONSE calls after START returns.
   */
  const result = await callJsonLlm({
    systemPrompt: `
  You are preparing a pre-code technical assessment.

  Analyze the coding problem and return ONLY valid JSON.

  The JSON MUST contain:
  - problem_type: exactly "DSA", "OOP", or "Other"
  - problem_summary
  - relevant_concepts: array
  - evaluation_areas: array of objects with area and description
  - first_question: object containing qid, question, and target_area

  The first_question must be strictly ONE single, very basic question testing ONE simple concept targeting the rubric "Understanding of the Problem".
  The question MUST be VERY BASIC and SINGLE-PURPOSE. It must be short (preferably one sentence).
  NEVER combine multiple requirements or questions with "and".
  NEVER ask for deep explanations, multi-part answers, or generic walk-throughs.

  Do not evaluate a candidate yet.
  Do not return response_classification.
  Do not return decision.
  Do not return evaluation.
  `,
    userPrompt,
    model: process.env.GROQ_QUESTION_MODEL,
    fallbackModel: process.env.GROQ_FALLBACK_MODEL,
    temperature: 0.2,
    maxTokens: 1200,
  });

  return normalizeStartResult(result);
}

async function processResponse({
  problem,
  assessment,
  candidateAnswer,
}) {
  if (!problem) {
    throw new Error("PRE_CODE_PROBLEM_REQUIRED");
  }

  if (!assessment) {
    throw new Error("PRE_CODE_ASSESSMENT_REQUIRED");
  }

  const conversation = Array.isArray(assessment.conversation)
    ? assessment.conversation
    : [];

  const evidence = Array.isArray(assessment.evidence)
    ? assessment.evidence
    : [];

  const unevaluatedRubrics = RUBRICS.filter(
    (r) => !(assessment.completedRubrics || []).includes(r)
  );

  /*
   * The stable problem/assessment context is now in the SYSTEM prompt.
   *
   * We intentionally keep the conversation history because it is
   * important for adaptive interview quality.
   */
  let userPrompt = `
CONTINUE AN EXISTING PRE-CODE ASSESSMENT.

CURRENT QUESTION
${assessment.currentQuestion || ""}

CONVERSATION HISTORY
${JSON.stringify(conversation.slice(-4), null, 2)}

LATEST CANDIDATE ANSWER
${candidateAnswer || ""}

CURRENT RUBRIC: ${assessment.currentRubric}
COMPLETED RUBRICS: ${(assessment.completedRubrics || []).join(", ")}
UNEVALUATED RUBRICS: ${unevaluatedRubrics.join(", ")}
PROBE USED FOR CURRENT RUBRIC: ${assessment.rubricState?.[assessment.currentRubric]?.probeUsed ? "Yes" : "No"}
PROBLEM TYPE CONTEXT: ${assessment.problemType}

Evaluate the latest candidate answer as part of the COMPLETE assessment.
Adapt your interpretation of the CURRENT RUBRIC based on the PROBLEM TYPE CONTEXT:
- For DSA: focus on data structures, algorithmic efficiency, big-O, boundary values.
- For OOP/Design: focus on class responsibility, abstraction, encapsulation, relationships, and tradeoffs.
- For other types: apply the rubric appropriately to the domain.
`;

  userPrompt += `
For the CURRENT RUBRIC (${assessment.currentRubric}), evaluate the candidate's answer based on the EVALUATION SCORING RULES:

- A genuinely STRONG answer:
  * Mark rubric_status as "completed" and rating as "strong".
  * Propose next_question for the next unevaluated rubric. Do NOT probe.

- A genuinely AVERAGE answer:
  * Evaluate whether there is a genuine, useful follow-up opportunity:
    - If the response contains a meaningful gap, ambiguity, or incomplete part that can reasonably be tested with ONE additional basic question (and probeUsed is "No"):
      Mark rubric_status as "probe".
      Propose next_question on the SAME CURRENT RUBRIC (${assessment.currentRubric}), generated directly from the candidate's actual response and original question, focusing specifically on the missing piece.
    - If there is NO meaningful follow-up opportunity or the answer is sufficient for Average:
      Mark rubric_status as "completed" and rating as "average". Propose next_question for the next unevaluated rubric. Do NOT force an arbitrary probe.

- A WEAK, UNRELATED, NONSENSE, EXPLANATION-REQUEST, or SOLUTION-REQUEST response:
  * Examples: candidate gives an off-topic answer, random text/nonsense, asks "Can you explain this?", "I don't understand", "What does this mean?", or asks for code/solution.
  * You are an evaluator, not a tutor. NEVER provide explanations, tutorials, hints, code, or solutions.
  * NEVER use candidate-facing failure labels like "unrelated", "irrelevant", or "solution request".
  * Treat this response as insufficient/Weak evidence for the CURRENT RUBRIC (${assessment.currentRubric}).
  * If probeUsed is "No":
    - Mark rubric_status as "probe" for the SAME CURRENT RUBRIC (${assessment.currentRubric}).
    - The next_question MUST be a simpler, shorter recovery probe testing the SAME core concept as the original question (not a new topic).
  * If probeUsed is "Yes":
    - You MUST mark rubric_status as "completed" and rating as "weak".
    - Propose next_question for the next unevaluated rubric.

When returning JSON, include:
- rubric_status: exactly "completed" or "probe".
- next_question: { "qid": "...", "question": "...", "target_area": "..." }
  - The 'question' MUST be strictly ONE very basic question testing ONE simple concept. It must be short (one sentence).
  - NEVER combine multiple concepts with "and", multiple requested fields, or multiple sub-tasks.
    BAD: "Which data should the class store AND which methods should it provide?"
    GOOD: "What data should the class store?"
  - NEVER ask "walk me through...", "explain your complete reasoning...", multi-part questions, or combine choices with justifications.
  - The question MUST NEVER leak the rubric name or internal evaluation terminology (e.g., do NOT say "could you explain your thoughts on Edge Cases" or "you failed"). Just ask a basic technical question.
  - If rubric_status is "probe", the target_area MUST BE THE CURRENT RUBRIC (${assessment.currentRubric}).
  - If rubric_status is "completed", the target_area MUST EXACTLY MATCH ONE of the UNEVALUATED RUBRICS.
- evaluation: normal evaluation fields. IF rubric_status is "completed", you MUST also include a final 'rating' ("weak", "average", or "strong") and a concise 1-2 sentence 'reason' for that rating based on the evidence.

SCORING CALIBRATION & BALANCED EVALUATION:
Internally identify:
1. Is the answer correct?
   - A technically incorrect, invalid, or fundamentally flawed answer MUST be rated WEAK. Confident tone or detailed wording MUST NOT upgrade an incorrect answer to Average or Strong.
2. What is the minimum essential knowledge for this specific rubric and question?
3. What did the candidate actually demonstrate?
   - STRONG: Correct AND demonstrates the essential knowledge for that rubric with sufficient reasoning/understanding.
     * A short answer can absolutely be Strong if it demonstrates all essential knowledge expected by that rubric. Do NOT downgrade a concise but complete answer simply because it is short.
     * Do not require unnecessary verbosity or artificial depth for Strong.
   - AVERAGE: Generally correct/basic understanding, but one or more meaningful elements are missing or unclear.
     * A long answer can still be Average or Weak if it is vague, repetitive, or misses essential knowledge. Never upgrade repetitive fluff to Strong.
     * Correct choice without explaining how it works is AVERAGE.
   - WEAK: Incorrect, fundamentally misunderstood, extremely insufficient, or unable to demonstrate the required basic concept.
     * Unrelated answers or guesses are WEAK.

ANTI-BIAS RULES:
- Length does NOT determine rating. Judge substance, not length.
- Confidence does NOT determine rating. "I think" must not be penalized, and confident tone must not upgrade wrong answers.
`;

  /*
   * The system prompt now contains the stable assessment context.
   * This is the prefix we want Groq to cache across RESPONSE calls.
   */
  const result = await callJsonLlm({
    systemPrompt: buildAssessmentSystemPrompt({
      problem,
      assessment,
    }),
    userPrompt,
    model: process.env.GROQ_EVALUATION_MODEL || process.env.GROQ_QUESTION_MODEL,
    fallbackModel: process.env.GROQ_FALLBACK_MODEL,
    temperature: 0.2,
    maxTokens: 1600,
  });

  const normalized = normalizeResponseResult(result, candidateAnswer, assessment.currentRubric);

  console.log(`\n=== PRE-CODE EVALUATION (Question: ${assessment.currentQuestion || "Unknown"}) ===`);
  console.log(`Candidate Answer: ${candidateAnswer || ""}`);
  console.log(`Rubric: ${assessment.currentRubric}`);
  console.log(`Raw LLM Result:`, JSON.stringify(result, null, 2));
  console.log(`Normalized Evaluation:`, JSON.stringify(normalized.evaluation, null, 2));
  console.log(`Decision: ${normalized.decision}, Rubric Status: ${normalized.rubricStatus}`);
  if (normalized.nextQuestion) {
    console.log(`Next Question Target: ${normalized.nextQuestion.targetArea}`);
    console.log(`Next Question: ${normalized.nextQuestion.question}`);
  }
  console.log(`========================================================\n`);

  if (
    normalized.decision === "pass" ||
    normalized.decision === "fail" ||
    normalized.decision === "terminate"
  ) {
    normalized.decision = "continue";
  }

  // Strictly enforce probe target is the current rubric
  if (normalized.rubricStatus === "probe") {
    if (normalized.nextQuestion) {
      normalized.nextQuestion.targetArea = assessment.currentRubric;
    }
  }

  // Strictly enforce max one probe per rubric in the code
  if (normalized.rubricStatus === "probe" && assessment.rubricState?.[assessment.currentRubric]?.probeUsed) {
    console.log("[PreCodeEngine] Overriding second probe to completed.");
    normalized.rubricStatus = "completed";
  }

  return normalized;
}

/*
 * Final evaluation of the complete pre-code assessment.
 *
 * This is used only when:
 * - Q10 has been reached, or
 * - the assessment timer expires.
 *
 * It evaluates the accumulated evidence, not just the latest answer.
 */
async function finalizeAssessment({
  problem,
  assessment,
}) {
  if (!problem) {
    throw new Error("PRE_CODE_PROBLEM_REQUIRED");
  }

  if (!assessment) {
    throw new Error("PRE_CODE_ASSESSMENT_REQUIRED");
  }

  let strongCount = 0;
  let averageCount = 0;
  let totalRubricPoints = 0;
  const summary = [];

  RUBRICS.forEach((r) => {
    const state = assessment.rubricState?.[r] || {};
    const rating = state.rating || "weak";
    const reason = state.reason || "Not assessed due to time constraints or early termination.";

    if (rating === "strong") {
      strongCount++;
      totalRubricPoints += 100;
    } else if (rating === "average") {
      averageCount++;
      totalRubricPoints += 70;
    } else {
      totalRubricPoints += 35;
    }

    summary.push({
      rubric: r,
      rating,
      reason
    });
  });

  const calculatedPreCodeScore = Math.round(totalRubricPoints / RUBRICS.length);
  assessment.preCodeScore = calculatedPreCodeScore;

  // Build structured intent profile
  const candidateMessages = (assessment.conversation || [])
    .filter(m => m.role === "candidate")
    .map(m => m.text);

  const getRubricReason = (rubricName) => {
    return assessment.rubricState?.[rubricName]?.reason || "";
  };

  assessment.intentProfile = {
    problemUnderstanding: getRubricReason("Understanding of the Problem"),
    claimedAlgorithm: getRubricReason("Algorithm / Approach"),
    claimedDataStructures: getRubricReason("Data Structure Choice"),
    claimedComplexity: getRubricReason("Time & Space Complexity"),
    identifiedEdgeCases: getRubricReason("Edge Cases"),
    oopDesign: getRubricReason("OOP / Design Concepts"),
    candidateResponsesSummary: candidateMessages.slice(-5).join(" | "),
    score: calculatedPreCodeScore,
  };

  assessment.rubricSummary = summary;
  if (typeof assessment.markModified === "function") {
    assessment.markModified("rubricSummary");
    assessment.markModified("intentProfile");
    assessment.markModified("preCodeScore");
  }

  // PASS requires R1 NOT weak, AND either:
  //   (a) at least 2 strong AND a total of at least 4 passing rubrics, OR
  //   (b) a total of at least 5 passing rubrics.
  // Strong ratings now contribute to the total passing count.
  const firstRubricState = assessment.rubricState?.[RUBRICS[0]] || {};
  const firstRubricRating = firstRubricState.rating || "weak";

  const totalPassing = strongCount + averageCount;

  const hasMinRatings =
    (strongCount >= 2 && totalPassing >= 4) || (totalPassing >= 5);
  const passed = hasMinRatings && firstRubricRating !== "weak";

  return {
    decision: passed ? "pass" : "fail",
    rubricSummary: summary,
    interviewerMessage: "The pre-code assessment is complete.",
    nextQuestion: null
  };
}

module.exports = {
  startAssessment,
  processResponse,
  finalizeAssessment,
  MIN_ANSWERS,
  MAX_QUESTIONS,
  isCompoundQuestion,
  ensureSingleBasicQuestion,
  calibrateRating,
  GENERIC_QUESTIONS,
  SIMPLIFIED_RECOVERY_QUESTIONS,
  isExplanationOrSolutionRequest,
  isNonsenseResponse,
  RUBRICS,
};