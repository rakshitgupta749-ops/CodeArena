/**
 * Question Generator V2: Hybrid Pipeline
 *
 * Produces 10 questions:
 *   - 5 benchmark questions from backend/questions.csv
 *   - 5 submitted-code questions from config_gem_v2_2_o.json
 */

const fs = require("fs");
const path = require("path");
const { callJsonLlm } = require("./llmClient");

// Load the V2 config for LLM prompts and validation rules.
const configV2 = require("../../../config_gem_v2_2_o.json");

const CODE_LLM_COUNT = configV2.validation?.expected_count ?? 5;
const CSV_COUNT = 5;
const INTERVIEW_QUESTION_COUNT = 10;
const QUESTION_SOURCES = {
  BENCHMARK_CSV: "benchmark_csv",
  SUBMITTED_CODE_LLM: "submitted_code_llm",
};
const CODE_QUESTION_PROMPT_GUARDRAILS = `\n\nSTRICT CODE-LINE DISPLAY REQUIREMENTS:\n- Every one of the 5 generated questions is a submitted-code question and must have a code_anchor copied exactly from the submitted solution.\n- The backend will reject any question whose code_anchor cannot be found uniquely in the submitted solution and displayed with exact start/end line numbers.\n- Every question must be fully answerable from the exact code_anchor shown.\n- If the question mentions fields, methods, constructors, relationships, or behavior, those exact names and lines must appear in the code_anchor.\n- Do not ask about code or behavior that is not visible in the anchor. If the anchor is only a field block, ask about those fields only. If the anchor is a full method, ask only about that method's behavior.\n- Do not invent classes, methods, fields, or relationships unless those exact names appear in the anchor.\n- Do not ask about average salary unless the anchor shows the average salary code or the method that computes it.\n- If uncertain, shrink the question to what is directly visible in the anchor, or choose a different anchor that includes the exact code needed.\n\nGood examples:\n1) code_anchor: private int id; private String name; private String designation; private double salary;\n   question: Looking at these Employee fields, what data types are used for id, name, designation, and salary, and why do these choices fit the values being stored?\n\n2) code_anchor: public Employee[] getEmployeesByDesignation(String designation) {\n    List<Employee> list = new ArrayList<>();\n    for (Employee e : employees) {\n        if (e.getDesignation().equalsIgnoreCase(designation)) {\n            list.add(e);\n        }\n    }\n    if (list.isEmpty()) return null;\n    return list.toArray(new Employee[0]);\n}\n   question: I see you wrote this method to get employees by designation. In your own words, what does it return, and how does it filter the employees before returning them?\n\n3) code_anchor: public Company(String companyName, Employee[] employees, int numEmployees) {\n    this.companyName = companyName;\n    this.employees = employees;\n    this.numEmployees = numEmployees;\n}\n   question: In your program, this constructor stores an Employee array inside the Company object. Can you describe what kind of relationship this shows between the Company and Employee classes?\n\nBad examples:\n1) code_anchor: private double salary;\n   question: Looking at the Employee class fields, what data types are used to store the id, name, designation, and salary values?\n   why bad: only salary is visible, but the question asks about four fields.\n\n2) code_anchor: public Employee[] getEmployeesByDesignation(String designation) {\n    List<Employee> list = new ArrayList<>();\n    for (Employee e : employees) {\n        if (e.getDesignation().equalsIgnoreCase(designation)) {\n            list.add(e);\n        }\n    }\n    if (list.isEmpty()) return null;\n    return list.toArray(new Employee[0]);\n}\n   question: In your program, you used a method to calculate the average salary. Can you walk me through what this method gives back and how it calculates the average?\n   why bad: the anchor filters by designation; it does not calculate average salary.\n\n3) code_anchor: public Company(String companyName, Employee[] employees, int numEmployees) {\n}\n   question: In your program, you used a Company class that has an array of Employee objects. Can you describe what kind of relationship this represents between the Company and Employee classes?\n   why bad: the anchor is only a constructor header and too small to support the full relationship question.\n\nSelf-check rule:\n- Before output, verify every named field or method in the question is visible in the anchor.\n`;
const DIFFICULTY_QUOTA = {
  Basic: 2,
  Intermediate: 1,
  Advanced: 1,
};
const DEFAULT_MAX_CONTEXT_REGIONS = 16;
const DEFAULT_MAX_CONTEXT_CHARS = 9000;
const DEFAULT_SCHEDULER_CONFIG = {
  maxRequestsPerMinute: 30,
  maxTokensPerMinute: 60000,
  concurrencyCap: 3,
  minDelayMs: 250,
  backoffMs: 2000,
  maxBackoffMs: 8000,
  defaultTokens: 1800,
};

const TOPIC_LABEL_ALIASES = new Map([
  ["array and arraylist", "Array / ArrayList"],
  ["array / arraylist", "Array / ArrayList"],
  ["class object and constructor", "Class / Object / Constructor"],
  ["class object constructor", "Class / Object / Constructor"],
  ["class / object / constructor", "Class / Object / Constructor"],
  ["control structures and loops", "Control Structures / Loops"],
  ["control structures / loops", "Control Structures / Loops"],
  ["exception handling", "Exception Handling / Runtime Safety"],
  ["exception handling / runtime safety", "Exception Handling / Runtime Safety"],
  ["functions methods parameters and return type", "Functions / Methods / Parameters / Return Type"],
  ["functions / methods / parameters / return type", "Functions / Methods / Parameters / Return Type"],
  ["is-a and has-a relationship inheritance and association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a and has-a relationship (inheritance and association)", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a / has-a relationship inheritance / association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a / has-a relationship, inheritance / association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["is-a / has-a relationship, inheritance and association", "IS-A / HAS-A Relationship, Inheritance / Association"],
  ["variables and datatypes", "Variables / Data Types"],
  ["variables and data types", "Variables / Data Types"],
  ["variables / data types", "Variables / Data Types"],
]);

function normalizeTopicLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const key = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[,\-/]+/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return TOPIC_LABEL_ALIASES.get(key) || TOPIC_LABEL_ALIASES.get(raw.toLowerCase()) || raw;
}

function normalizeDifficulty(value) {
  const raw = String(value || "Basic").trim().toLowerCase();
  if (raw === "advanced" || raw === "hard") return "Advanced";
  if (raw === "intermediate" || raw === "medium") return "Intermediate";
  return "Basic";
}

function toDifficultyKey(value) {
  return normalizeDifficulty(value).toLowerCase();
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function normalizeCsvHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCsvValue(row, names) {
  for (const name of names) {
    const value = row[normalizeCsvHeader(name)];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function parseJsonCsvField(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeCsvAnswerCriteria(value) {
  const parsed = parseJsonCsvField(value, []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, 4)
    .map((criterion) => ({
      point: String(criterion?.point || criterion?.criterion || "").trim(),
      marks: Number(criterion?.marks) || 0,
    }))
    .filter((criterion) => criterion.point && criterion.marks > 0);
}

function normalizeCsvScoringGuide(value) {
  const parsed = parseJsonCsvField(value, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return {
    full: String(parsed.full || "").trim(),
    partial: String(parsed.partial || "").trim(),
    minimal: String(parsed.minimal || "").trim(),
    zero: String(parsed.zero || "").trim(),
  };
}

function loadCsvQuestions() {
  const csvPath = path.join(__dirname, "..", "..", "questions.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`QUESTIONS_CSV_NOT_FOUND: ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error("QUESTIONS_CSV_EMPTY: questions.csv must contain a header and question rows.");
  }

  const rows = [];
  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const hasNamedQuestionColumn = headers.includes("question");

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 5) continue;

    const row = {};
    if (hasNamedQuestionColumn) {
      headers.forEach((header, index) => {
        row[header] = fields[index] || "";
      });
    } else {
      [
        "topic",
        "sub_topic",
        "difficulty",
        "question",
        "expected_answer",
        "explanation",
      ].forEach((header, index) => {
        row[header] = fields[index] || "";
      });
    }

    const topic = getCsvValue(row, ["topic"]) || "Java";
    const subTopic = getCsvValue(row, ["sub_topic", "sub-topic", "subtopic"]) || "General";
    const difficulty = getCsvValue(row, ["difficulty"]) || "Basic";
    const question = getCsvValue(row, ["question"]);
    const expectedAnswer = getCsvValue(row, ["best_answer", "expected_answer", "expected"]);
    const explanation = getCsvValue(row, ["evaluator_guide", "explanation", "assessment_angle"]);

    if (!question || !question.trim()) continue;

    rows.push({
      topic: topic.trim(),
      subTopic: normalizeTopicLabel(subTopic),
      difficulty: normalizeDifficulty(difficulty),
      question: question.trim(),
      expectedAnswer: expectedAnswer.trim(),
      explanation: explanation.trim(),
      partialCorrectAnswer: getCsvValue(row, ["partial_correct_answer", "partial_answer"]),
      incorrectAnswer: getCsvValue(row, ["incorrect_answer", "wrong_answer"]),
      answerCriteria: normalizeCsvAnswerCriteria(getCsvValue(row, ["answer_criteria", "criteria"])),
      scoringGuide: normalizeCsvScoringGuide(getCsvValue(row, ["scoring_guide"])),
      evaluates: getCsvValue(row, ["evaluates", "skill"]),
    });
  }

  if (rows.length < CSV_COUNT) {
    throw new Error(`QUESTIONS_CSV_TOO_SMALL: expected at least ${CSV_COUNT} usable rows, found ${rows.length}.`);
  }

  return rows;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleBalancedCsvQuestions(count = CSV_COUNT) {
  const rows = loadCsvQuestions();
  const selected = [];
  const used = new Set();
  const usedTopics = new Set();

  const pickRows = (pool, quota) => {
    const picked = [];

    for (const row of pool) {
      if (picked.length >= quota) break;
      const index = rows.indexOf(row);
      if (used.has(index) || usedTopics.has(row.subTopic)) continue;
      used.add(index);
      usedTopics.add(row.subTopic);
      picked.push(row);
    }

    if (picked.length < quota) {
      for (const row of pool) {
        if (picked.length >= quota) break;
        const index = rows.indexOf(row);
        if (used.has(index)) continue;
        used.add(index);
        usedTopics.add(row.subTopic);
        picked.push(row);
      }
    }

    return picked;
  };

  for (const [difficulty, quota] of Object.entries(DIFFICULTY_QUOTA)) {
    const pool = shuffle(rows.filter((row, index) => row.difficulty === difficulty && !used.has(index)));
    selected.push(...pickRows(pool, quota));
  }

  if (selected.length < count) {
    const remaining = shuffle(rows.filter((_, index) => !used.has(index)));
    selected.push(...pickRows(remaining, count - selected.length));
  }

  if (selected.length < count) {
    throw new Error(`QUESTIONS_CSV_BALANCED_SAMPLE_FAILED: expected ${count}, selected ${selected.length}.`);
  }

  return shuffle(selected).slice(0, count).map((row, index) => ({
    qid: `R${String(index + 1).padStart(2, "0")}`,
    dimension: row.subTopic || row.topic,
    difficulty: toDifficultyKey(row.difficulty),
    question: row.question,
    rubric: row.expectedAnswer,
    assessment_angle: row.explanation,
    partial_correct_answer: row.partialCorrectAnswer,
    incorrect_answer: row.incorrectAnswer,
    answer_criteria: row.answerCriteria,
    scoring_guide: row.scoringGuide,
    evaluates: row.evaluates,
    concept_tags: [row.topic, row.subTopic].filter(Boolean),
    source_concepts: [row.subTopic || row.topic].filter(Boolean),
    source: QUESTION_SOURCES.BENCHMARK_CSV,
  }));
}

/**
 * Normalize the JSON response into the question shape used by the session model.
 */
function parseV2JsonOutput(payload) {
  const items = Array.isArray(payload) ? payload : payload?.questions;
  if (!Array.isArray(items)) {
    throw new Error("QUESTION_GENERATION_JSON_INVALID: expected a questions array.");
  }

  return items.map((item, index) => {
    const number = Number(item?.number) || index + 1;
    const topic = normalizeTopicLabel(item?.topic || "");
    const codeAnchor = cleanSnippet(item?.code_anchor || item?.code_snippet || "");
    const question = String(item?.question || "").trim();
    const expectedAnswer = String(item?.expected_answer || item?.rubric || "").trim();

    return {
      qid: `C${String(number).padStart(2, "0")}`,
      dimension: topic || "Java",
      difficulty: normalizeDifficulty(item?.difficulty).toLowerCase(),
      question,
      rubric: expectedAnswer,
      assessment_angle: String(item?.evaluator_guide || item?.assessment_angle || "").trim(),
      answer_criteria: normalizeAnswerCriteria(item?.answer_criteria, expectedAnswer),
      scoring_guide: normalizeScoringGuide(item?.scoring_guide),
      concept_tags: [topic].filter(Boolean),
      source_concepts: [topic].filter(Boolean),
      source: QUESTION_SOURCES.SUBMITTED_CODE_LLM,
      code_anchor: codeAnchor,
      code_snippet: codeAnchor,
      evaluates: String(item?.evaluates || "").trim(),
    };
  });
}

function normalizeAnswerCriteria(criteria, expectedAnswer) {
  let normalized;
  if (Array.isArray(criteria) && criteria.length > 0) {
    normalized = criteria.slice(0, 4).map((criterion) => ({
      point: String(criterion?.point || criterion?.criterion || "").trim(),
      marks: Number(criterion?.marks) || 0,
    })).filter((criterion) => criterion.point);
  } else {
    normalized = String(expectedAnswer || "")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((point) => ({ point, marks: 0 }));
  }

  if (normalized.length === 0) {
    normalized = [
      { point: "Shows the main Java idea asked in the question.", marks: 0 },
      { point: "Connects the explanation to the displayed code.", marks: 0 },
    ];
  } else if (normalized.length === 1) {
    normalized.push({
      point: "Connects the explanation to what the displayed code does.",
      marks: 0,
    });
  }

  const markPatterns = {
    2: [3, 2],
    3: [2, 2, 1],
    4: [2, 1, 1, 1],
  };
  const totalMarks = normalized.reduce(
    (total, criterion) => total + criterion.marks,
    0
  );
  const repairedMarks = markPatterns[normalized.length];
  const needsMarkRepair = totalMarks !== 5
    || normalized.some((criterion) => criterion.marks <= 0);

  return normalized.map((criterion, index) => ({
    point: criterion.point,
    marks: needsMarkRepair ? repairedMarks[index] : criterion.marks,
  }));
}

function normalizeScoringGuide(scoringGuide) {
  return {
    full: String(
      scoringGuide?.full
      || "5 marks: all essential ideas are understood clearly."
    ).trim(),
    partial: String(
      scoringGuide?.partial
      || "3-4 marks: the main idea is correct but one detail is missing or unclear."
    ).trim(),
    minimal: String(
      scoringGuide?.minimal
      || "1-2 marks: some relevant understanding is shown but the answer is incomplete."
    ).trim(),
    zero: String(
      scoringGuide?.zero
      || "0 marks: the answer is unrelated, has no meaningful attempt, or is technically opposite."
    ).trim(),
  };
}

function buildVariationSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createQuestionGenerationScheduler(options = {}) {
  const config = {
    ...DEFAULT_SCHEDULER_CONFIG,
    ...(options || {}),
  };
  const state = {
    requestBucket: config.maxRequestsPerMinute,
    tokenBucket: config.maxTokensPerMinute,
    lastRefillTime: Date.now(),
    activeRequests: 0,
  };

  const refillBuckets = (now = Date.now()) => {
    const elapsedSeconds = Math.max(0, (now - state.lastRefillTime) / 1000);
    if (elapsedSeconds <= 0) return;

    const requestRefill = (elapsedSeconds / 60) * config.maxRequestsPerMinute;
    const tokenRefill = (elapsedSeconds / 60) * config.maxTokensPerMinute;
    state.requestBucket = Math.min(config.maxRequestsPerMinute, state.requestBucket + requestRefill);
    state.tokenBucket = Math.min(config.maxTokensPerMinute, state.tokenBucket + tokenRefill);
    state.lastRefillTime = now;
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getState = () => ({
    ...state,
    maxRequestsPerMinute: config.maxRequestsPerMinute,
    maxTokensPerMinute: config.maxTokensPerMinute,
    concurrencyCap: config.concurrencyCap,
  });

  const run = async (worker, tokensNeeded = config.defaultTokens, maxRetries = 1) => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      refillBuckets();
      while (
        state.activeRequests >= config.concurrencyCap
        || state.requestBucket <= 0
        || state.tokenBucket < tokensNeeded
      ) {
        await wait(config.minDelayMs);
        refillBuckets();
      }

      state.requestBucket = Math.max(0, state.requestBucket - 1);
      state.tokenBucket = Math.max(0, state.tokenBucket - tokensNeeded);
      state.activeRequests += 1;

      try {
        const result = await worker();
        state.activeRequests = Math.max(0, state.activeRequests - 1);
        return result;
      } catch (error) {
        state.activeRequests = Math.max(0, state.activeRequests - 1);
        const isRateLimit = error?.status === 429 || /429|rate limit/i.test(String(error?.message || ""));
        if (isRateLimit && attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 200);
          const backoff = Math.min(config.maxBackoffMs, config.backoffMs * (attempt + 1) + jitter);
          await wait(backoff);
          continue;
        }
        throw error;
      }
    }

    throw new Error("QUESTION_GENERATION_SCHEDULER_FAILED");
  };

  return { run, getState };
}

/**
 * Build the user prompt from the configured template by substituting placeholders.
 */
function buildV2Prompt(template, originalQuestion, submittedSolution) {
  const variationSeed = buildVariationSeed();
  const replacements = {
    "{{QUESTION}}": originalQuestion,
    "{{SUBMITTED_SOLUTION}}": submittedSolution,
    "{{CODE_SNIPPET}}": submittedSolution,
    "{{VARIATION_SEED}}": variationSeed,
    "{question}": originalQuestion,
    "{QUESTION}": originalQuestion,
    "{submitted_solution}": submittedSolution,
    "{SUBMITTED_SOLUTION}": submittedSolution,
    "{code_snippet}": submittedSolution,
    "{CODE_SNIPPET}": submittedSolution,
    "{variation_seed}": variationSeed,
    "{VARIATION_SEED}": variationSeed,
  };

  let prompt = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    prompt = prompt.split(placeholder).join(value);
  }
  return prompt;
}

function buildValidationRetryPrompt(basePrompt, validationMessage) {
  const details = String(validationMessage || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2500);

  return `${basePrompt}

PREVIOUS ATTEMPT FAILED BACKEND VALIDATION:
${details}

Regenerate the full response from scratch. Return exactly 5 questions in the same JSON shape.
Fix every validation error above. Do not include backend fields such as _id, user, submission, qid, source, code_line_start, or code_line_end.
Each code_anchor must be exact submitted code, unique in the submission, and enough for the question.`;
}

function cleanSnippet(snippet) {
  let cleaned = String(snippet || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_+-]*\s*/i, "").replace(/\s*```$/i, "");
  }
  if (cleaned.startsWith("`") && cleaned.endsWith("`") && cleaned.length >= 2) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

function normalizeCodeLines(value) {
  const lines = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));

  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  const nonBlankLines = lines.filter((line) => line.trim());
  const commonIndent = nonBlankLines.length > 0
    ? Math.min(...nonBlankLines.map((line) => line.match(/^\s*/)?.[0].length || 0))
    : 0;

  return lines.map((line) => line.slice(Math.min(commonIndent, line.length)).trim());
}

function getSolutionLines(solution) {
  return String(solution || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
}

function findCodeAnchorMatches(anchor, solution, normalizeLine = (line) => line.trim()) {
  const anchorLines = normalizeCodeLines(cleanSnippet(anchor)).map(normalizeLine);
  const solutionLines = getSolutionLines(solution);
  const normalizedSolutionLines = solutionLines.map(normalizeLine);

  if (anchorLines.length === 0) {
    return [];
  }

  const matches = [];
  for (let start = 0; start <= normalizedSolutionLines.length - anchorLines.length; start++) {
    const matchesAtStart = anchorLines.every(
      (line, index) => normalizedSolutionLines[start + index] === line
    );
    if (matchesAtStart) {
      matches.push({
        start: start + 1,
        end: start + anchorLines.length,
      });
    }
  }

  return matches;
}

function normalizeLooseCodeLine(line) {
  return String(line || "").replace(/\s+/g, "").trim();
}

function relaxedCodeLineMatches(anchorLine, solutionLine) {
  const anchor = normalizeLooseCodeLine(anchorLine);
  const solution = normalizeLooseCodeLine(solutionLine);
  if (!anchor || !solution) return false;
  if (anchor === solution) return true;

  // Some model responses truncate a long submitted line. Treat a substantial
  // prefix as a candidate, then expand back to the exact submitted line.
  if (anchor.length >= 16 && solution.startsWith(anchor)) return true;
  return false;
}

function findRelaxedCodeAnchorMatches(anchor, solution) {
  const anchorLines = normalizeCodeLines(cleanSnippet(anchor));
  const solutionLines = getSolutionLines(solution);
  if (anchorLines.length === 0) return [];

  const matches = [];
  for (let start = 0; start <= solutionLines.length - anchorLines.length; start++) {
    const matchesAtStart = anchorLines.every((line, index) =>
      relaxedCodeLineMatches(line, solutionLines[start + index])
    );
    if (matchesAtStart) {
      matches.push({
        start: start + 1,
        end: start + anchorLines.length,
      });
    }
  }

  return matches;
}

function findUniqueCodeAnchorRange(anchor, solution) {
  const matches = findCodeAnchorMatches(anchor, solution);
  if (matches.length === 0) return { status: "missing", matches };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return { status: "unique", matches, range: matches[0] };
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isSubmittedCodeQuestion(question) {
  const source = String(question?.source || "").toLowerCase();
  return source === QUESTION_SOURCES.SUBMITTED_CODE_LLM || String(question?.qid || "").startsWith("C");
}

function isBenchmarkQuestion(question) {
  const source = String(question?.source || "").toLowerCase();
  return source === QUESTION_SOURCES.BENCHMARK_CSV || String(question?.qid || "").startsWith("R");
}

function validateSubmittedCodeQuestionRange(question, submittedSolution) {
  const errors = [];
  const qid = question?.qid || "unknown";
  const anchor = cleanSnippet(question?.code_anchor || question?.code_snippet || "");
  const start = question?.code_line_start;
  const end = question?.code_line_end;

  if (!anchor) {
    errors.push(`${qid}: submitted-code question must have code_anchor.`);
    return errors;
  }

  if (!question?.code_snippet || cleanSnippet(question.code_snippet) !== anchor) {
    errors.push(`${qid}: submitted-code question code_snippet must match code_anchor.`);
  }

  if (!isPositiveInteger(start)) {
    errors.push(`${qid}: submitted-code question must have positive integer code_line_start.`);
  }
  if (!isPositiveInteger(end)) {
    errors.push(`${qid}: submitted-code question must have positive integer code_line_end.`);
  }
  if (isPositiveInteger(start) && isPositiveInteger(end) && end < start) {
    errors.push(`${qid}: code_line_end must be greater than or equal to code_line_start.`);
  }

  const anchorLines = normalizeCodeLines(anchor);
  const match = findUniqueCodeAnchorRange(anchor, submittedSolution);
  if (match.status === "missing") {
    errors.push(`${qid}: code_anchor was not found in the submitted solution.`);
  } else if (match.status === "ambiguous") {
    errors.push(`${qid}: code_anchor matched ${match.matches.length} locations.`);
  } else if (isPositiveInteger(start) && isPositiveInteger(end)) {
    const expectedEnd = start + anchorLines.length - 1;
    if (end !== expectedEnd) {
      errors.push(`${qid}: code_line_end must match code_anchor length; expected ${expectedEnd}, found ${end}.`);
    }
    if (match.range.start !== start || match.range.end !== end) {
      errors.push(
        `${qid}: code line range ${start}-${end} does not match resolved anchor range ${match.range.start}-${match.range.end}.`
      );
    }
  }

  return errors;
}

function validateQuestionSourceContracts(questions, submittedSolution) {
  const errors = [];

  for (const question of questions || []) {
    if (isSubmittedCodeQuestion(question)) {
      errors.push(...validateSubmittedCodeQuestionRange(question, submittedSolution));
      if (question.source !== QUESTION_SOURCES.SUBMITTED_CODE_LLM) {
        errors.push(`${question.qid}: submitted-code question must have source '${QUESTION_SOURCES.SUBMITTED_CODE_LLM}'.`);
      }
      continue;
    }

    if (isBenchmarkQuestion(question)) {
      if (question.source !== QUESTION_SOURCES.BENCHMARK_CSV) {
        errors.push(`${question.qid}: benchmark question must have source '${QUESTION_SOURCES.BENCHMARK_CSV}'.`);
      }
      if (
        cleanSnippet(question.code_anchor || "") ||
        cleanSnippet(question.code_snippet || "") ||
        question.code_line_start !== undefined ||
        question.code_line_end !== undefined
      ) {
        errors.push(`${question.qid}: benchmark question must not have code anchor or line range.`);
      }
      if (question.anchor_resolution && question.anchor_resolution !== "not_applicable") {
        errors.push(`${question.qid}: benchmark question anchor_resolution must be not_applicable.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`QUESTION_SOURCE_CONTRACT_FAILED: ${errors.join(" ")}`);
  }
}

const ANCHOR_STOP_WORDS = new Set([
  "about", "after", "again", "answer", "before", "being", "block", "code",
  "does", "from", "guide", "into", "java", "line", "question", "should",
  "that", "their", "these", "this", "those", "what", "when", "where",
  "which", "while", "with", "would", "your",
]);

function extractAnchorTerms(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z_$][a-z0-9_$]*|\d+(?:\.\d+)?/g)
    ?.filter((term) => term.length > 2 && !ANCHOR_STOP_WORDS.has(term)) || [];
}

function tokenizeJava(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .match(/[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|[{}()[\].,;=+\-*/<>:]/g)
    ?.map((token) => token.toLowerCase()) || [];
}

function diceSimilarity(leftTokens, rightTokens) {
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const counts = new Map();
  for (const token of leftTokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of rightTokens) {
    const remaining = counts.get(token) || 0;
    if (remaining > 0) {
      overlap++;
      counts.set(token, remaining - 1);
    }
  }

  return (2 * overlap) / (leftTokens.length + rightTokens.length);
}

function countJavaBraces(line) {
  const withoutStrings = String(line || "")
    .replace(/"(?:\\.|[^"\\])*"/g, "\"\"")
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/\/\/.*$/g, "");
  const opens = withoutStrings.match(/{/g)?.length || 0;
  const closes = withoutStrings.match(/}/g)?.length || 0;
  return opens - closes;
}

function getJavaClassNames(solutionLines) {
  const names = new Set();
  for (const line of solutionLines) {
    const match = String(line || "").match(/\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/);
    if (match) names.add(match[1]);
  }
  return names;
}

function parseJavaMethodDeclaration(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.endsWith(";")) return null;
  if (/^(?:if|for|while|switch|catch|else|do|try|return|new)\b/.test(trimmed)) return null;
  if (!/\)\s*(?:throws\b[^{]*)?\{?\s*$/.test(trimmed)) return null;

  const match = trimmed.match(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^;{}]*\)\s*(?:throws\b[^{]*)?\{?\s*$/);
  if (!match) return null;

  const name = match[1];
  if (["if", "for", "while", "switch", "catch", "new", "return"].includes(name)) return null;

  return { name };
}

function getJavaMethodRanges(solutionLines) {
  const ranges = [];
  const classNames = getJavaClassNames(solutionLines);
  let active = null;

  solutionLines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (!active) {
      const declaration = parseJavaMethodDeclaration(line);
      if (!declaration) return;

      active = {
        name: declaration.name,
        kind: classNames.has(declaration.name) ? "constructor" : "method",
        start: lineNumber,
        end: lineNumber,
        braceDepth: countJavaBraces(line),
        hasOpened: line.includes("{"),
      };

      if (active.hasOpened && active.braceDepth <= 0) {
        ranges.push({ name: active.name, kind: active.kind, start: active.start, end: lineNumber });
        active = null;
      }
      return;
    }

    active.end = lineNumber;
    active.braceDepth += countJavaBraces(line);
    active.hasOpened = active.hasOpened || line.includes("{");

    if (active.hasOpened && active.braceDepth <= 0) {
      ranges.push({ name: active.name, kind: active.kind, start: active.start, end: lineNumber });
      active = null;
    }
  });

  return ranges;
}

function getQuestionTextForAnchoring(question) {
  return [
    question.question,
    question.rubric,
    question.assessment_angle,
    question.evaluates,
  ].join(" ");
}

function getMentionedMethodNames(question, solutionLines) {
  const methodNames = new Set(
    getJavaMethodRanges(solutionLines)
      .filter((method) => method.kind !== "constructor")
      .map((method) => method.name)
  );
  if (methodNames.size === 0) return [];

  const identifiers = getQuestionTextForAnchoring(question)
    .match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) || [];
  return [...new Set(identifiers.filter((identifier) => methodNames.has(identifier)))];
}

function findContainingMethod(range, methodRanges) {
  if (!range) return null;
  return methodRanges.find((method) =>
    range.start >= method.start && range.end <= method.end
  ) || null;
}

function isMethodOverviewQuestion(question, mentionedMethods) {
  if (!mentionedMethods.length) return false;
  const text = getQuestionTextForAnchoring(question).toLowerCase();
  return /\bmethod\b/.test(text) &&
    /\b(calculates?|returns?|gives?\s+back|walk\s+me\s+through|final\s+value|result)\b/.test(text);
}

function rangeIsInsideMentionedMethod(range, methodRanges, mentionedMethods) {
  if (!mentionedMethods.length) return true;
  const containingMethod = findContainingMethod(range, methodRanges);
  return Boolean(containingMethod && mentionedMethods.includes(containingMethod.name));
}

function anchorContainsMentionedMethod(anchor, mentionedMethods) {
  return mentionedMethods.some((methodName) =>
    new RegExp(`\\b${methodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(anchor)
  );
}

function getMentionedMethodCandidateRanges(mentionedMethods, methodRanges, solutionLines) {
  const ranges = [];

  for (const method of methodRanges) {
    if (!mentionedMethods.includes(method.name)) continue;

    for (let lineNumber = method.start; lineNumber <= method.end; lineNumber++) {
      const line = solutionLines[lineNumber - 1] || "";
      if (!line.trim()) continue;
      ranges.push({ start: lineNumber, end: lineNumber });
    }
  }

  return ranges;
}

function getQuestionAnchorIntent(question) {
  const text = getQuestionTextForAnchoring(question).toLowerCase();
  const mentionsArray = /\barray\b|\barrays\b/.test(text);
  const mentionsArrayCreation =
    /\barray creation\b/.test(text) ||
    (mentionsArray && /\b(?:hold|holds|store|stores|size|position|created|creation)\b/.test(text));
  const mentionsGuardPath =
    /\b(?:empty|missing|null|isempty)\b/.test(text) &&
    /\b(?:check|guard|safe|safer|happen|return|called|call)\b/.test(text);
  const mentionsObjectCreation =
    /\bobject(?:s)?\b/.test(text) &&
    /\b(?:created?|instantiat|new|class|same)\b/.test(text);
  const mentionsPrimitivePassByValue =
    /\b(?:primitive|parameter|param|argument)\b/.test(text) &&
    /\b(?:change|modify|pass|change.*not|doesn't change|doesn.*t change|stay|original)\b/.test(text);
  const mentionsExceptionHandling =
    /\b(?:finally|try|catch|exception|throw|error)\b/.test(text) &&
    /\b(?:block|role|purpose|happen|execute|guarantee)\b/.test(text);
  const wantsMethodContext =
    /\bthis method\b/.test(text) &&
    /\b(?:called|call|empty|missing|null|happen|return|safer|safe)\b/.test(text);

  return {
    requiresArrayCreation: mentionsArrayCreation,
    requiresGuardPath: mentionsGuardPath,
    requiresObjectCreation: mentionsObjectCreation,
    requiresPrimitivePassByValue: mentionsPrimitivePassByValue,
    requiresExceptionHandling: mentionsExceptionHandling,
    wantsMethodContext,
  };
}

function isArrayCreationLine(line) {
  const text = String(line || "");
  return /\bnew\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]+>)?\s*\[[^\]]+\]/.test(text) ||
    /\b[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]+>)?\s*\[\]\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=/.test(text);
}

function isObjectCreationLine(line) {
  const text = String(line || "");
  // Matches: new ClassName(...) or ClassName var = new ClassName(...)
  return /\bnew\s+[A-Za-z_$][A-Za-z0-9_$]*(?:<[^>]+>)?\s*\(/.test(text);
}

function isConstructorDeclarationLine(line) {
  const text = String(line || "");
  return /^\s*(?:public|private|protected)?\s*[A-Z][A-Za-z0-9_$]*\s*\([^;{}]*\)\s*(?:throws\b[^{]*)?\{?\s*$/.test(text);
}

function isPrimitivePassByValueLine(line) {
  const text = String(line || "");
  // Matches: OPERATIONS on variables (not declarations)
  // var = var + X, var += X, etc. (assignment operations, not just variable declarations)
  return /[a-zA-Z_$][a-zA-Z0-9_$]*\s*(\+=|-=|\*=|\/=|%=|=\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*(\+|-|\*|\/|%))/.test(text) &&
         !/^\s*(?:int|double|float|long|short|byte|boolean|char)\b/.test(text); // Exclude pure declarations
}

function isExceptionHandlingLine(line) {
  const text = String(line || "");
  // Matches: try, catch, finally, throw statements - prioritize finally
  return /\bfinally\b/.test(text) ||  // Finally blocks are most specific for finally question
    /\btry\b/.test(text) ||
    /\bcatch\b/.test(text) ||
    /\bthrow\s+new/.test(text);
}

function isGuardLine(line) {
  const text = String(line || "");
  return /\bisEmpty\s*\(\s*\)/.test(text) ||
    /(?:==|!=)\s*null\b/.test(text) ||
    /\bnull\s*(?:==|!=)/.test(text) ||
    /\.size\s*\(\s*\)\s*(?:==|<=|<)\s*0\b/.test(text) ||
    /\.length\s*(?:==|<=|<)\s*0\b/.test(text);
}

function anchorSatisfiesQuestionIntent(anchor, question) {
  const intent = getQuestionAnchorIntent(question);
  const lines = getSolutionLines(anchor);

  if (intent.requiresArrayCreation && !lines.some(isArrayCreationLine)) {
    return false;
  }
  if (intent.requiresGuardPath && !lines.some(isGuardLine)) {
    return false;
  }
  if (
    intent.requiresObjectCreation &&
    !lines.some((line) => isObjectCreationLine(line) || isConstructorDeclarationLine(line))
  ) {
    return false;
  }
  if (intent.requiresPrimitivePassByValue && !lines.some(isPrimitivePassByValueLine)) {
    return false;
  }
  if (intent.requiresExceptionHandling && !lines.some(isExceptionHandlingLine)) {
    return false;
  }

  return true;
}

function hasRequiredAnchorIntent(intent) {
  return Boolean(
    intent.requiresArrayCreation ||
    intent.requiresGuardPath ||
    intent.requiresObjectCreation ||
    intent.requiresPrimitivePassByValue ||
    intent.requiresExceptionHandling
  );
}

function getIntentCandidateRanges(question, solutionLines) {
  const intent = getQuestionAnchorIntent(question);
  const candidates = [];

  solutionLines.forEach((line, index) => {
    if (intent.requiresArrayCreation && isArrayCreationLine(line)) {
      candidates.push({ start: index + 1, end: index + 1 });
      return;
    }
    if (intent.requiresGuardPath && isGuardLine(line)) {
      candidates.push({ start: index + 1, end: index + 1 });
      return;
    }
    if (
      intent.requiresObjectCreation &&
      (isObjectCreationLine(line) || isConstructorDeclarationLine(line))
    ) {
      candidates.push({ start: index + 1, end: index + 1 });
      return;
    }
    if (intent.requiresPrimitivePassByValue && isPrimitivePassByValueLine(line)) {
      candidates.push({ start: index + 1, end: index + 1 });
      return;
    }
    if (intent.requiresExceptionHandling && isExceptionHandlingLine(line)) {
      candidates.push({ start: index + 1, end: index + 1 });
      return;
    }
  });

  return candidates;
}

function getQuestionSearchTerms(question) {
  return extractAnchorTerms([
    question.code_anchor,
    question.question,
    question.rubric,
    question.assessment_angle,
    question.evaluates,
  ].join(" "));
}

function scoreRangeContext(range, solutionLines, question) {
  const terms = getQuestionSearchTerms(question);
  if (terms.length === 0) return 0;

  const contextStart = Math.max(0, range.start - 4);
  const contextEnd = Math.min(solutionLines.length, range.end + 3);
  const context = solutionLines.slice(contextStart, contextEnd).join("\n").toLowerCase();

  return terms.reduce((score, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const occurrences = context.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length || 0;
    return score + Math.min(occurrences, 3);
  }, 0);
}

function getTopicCandidateRanges(topic, solutionLines) {
  const candidates = [];

  solutionLines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    let matchesTopic = false;
    switch (topic) {
      case "Class / Object / Constructor":
        matchesTopic = /\bclass\s+[A-Za-z_$]\w*/.test(line)
          || /\bnew\s+[A-Za-z_$]\w*\s*\(/.test(line)
          || /\b(public|private|protected)\s+[A-Z][A-Za-z0-9_$]*\s*\(/.test(line);
        break;
      case "Control Structures / Loops":
        matchesTopic = /\b(if|else\s+if|switch|for|while)\s*\(/.test(line)
          || /\bdo\b/.test(line);
        break;
      case "Functions / Methods / Parameters / Return Type":
        matchesTopic = /\b(public|private|protected|static)\b.*\w+\s*\(/.test(line)
          || /\breturn\b/.test(line);
        break;
      case "Variables / Data Types":
        matchesTopic = /\b(byte|short|int|long|float|double|char|boolean|String|Integer|Long|Double|Float|Boolean|Character|var)\b.*[;=]/.test(line)
          || /\b[A-Z][A-Za-z0-9_$<>\[\]]*\s+[a-zA-Z_$]\w*\s*[;=]/.test(line);
        break;
      case "Exception Handling / Runtime Safety":
        matchesTopic = /\b(try|catch|finally|throw|throws)\b/.test(line)
          || /\.[A-Za-z_$]\w*\s*\(/.test(line)
          || /\[[^\]]+\]/.test(line)
          || /\/\s*[A-Za-z0-9_(]/.test(line);
        break;
      case "Array / ArrayList":
        matchesTopic = /\[\]/.test(line)
          || /\b(ArrayList|List|Collection|Map|Set|Queue|Deque)\b/.test(line)
          || /\.(add|get|put|remove|contains|size)\s*\(/.test(line);
        break;
      case "IS-A / HAS-A Relationship, Inheritance / Association":
        matchesTopic = /\b(extends|implements)\b/.test(line)
          || /\b[A-Z][A-Za-z0-9_$<>\[\]]*\s+[a-zA-Z_$]\w*\s*[,);=]/.test(line);
        break;
      default:
        matchesTopic = true;
    }

    if (matchesTopic) {
      candidates.push({ start: index + 1, end: index + 1 });
    }
  });

  return candidates;
}

function getRangeText(solutionLines, range) {
  return solutionLines.slice(range.start - 1, range.end).join("\n").trim();
}

function getRangeLineCount(range) {
  return range.end - range.start + 1;
}

function lineIsInsideRange(lineNumber, ranges) {
  return ranges.some((range) => lineNumber >= range.start && lineNumber <= range.end);
}

function getBraceBlockRange(solutionLines, startLine, maxLines) {
  let end = startLine;
  let depth = 0;
  let hasOpened = false;

  for (
    let lineNumber = startLine;
    lineNumber <= solutionLines.length && lineNumber < startLine + maxLines;
    lineNumber++
  ) {
    const line = solutionLines[lineNumber - 1] || "";
    depth += countJavaBraces(line);
    hasOpened = hasOpened || line.includes("{");
    end = lineNumber;

    if (hasOpened && depth <= 0) {
      break;
    }

    if (!hasOpened && line.trim().endsWith(";")) {
      break;
    }
  }

  return { start: startLine, end };
}

function isFieldDeclarationLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || !trimmed.endsWith(";")) return false;
  if (/^(?:package|import|return|throw|break|continue)\b/.test(trimmed)) return false;
  if (/^(?:System|Scanner)\b/.test(trimmed)) return false;
  if (/\b(?:class|interface|enum)\b/.test(trimmed)) return false;

  return /^(?:(?:public|private|protected|static|final|transient|volatile)\s+)*[A-Za-z_$][A-Za-z0-9_$<>, ?.[\]]*(?:\[\])?\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*=.*)?;$/.test(trimmed);
}

function inferRegionTopics(anchor, kind) {
  const lines = getSolutionLines(anchor);
  const text = anchor;
  const topics = new Set();

  if (
    kind === "field" ||
    lines.some((line) => /\b(byte|short|int|long|float|double|char|boolean|String|Integer|Long|Double|Float|Boolean|Character|var)\b/.test(line))
  ) {
    topics.add("Variables / Data Types");
  }
  if (
    kind === "constructor" ||
    kind === "class" ||
    lines.some((line) => isObjectCreationLine(line) || isConstructorDeclarationLine(line))
  ) {
    topics.add("Class / Object / Constructor");
  }
  if (kind === "method" || /\breturn\b/.test(text) || /\)\s*(?:throws\b[^{]*)?\{/.test(text)) {
    topics.add("Functions / Methods / Parameters / Return Type");
  }
  if (
    lines.some((line) => isArrayCreationLine(line)) ||
    /\b(?:ArrayList|List|Collection|Map|Set|Queue|Deque)\b/.test(text) ||
    /\.(?:add|get|put|remove|contains|size)\s*\(/.test(text)
  ) {
    topics.add("Array / ArrayList");
  }
  if (/\b(?:if|else\s+if|switch|for|while)\s*\(/.test(text) || /\bdo\b/.test(text)) {
    topics.add("Control Structures / Loops");
  }
  if (lines.some((line) => isExceptionHandlingLine(line) || isGuardLine(line))) {
    topics.add("Exception Handling / Runtime Safety");
  }
  if (/\b(?:extends|implements)\b/.test(text) || /\b[A-Z][A-Za-z0-9_$<>\[\]]*\s+[a-zA-Z_$][A-Za-z0-9_$]*\s*(?:[,);=]|;)/.test(text)) {
    topics.add("IS-A / HAS-A Relationship, Inheritance / Association");
  }

  return [...topics];
}

function regionScore(region) {
  const kindScore = {
    field: 95,
    constructor: 90,
    method: 85,
    control: 80,
    array: 78,
    object_creation: 76,
    guard: 74,
    return_path: 70,
    relationship: 68,
    class: 55,
  }[region.kind] || 50;

  return kindScore + (region.topics?.length || 0) * 5 - getRangeLineCount(region);
}

function addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, candidate) {
  const maxRegionLines = configV2.validation?.anchor_max_lines ?? 12;
  const start = Math.max(1, Number(candidate.start) || 1);
  const end = Math.min(solutionLines.length, Number(candidate.end) || start);
  if (end < start || end - start + 1 > maxRegionLines) return;

  const anchor = getRangeText(solutionLines, { start, end });
  if (!anchor) return;

  const normalizedAnchor = normalizeCodeLines(anchor).join("\n");
  if (!normalizedAnchor || seenAnchors.has(normalizedAnchor)) return;

  // Prefer regions that are already unique exact anchors in the full submitted code.
  if (findCodeAnchorMatches(anchor, fullSolution).length !== 1) return;

  const region = {
    kind: candidate.kind || "code",
    name: candidate.name || "",
    start,
    end,
    anchor,
    topics: candidate.topics?.length
      ? candidate.topics.map(normalizeTopicLabel)
      : inferRegionTopics(anchor, candidate.kind || "code"),
  };

  if (region.topics.length === 0) return;
  region.score = regionScore(region);
  seenAnchors.add(normalizedAnchor);
  regions.push(region);
}

function collectFieldRegions(regions, seenAnchors, solutionLines, fullSolution, methodRanges) {
  let fieldStart = null;
  let fieldEnd = null;

  const flush = () => {
    if (fieldStart && fieldEnd) {
      addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
        kind: "field",
        start: fieldStart,
        end: fieldEnd,
        topics: ["Variables / Data Types", "IS-A / HAS-A Relationship, Inheritance / Association"],
      });
    }
    fieldStart = null;
    fieldEnd = null;
  };

  solutionLines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (lineIsInsideRange(lineNumber, methodRanges) || !isFieldDeclarationLine(line)) {
      flush();
      return;
    }

    if (!fieldStart) fieldStart = lineNumber;
    fieldEnd = lineNumber;
  });
  flush();
}

function collectMethodRegions(regions, seenAnchors, solutionLines, fullSolution, methodRanges) {
  const maxRegionLines = configV2.validation?.anchor_max_lines ?? 12;

  for (const method of methodRanges) {
    const kind = method.kind === "constructor" ? "constructor" : "method";
    if (getRangeLineCount(method) <= maxRegionLines) {
      addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
        ...method,
        kind,
        topics: kind === "constructor"
          ? ["Class / Object / Constructor"]
          : ["Functions / Methods / Parameters / Return Type"],
      });
    } else {
      addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
        kind,
        name: method.name,
        start: method.start,
        end: method.start,
        topics: kind === "constructor"
          ? ["Class / Object / Constructor"]
          : ["Functions / Methods / Parameters / Return Type"],
      });
    }

    for (let lineNumber = method.start; lineNumber <= method.end; lineNumber++) {
      const line = solutionLines[lineNumber - 1] || "";
      const trimmed = line.trim();

      if (/\b(?:if|else\s+if|switch|for|while)\s*\(|\bdo\b/.test(trimmed)) {
        addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
          ...getBraceBlockRange(solutionLines, lineNumber, maxRegionLines),
          kind: "control",
          name: method.name,
          topics: ["Control Structures / Loops"],
        });
      }

      if (isArrayCreationLine(line) || /\b(?:ArrayList|List|Collection|Map|Set|Queue|Deque)\b/.test(line)) {
        addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
          start: lineNumber,
          end: lineNumber,
          kind: "array",
          name: method.name,
          topics: ["Array / ArrayList"],
        });
      }

      if (isObjectCreationLine(line)) {
        addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
          start: lineNumber,
          end: lineNumber,
          kind: "object_creation",
          name: method.name,
          topics: ["Class / Object / Constructor"],
        });
      }

      if (isGuardLine(line) || isExceptionHandlingLine(line)) {
        addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
          ...getBraceBlockRange(solutionLines, lineNumber, maxRegionLines),
          kind: "guard",
          name: method.name,
          topics: ["Exception Handling / Runtime Safety"],
        });
      }

      if (/\breturn\b/.test(trimmed)) {
        addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
          start: Math.max(method.start, lineNumber - 2),
          end: lineNumber,
          kind: "return_path",
          name: method.name,
          topics: ["Functions / Methods / Parameters / Return Type"],
        });
      }
    }
  }
}

function collectClassAndRelationshipRegions(regions, seenAnchors, solutionLines, fullSolution) {
  solutionLines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (/\bclass\s+[A-Za-z_$][A-Za-z0-9_$]*\b/.test(trimmed)) {
      addCodeRegion(regions, seenAnchors, solutionLines, fullSolution, {
        start: lineNumber,
        end: lineNumber,
        kind: /\b(?:extends|implements)\b/.test(trimmed) ? "relationship" : "class",
        topics: /\b(?:extends|implements)\b/.test(trimmed)
          ? ["IS-A / HAS-A Relationship, Inheritance / Association"]
          : ["Class / Object / Constructor"],
      });
    }
  });
}

function selectBalancedCodeRegions(regions, maxRegions, maxChars) {
  const allowedTopics = configV2.validation?.allowed_topics || [];
  const sorted = [...regions].sort((left, right) =>
    right.score - left.score || getRangeLineCount(left) - getRangeLineCount(right)
  );
  const selected = [];
  const selectedAnchors = new Set();
  let charCount = 0;

  const addSelected = (region) => {
    if (!region || selected.length >= maxRegions || selectedAnchors.has(region.anchor)) return false;
    const nextCharCount = charCount + region.anchor.length + 220;
    if (nextCharCount > maxChars && selected.length > 0) return false;
    selected.push(region);
    selectedAnchors.add(region.anchor);
    charCount = nextCharCount;
    return true;
  };

  for (const topic of allowedTopics) {
    addSelected(sorted.find((region) => region.topics.includes(topic)));
  }

  for (const region of sorted) {
    addSelected(region);
  }

  return selected;
}

function buildSubmittedCodeRegionContext(submittedSolution) {
  const fullSolution = String(submittedSolution || "");
  const solutionLines = getSolutionLines(fullSolution);
  const maxRegions = configV2.generation?.max_context_regions ?? DEFAULT_MAX_CONTEXT_REGIONS;
  const maxChars = configV2.generation?.max_context_chars ?? DEFAULT_MAX_CONTEXT_CHARS;
  const methodRanges = getJavaMethodRanges(solutionLines);
  const regions = [];
  const seenAnchors = new Set();

  collectFieldRegions(regions, seenAnchors, solutionLines, fullSolution, methodRanges);
  collectMethodRegions(regions, seenAnchors, solutionLines, fullSolution, methodRanges);
  collectClassAndRelationshipRegions(regions, seenAnchors, solutionLines, fullSolution);

  const selected = selectBalancedCodeRegions(regions, maxRegions, maxChars);
  if (selected.length === 0) {
    return {
      regionCount: 0,
      originalLength: fullSolution.length,
      text: fullSolution.slice(0, maxChars),
    };
  }

  const text = [
    "The following are exact excerpts from the student's submitted Java solution.",
    "Choose code_anchor only from the code lines inside one region. Do not include REGION labels, topic labels, or this instruction text in code_anchor.",
    "",
    ...selected.map((region, index) => [
      `REGION ${index + 1}`,
      `Kind: ${region.kind}`,
      `Topics: ${region.topics.join("; ")}`,
      "Code:",
      region.anchor,
      `END REGION ${index + 1}`,
    ].join("\n")),
  ].join("\n\n");

  return {
    regionCount: selected.length,
    originalLength: fullSolution.length,
    text,
  };
}

function expandRangeToUnique(range, solution, question, maxLines) {
  const solutionLines = getSolutionLines(solution);
  const options = [];

  for (let length = range.end - range.start + 1; length <= maxLines; length++) {
    const minStart = Math.max(1, range.end - length + 1);
    const maxStart = Math.min(range.start, solutionLines.length - length + 1);

    for (let start = minStart; start <= maxStart; start++) {
      const end = start + length - 1;
      if (start > range.start || end < range.end) continue;

      const anchor = solutionLines.slice(start - 1, end).join("\n");
      if (findCodeAnchorMatches(anchor, solution).length === 1) {
        options.push({
          start,
          end,
          anchor,
          length,
          contextScore: scoreRangeContext({ start, end }, solutionLines, question),
        });
      }
    }
  }

  options.sort((left, right) =>
    right.contextScore - left.contextScore
    || left.length - right.length
    || left.start - right.start
  );
  return options[0] || null;
}

function resolveQuestionAnchor(question, submittedSolution, usedRanges) {
  const solutionLines = getSolutionLines(submittedSolution);
  const maxLines = configV2.validation?.anchor_max_lines ?? 6;
  const methodRanges = getJavaMethodRanges(solutionLines);
  const mentionedMethods = getMentionedMethodNames(question, solutionLines);
  const expectsMethodOverview = isMethodOverviewQuestion(question, mentionedMethods);
  const anchorIntent = getQuestionAnchorIntent(question);
  const originalAnchor = cleanSnippet(question.code_anchor);
  let candidates = findCodeAnchorMatches(originalAnchor, submittedSolution);
  let resolution = candidates.length > 0 ? "exact" : "";

  if (candidates.length === 0 && originalAnchor) {
    candidates = findCodeAnchorMatches(
      originalAnchor,
      submittedSolution,
      (line) => line.replace(/\s+/g, "")
    );
    if (candidates.length > 0) resolution = "whitespace_normalized";
  }

  if (candidates.length === 0 && originalAnchor) {
    candidates = findRelaxedCodeAnchorMatches(originalAnchor, submittedSolution);
    if (candidates.length > 0) resolution = "relaxed_prefix";
  }

  if (mentionedMethods.length > 0 && candidates.length > 0) {
    const methodScopedCandidates = candidates.filter((range) =>
      rangeIsInsideMentionedMethod(range, methodRanges, mentionedMethods)
    );
    if (methodScopedCandidates.length > 0) {
      candidates = methodScopedCandidates;
    } else {
      candidates = [];
      resolution = "";
    }
  }

  if (candidates.length > 0) {
    const intentCandidates = candidates.filter((range) => {
      const candidateText = solutionLines.slice(range.start - 1, range.end).join("\n");
      return anchorSatisfiesQuestionIntent(candidateText, question);
    });

    if (intentCandidates.length > 0) {
      candidates = intentCandidates;
    } else if (hasRequiredAnchorIntent(anchorIntent)) {
      candidates = [];
      resolution = "";
    }
  }

  const anchorTokens = tokenizeJava(originalAnchor);
  if (candidates.length === 0) {
    const methodCandidates = getMentionedMethodCandidateRanges(
      mentionedMethods,
      methodRanges,
      solutionLines
    );
    const intentCandidates = getIntentCandidateRanges(question, solutionLines);
    const topicCandidates = methodCandidates.length > 0
      ? methodCandidates
      : intentCandidates.length > 0
        ? intentCandidates
      : getTopicCandidateRanges(question.dimension, solutionLines);
    const fallbackCandidates = topicCandidates.length > 0
      ? topicCandidates
      : solutionLines
          .map((line, index) => line.trim() ? { start: index + 1, end: index + 1 } : null)
          .filter(Boolean);

    candidates = fallbackCandidates
      .map((range) => {
        const candidateText = solutionLines.slice(range.start - 1, range.end).join("\n");
        return {
          ...range,
          similarity: diceSimilarity(anchorTokens, tokenizeJava(candidateText)),
        };
      })
      .sort((left, right) =>
        right.similarity - left.similarity
        || scoreRangeContext(right, solutionLines, question)
          - scoreRangeContext(left, solutionLines, question)
      );
    resolution = methodCandidates.length > 0
      ? "mentioned_method_fallback"
      : intentCandidates.length > 0
        ? "intent_fallback"
      : candidates[0]?.similarity >= 0.45 ? "fuzzy" : "topic_fallback";
  }

  let ranked = candidates
    .filter((range) => !usedRanges.has(`${range.start}:${range.end}`))
    .filter((range) => rangeIsInsideMentionedMethod(range, methodRanges, mentionedMethods))
    .map((range) => ({
      ...range,
      contextScore: scoreRangeContext(range, solutionLines, question),
      similarity: range.similarity ?? 1,
    }))
    .sort((left, right) =>
      right.similarity - left.similarity
      || right.contextScore - left.contextScore
      || left.start - right.start
    );

  if (ranked.length === 0) {
    const methodCandidates = getMentionedMethodCandidateRanges(
      mentionedMethods,
      methodRanges,
      solutionLines
    );
    const intentCandidates = getIntentCandidateRanges(question, solutionLines);
    resolution = methodCandidates.length > 0
      ? "mentioned_method_fallback"
      : intentCandidates.length > 0 ? "intent_fallback" : "topic_fallback";
    ranked = (methodCandidates.length > 0
      ? methodCandidates
      : intentCandidates.length > 0
        ? intentCandidates
      : getTopicCandidateRanges(question.dimension, solutionLines))
      .filter((range) => !usedRanges.has(`${range.start}:${range.end}`))
      .filter((range) => rangeIsInsideMentionedMethod(range, methodRanges, mentionedMethods))
      .map((range) => ({
        ...range,
        contextScore: scoreRangeContext(range, solutionLines, question),
        similarity: diceSimilarity(
          anchorTokens,
          tokenizeJava(solutionLines[range.start - 1])
        ),
      }))
      .sort((left, right) =>
        right.similarity - left.similarity
        || right.contextScore - left.contextScore
        || left.start - right.start
      );
  }

  for (const candidate of ranked) {
    const expanded = expandRangeToUnique(candidate, submittedSolution, question, maxLines);
    if (!expanded) continue;

    const containingMethod = findContainingMethod(expanded, methodRanges);
    if (
      mentionedMethods.length > 0 &&
      (!containingMethod || !mentionedMethods.includes(containingMethod.name))
    ) {
      continue;
    }

    let finalExpanded = expanded;
    if (
      containingMethod &&
      (expectsMethodOverview || (anchorIntent.wantsMethodContext && expanded.anchor.split(/\r?\n/).some(isGuardLine)))
    ) {
      const methodLength = containingMethod.end - containingMethod.start + 1;
      if (methodLength > maxLines) {
        continue;
      }

      const methodAnchor = solutionLines
        .slice(containingMethod.start - 1, containingMethod.end)
        .join("\n");
      if (findCodeAnchorMatches(methodAnchor, submittedSolution).length !== 1) {
        continue;
      }

      finalExpanded = {
        ...expanded,
        start: containingMethod.start,
        end: containingMethod.end,
        anchor: methodAnchor,
      };
    }

    // `cleanSnippet` removes leading/trailing blank lines. Expansion may have
    // selected one of those blank lines to make a repeated fragment unique,
    // so retain neither its old range nor its raw text. Re-resolve the exact
    // canonical anchor before saving line numbers; otherwise validation sees
    // an off-by-one range despite the anchor itself being valid.
    const canonicalMatch = findUniqueCodeAnchorRange(finalExpanded.anchor, submittedSolution);
    if (canonicalMatch.status !== "unique") {
      continue;
    }
    finalExpanded = {
      ...finalExpanded,
      start: canonicalMatch.range.start,
      end: canonicalMatch.range.end,
      anchor: solutionLines
        .slice(canonicalMatch.range.start - 1, canonicalMatch.range.end)
        .join("\n"),
    };

    if (!anchorSatisfiesQuestionIntent(finalExpanded.anchor, question)) {
      continue;
    }

    const rangeKey = `${finalExpanded.start}:${finalExpanded.end}`;
    if (usedRanges.has(rangeKey)) continue;

    usedRanges.add(rangeKey);
    const wasExpanded = finalExpanded.start !== candidate.start || finalExpanded.end !== candidate.end;
    return {
      ...question,
      code_anchor: finalExpanded.anchor,
      code_snippet: finalExpanded.anchor,
      code_line_start: finalExpanded.start,
      code_line_end: finalExpanded.end,
      anchor_resolution: wasExpanded ? `${resolution}_expanded` : resolution,
    };
  }

  // A missing LLM anchor should not invalidate every otherwise usable
  // question. Select a unique, unused code range deterministically, favoring
  // the question's intent and topic. This is especially important for short
  // submissions where the requested topic is present but the model omitted
  // its code_anchor field.
  const fallbackRanges = [
    ...getIntentCandidateRanges(question, solutionLines),
    ...getTopicCandidateRanges(question.dimension, solutionLines),
    ...solutionLines
      .map((line, index) => line.trim() ? { start: index + 1, end: index + 1 } : null)
      .filter(Boolean),
  ];
  const seenFallbackRanges = new Set();
  const fallback = fallbackRanges
    .filter((range) => {
      const key = `${range.start}:${range.end}`;
      if (seenFallbackRanges.has(key) || usedRanges.has(key)) return false;
      seenFallbackRanges.add(key);
      return rangeIsInsideMentionedMethod(range, methodRanges, mentionedMethods);
    })
    .map((range) => expandRangeToUnique(range, submittedSolution, question, maxLines))
    .filter(Boolean)
    .map((range) => {
      const match = findUniqueCodeAnchorRange(range.anchor, submittedSolution);
      if (match.status !== "unique") return null;
      const canonicalRange = {
        start: match.range.start,
        end: match.range.end,
        anchor: solutionLines.slice(match.range.start - 1, match.range.end).join("\n"),
      };
      return {
        ...canonicalRange,
        intentMatch: anchorSatisfiesQuestionIntent(canonicalRange.anchor, question) ? 1 : 0,
        contextScore: scoreRangeContext(canonicalRange, solutionLines, question),
      };
    })
    .filter(Boolean)
    .filter((range) => !usedRanges.has(`${range.start}:${range.end}`))
    .sort((left, right) =>
      right.intentMatch - left.intentMatch
      || right.contextScore - left.contextScore
      || (left.end - left.start) - (right.end - right.start)
      || left.start - right.start
    )[0];

  if (fallback) {
    usedRanges.add(`${fallback.start}:${fallback.end}`);
    return {
      ...question,
      code_anchor: fallback.anchor,
      code_snippet: fallback.anchor,
      code_line_start: fallback.start,
      code_line_end: fallback.end,
      anchor_resolution: "deterministic_fallback",
    };
  }

  return {
    ...question,
    code_anchor: "",
    code_snippet: "",
    code_line_start: undefined,
    code_line_end: undefined,
    anchor_resolution: "unresolved",
  };
}

function resolveQuestionAnchors(questions, submittedSolution) {
  const usedRanges = new Set();
  return questions.map((question) =>
    resolveQuestionAnchor(question, submittedSolution, usedRanges)
  );
}

function validateParsedQuestions(questions, submittedSolution) {
  const errors = [];
  const expectedLayout = configV2.validation?.expected_layout || [];
  const expectedByQid = new Map(
    expectedLayout.map((item) => [
      `C${String(item.number).padStart(2, "0")}`,
      {
        level: String(item.level || "").toLowerCase(),
        topic: String(item.topic || "").trim(),
      },
    ])
  );
  const allowedTopics = configV2.validation?.allowed_topics
    || expectedLayout.map((item) => item.topic).filter(Boolean);
  const normalizedAllowedTopics = allowedTopics.map(normalizeTopicLabel);
  const expectedLevels = new Map(
    (configV2.validation?.expected_levels || []).map((item) => [
      `C${String(item.number).padStart(2, "0")}`,
      String(item.level || "").toLowerCase(),
    ])
  );
  const minAnchorLines = configV2.validation?.anchor_min_lines ?? 1;
  const maxAnchorLines = configV2.validation?.anchor_max_lines ?? 6;

  if (questions.length !== CODE_LLM_COUNT) {
    errors.push(`Expected ${CODE_LLM_COUNT} LLM questions, parsed ${questions.length}.`);
  }

  const seenAnchors = new Map();
  const seenQids = new Set();
  for (const question of questions) {
    if (seenQids.has(question.qid)) {
      errors.push(`${question.qid}: duplicate question number.`);
    }
    seenQids.add(question.qid);

    const expected = expectedByQid.get(question.qid);
    const expectedLevel = expected?.level || expectedLevels.get(question.qid);
    if (expectedLevel && question.difficulty !== expectedLevel) {
      errors.push(`${question.qid}: expected ${expectedLevel}, found ${question.difficulty}.`);
    }

    if (expected?.topic && question.dimension !== normalizeTopicLabel(expected.topic)) {
      errors.push(`${question.qid}: expected topic '${normalizeTopicLabel(expected.topic)}', found '${question.dimension}'.`);
    }
    if (normalizedAllowedTopics.length > 0 && !normalizedAllowedTopics.includes(question.dimension)) {
      errors.push(`${question.qid}: unexpected topic '${question.dimension}'.`);
    }

    const rangeErrors = validateSubmittedCodeQuestionRange(question, submittedSolution);
    if (rangeErrors.length > 0) {
      errors.push(...rangeErrors);
    } else {
      const anchorLines = normalizeCodeLines(question.code_anchor);
      const anchorKey = anchorLines.join("\n");
      if (anchorLines.length < minAnchorLines || anchorLines.length > maxAnchorLines) {
        errors.push(
          `${question.qid}: code_anchor must contain ${minAnchorLines}-${maxAnchorLines} lines, found ${anchorLines.length}.`
        );
      }

      const match = findUniqueCodeAnchorRange(question.code_anchor, submittedSolution);
      if (match.status === "missing") {
        errors.push(`${question.qid}: code_anchor was not found in the submitted solution.`);
      } else if (match.status === "ambiguous") {
        errors.push(`${question.qid}: code_anchor matched ${match.matches.length} locations.`);
      }

      if (seenAnchors.has(anchorKey)) {
        errors.push(`${question.qid}: code_anchor duplicates ${seenAnchors.get(anchorKey)}.`);
      } else {
        seenAnchors.set(anchorKey, question.qid);
      }

      const solutionLines = getSolutionLines(submittedSolution);
      const methodRanges = getJavaMethodRanges(solutionLines);
      const mentionedMethods = getMentionedMethodNames(question, solutionLines);
      if (false) {
        const containingMethod = findContainingMethod(match.range, methodRanges);
        if (!containingMethod || !mentionedMethods.includes(containingMethod.name)) {
          errors.push(
            `${question.qid}: question mentions method '${mentionedMethods.join(", ")}' but code_anchor is not inside that method.`
          );
        }
        if (
          isMethodOverviewQuestion(question, mentionedMethods) &&
          !anchorContainsMentionedMethod(question.code_anchor, mentionedMethods)
        ) {
          errors.push(
            `${question.qid}: method-level question must show the mentioned method signature in code_anchor.`
          );
        }
      }
    }

    if (!question.question.trim()) {
      errors.push(`${question.qid}: missing Question.`);
    }
    if (!question.rubric.trim()) {
      errors.push(`${question.qid}: missing Expected Answer.`);
    }
    if (!question.assessment_angle.trim()) {
      errors.push(`${question.qid}: missing Evaluator Guide.`);
    }
    if (!Array.isArray(question.answer_criteria) || question.answer_criteria.length < 2) {
      errors.push(`${question.qid}: answer_criteria must contain at least 2 marking points.`);
    } else {
      const totalMarks = question.answer_criteria.reduce(
        (total, criterion) => total + (Number(criterion.marks) || 0),
        0
      );
      if (totalMarks !== 5) {
        errors.push(`${question.qid}: answer_criteria marks must total 5, found ${totalMarks}.`);
      }
      if (question.answer_criteria.some((criterion) => !criterion.point)) {
        errors.push(`${question.qid}: answer_criteria contains an empty marking point.`);
      }
    }
    if (!question.scoring_guide?.full
      || !question.scoring_guide?.partial
      || !question.scoring_guide?.minimal
      || !question.scoring_guide?.zero) {
      errors.push(`${question.qid}: incomplete scoring_guide.`);
    }
    if (!question.evaluates.trim()) {
      errors.push(`${question.qid}: missing Evaluates.`);
    }
  }

  for (const expectedQid of expectedByQid.keys()) {
    if (!seenQids.has(expectedQid)) {
      errors.push(`${expectedQid}: missing question.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`QUESTION_GENERATION_VALIDATION_FAILED: ${errors.join(" ")}`);
  }
}

/**
 * Generate JSON code-anchor questions using the V2 LLM approach.
 *
 * @param {object} opts
 * @param {string} opts.code - Submitted Java code
 * @param {string} opts.topic - Original problem question/description
 * @returns {Promise<object[]>} - Normalized question objects
 */
function estimatePromptTokens(userPrompt, maxTokens) {
  const charEstimate = Math.ceil(String(userPrompt || "").length / 4);
  const maxTokenEstimate = Math.max(512, Number(maxTokens) || 0);
  return Math.max(512, Math.ceil((charEstimate + maxTokenEstimate) / 2));
}

async function generateLlmQuestionsV2({ code, topic, round1Intent }) {
  if (!code || !String(code).trim()) {
    console.warn("[GeneratorV2] No submitted code provided; skipping LLM generation.");
    return [];
  }

  console.log(`[GeneratorV2] Generating ${CODE_LLM_COUNT} JSON code-anchor questions...`);

  const api = configV2.api || {};
  const generationConfig = configV2.generation || {};
  const generationScheduler = createQuestionGenerationScheduler(generationConfig.scheduler || {});
  const systemPrompt = configV2.prompts.system;
  const userTemplate = configV2.prompts.user_template;
  const temperature = configV2.generation?.temperature ?? 0.35;
  const maxTokens = configV2.generation?.max_tokens ?? 3000;
  const codeRegionContext = buildSubmittedCodeRegionContext(code || "");
  console.log(
    `[GeneratorV2] Sending ${codeRegionContext.regionCount || "fallback"} code region(s) `
    + `(${codeRegionContext.text.length}/${codeRegionContext.originalLength} chars) to LLM.`
  );

  let round1ContextText = "";
  if (round1Intent) {
    round1ContextText = `\n\nCANDIDATE ROUND 1 PRE-CODING INTENT:
- Stated Algorithm / Approach: ${round1Intent.claimedAlgorithm || "Not specified"}
- Stated Data Structures: ${round1Intent.claimedDataStructures || "Not specified"}
- Stated Time/Space Complexity: ${round1Intent.claimedComplexity || "Not specified"}
- Identified Edge Cases: ${round1Intent.identifiedEdgeCases || "Not specified"}
${round1Intent.candidateResponsesSummary ? `Candidate Round 1 Statements: ${round1Intent.candidateResponsesSummary}` : ""}
When creating code-anchor questions, please connect the code lines to the approach, complexity, or data structures the candidate declared in Round 1 where applicable (e.g., verifying if the code matches their planned complexity or algorithm).`;
  }

  const baseUserPrompt = buildV2Prompt(userTemplate, topic || "", codeRegionContext.text)
    + round1ContextText
    + CODE_QUESTION_PROMPT_GUARDRAILS;
  const validationRetryAttempts = Number(configV2.generation?.validation_retry_attempts);
  const maxAttempts = Math.max(
    1,
    Number.isFinite(validationRetryAttempts) ? validationRetryAttempts + 1 : 1
  );
  let lastError = null;
  let retryValidationMessage = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {


      console.log(`[GeneratorV2] LLM generation attempt ${attempt}/${maxAttempts}...`);
      const userPrompt = retryValidationMessage
        ? buildValidationRetryPrompt(baseUserPrompt, retryValidationMessage)
        : baseUserPrompt;
      const payload = await generationScheduler.run(() => callJsonLlm({
        apiUrl: api.url,
        apiKeyEnv: api.key_env,
        model: process.env.GROQ_QUESTION_MODEL || api.model,
        fallbackModel: process.env.GROQ_FALLBACK_MODEL,
        retryAttempts: api.retry_attempts,
        systemPrompt,
        temperature,
        timeoutSeconds: api.timeout_seconds,
        userAgent: api.user_agent,
        userPrompt,
        maxTokens,
        taskName: "QUESTION_GENERATION",
      }), estimatePromptTokens(userPrompt, maxTokens));

      console.log("[GeneratorV2] LLM JSON received. Validating code anchors...");

      const parsedQuestions = parseV2JsonOutput(payload);
      const questions = resolveQuestionAnchors(parsedQuestions, code || "");
      for (const question of questions) {
        console.log(
          `[GeneratorV2] ${question.qid} anchor=${question.anchor_resolution} `
          + `lines=${question.code_line_start || "-"}-${question.code_line_end || "-"}`
        );
      }
      validateParsedQuestions(questions, code || "");
      validateQuestionSourceContracts(questions, code || "");

      console.log(`[GeneratorV2] Parsed and validated ${questions.length} LLM questions.`);
      return questions;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[GeneratorV2] Attempt ${attempt}/${maxAttempts} failed validation: ${lastError.message}`
      );
      if (attempt >= maxAttempts) {
        break;
      }
      retryValidationMessage = lastError.message;
    }
  }

  console.warn(`[GeneratorV2] Falling back to benchmark-only questions because LLM generation failed: ${lastError?.message || "unknown error"}`);
  return [];
}

/**
 * Generate interview questions using the hybrid V2 pipeline.
 *
 * @param {object} opts
 * @param {string} [opts.code] - Submitted Java code
 * @param {string} [opts.topic] - Topic or problem description
 * @param {object} [opts.round1Intent] - Round 1 pre-code intent and architecture
 * @returns {Promise<{questions: object[], counts: object, conceptExtraction: object}>}
 */
async function generateQuestionsV2({ code, topic, round1Intent }) {
  console.log("[GeneratorV2] Starting hybrid question generation pipeline with Round 1 cross-linkage...");

  const [csvQuestionsResult, codeQuestionsResult] = await Promise.allSettled([
    Promise.resolve().then(() => sampleBalancedCsvQuestions(CSV_COUNT)),
    generateLlmQuestionsV2({ code, topic, round1Intent }),
  ]);

  const targetQuestionCount = Math.max(INTERVIEW_QUESTION_COUNT, CSV_COUNT + CODE_LLM_COUNT);

  const csvQuestions = csvQuestionsResult.status === "fulfilled" ? csvQuestionsResult.value : [];
  const codeQuestions = codeQuestionsResult.status === "fulfilled" ? codeQuestionsResult.value : [];

  if (codeQuestionsResult.status === "rejected") {
    console.warn(`[GeneratorV2] LLM question generation failed; continuing with benchmark questions only. ${codeQuestionsResult.reason?.message || codeQuestionsResult.reason}`);
  }

  // CSV questions are benchmark questions. They must not be anchored to, or
  // presented as if they came from, the submitted code.
  const benchmarkQuestions = csvQuestions.map((question) => ({
    ...question,
    source: QUESTION_SOURCES.BENCHMARK_CSV,
    code_anchor: "",
    code_snippet: "",
    code_line_start: undefined,
    code_line_end: undefined,
    anchor_resolution: "not_applicable",
  }));

  const allQuestions = [...benchmarkQuestions, ...codeQuestions].slice(0, targetQuestionCount);
  validateQuestionSourceContracts(allQuestions, code || "");

  const counts = {
    basic: allQuestions.filter((q) => q.difficulty === "basic").length,
    intermediate: allQuestions.filter((q) => q.difficulty === "intermediate").length,
    hard: allQuestions.filter((q) => q.difficulty === "hard" || q.difficulty === "advanced").length,
  };

  const selectedTopics = [...new Set(allQuestions.map((q) => q.dimension).filter(Boolean))];
  const conceptExtraction = {
    domain: "Java",
    user_intent: topic || code || "Java interview",
    concepts: selectedTopics.map((selectedTopic, index) => ({
      concept: selectedTopic,
      priority: index + 1,
      rationale: "Selected from benchmark CSV and submitted-code LLM question topics.",
      tags: [selectedTopic],
    })),
  };

  return {
    questions: allQuestions,
    counts,
    conceptExtraction,
  };
}

module.exports = {
  generateQuestionsV2,
  generateLlmQuestionsV2,
  createQuestionGenerationScheduler,
  sampleBalancedCsvQuestions,
  normalizeTopicLabel,
  parseV2JsonOutput,
  findUniqueCodeAnchorRange,
  buildSubmittedCodeRegionContext,
  getJavaMethodRanges,
  getMentionedMethodNames,
  resolveQuestionAnchors,
  validateParsedQuestions,
  validateQuestionSourceContracts,
};
