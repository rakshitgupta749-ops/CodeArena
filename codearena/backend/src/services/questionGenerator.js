/**
 * Agent 2: Question Generator
 *
 * Full pipeline: concept extraction → question generation → difficulty
 * classification → quality evaluation → local guards → rebalance → dedupe → select
 */

const path = require("path");
const { callJsonLlm } = require("./llmClient");

// Load static AI context files
const conceptSchema = require("../ai-context/concept_schema.json");
const questionRules = require("../ai-context/question_rules.json");
const styleGuide = require("../ai-context/question_style_guide.json");
const benchmarkQuestions = require("../ai-context/benchmark_questions.json");

// ── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = "You are a strict JSON-only Java assessment pipeline component.";

const DIFFICULTY_TARGET = { basic: 4, intermediate: 3, hard: 3 };
const N_FINAL = 10;

const HARD_SIGNAL_PHRASES = [
  "changed requirement", "requirement changed", "edge case", "trade-off",
  "constraint", "failure mode", "debug", "redesign", "adapt",
  "what would happen", "how would you handle",
];

const STOPWORDS = new Set(
  "a an and are as at be by can could did do does for from how if in is it me of on or should step the this through to what when why with would you your".split(" ")
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function clamp(val, min, max) {
  return Math.round(Math.min(Math.max(val, min), max) * 100) / 100;
}

function snapToNearest(value, allowed) {
  let closest = allowed[0];
  let minDist = Math.abs(value - closest);
  for (const v of allowed) {
    const dist = Math.abs(value - v);
    if (dist < minDist) {
      minDist = dist;
      closest = v;
    }
  }
  return closest;
}

// ── Step 1: Normalize Input ─────────────────────────────────────────────────

function normalizeInput({ code, topic }) {
  const parts = [];
  if (code && code.trim()) {
    parts.push(`User submitted Java code:\n${code.trim()}`);
  }
  if (topic && topic.trim()) {
    parts.push(`User topic or intent:\n${topic.trim()}`);
  }
  if (parts.length === 0) {
    throw new Error("INVALID_REQUEST: Both code and topic are empty.");
  }
  return parts.join("\n\n");
}

// ── Step 2: Concept Extraction (LLM call) ────────────────────────────────────

async function extractConcepts(userInput) {
  const userPrompt = `You are a Java assessment concept extractor.

Task:
Extract the main concepts from the user's input so a question generator can create personalized Java interview questions.

Rules:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- No extra commentary.
- Focus on Java-relevant concepts, sub-concepts, and interview angles.
- Prefer 3 to 8 concepts.
- Rank concepts by priority, where 1 is highest priority.
- Include concise rationale for each concept.

User input:
${userInput}

Return this JSON schema exactly:
{
  "domain": "string",
  "user_intent": "string",
  "concepts": [
    {
      "concept": "string",
      "priority": 1,
      "rationale": "string",
      "tags": ["string", "string"]
    }
  ]
}`;

  try {
    const result = await callJsonLlm({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.0,
      maxTokens: 1200,
    });

    return {
      domain: result.domain || "Java",
      user_intent: result.user_intent || userInput,
      concepts: Array.isArray(result.concepts) ? result.concepts : [],
    };
  } catch (err) {
    console.error("Concept extraction failed, using fallback:", err.message);
    return {
      domain: "Java",
      user_intent: userInput,
      concepts: [],
    };
  }
}

// ── Step 3: Generate Candidate Questions (LLM call) ──────────────────────────

async function generateCandidates(userInput, conceptExtraction, nCandidates) {
  const retrievedContext = {
    domain: "Java",
    user_intent: conceptExtraction.user_intent,
    retrieved_context: [],
  };

  const userPrompt = `You are a Java assessment question generator.

Task:
Generate personalized interview questions based on the user's input, extracted concepts, and retrieved context.

Rules:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- No explanation text.
- Generate between 4 and 8 candidate questions per concept if possible.
- Questions must be human-centric, conceptual, Java-focused, and answerable.
- Write like a friendly technical recruiter speaking to a trainee in a respectful interview.
- Keep the tone formal, polite, calm, and encouraging.
- Prefer natural interviewer openings such as "Let's look at...", "In a real project...", "Suppose you're reviewing...", "Can you walk me through...", and "How would you decide...".
- Avoid textbook-style openings such as "Define", "What is the purpose of", "Can you explain the concept of", and repeated "Can you describe" phrasing.
-  y on Java thinking.
- Do not hallucinate project details, file paths, class names, method names, variables, bugs, or requirements that are not present in the input/context.
- Do not introduce advanced topics unless they appear in the extracted concepts, retrieved context, or user intent.
- Only personalize when supported by the user input, extracted concepts, retrieved context, or explicit snippets.
- Write each question in recruiter-style conversational phrasing: warm, respectful, formal, and natural.
- Keep the 4 dimensions balanced:
  1) Conceptual Understanding
  2) Solution Articulation & Clarity
  3) Analytical Thinking & Reasoning
  4) Adaptability & Depth of Insight
- For approximately ${nCandidates} candidates, include at least:
  - 4 basic candidates,
  - 4 intermediate candidates,
  - 4 hard candidates.
- Hard candidates must clearly involve at least one of: edge case, changed requirement, trade-off, constraint, failure mode, debugging under uncertainty, or redesign decision.
- Do not label a direct explanation question as hard.
- Avoid duplicates, near-duplicates, and semantic duplicates. Different phrasing is not enough; each question must test a logically different idea.
- Every candidate must include a distinct assessment_angle that explains the exact technical thinking skill being tested.
- Do not repeat the same assessment_angle in different wording.
- Use the retrieved context as grounding, but do not copy benchmark questions verbatim.
- Questions may be direct, conversational, or scenario-based.
- If code-related, use a short Java snippet only when it helps reasoning about runtime behavior, debugging, null handling, loops, collections, or design choices.
- If you invent a snippet for assessment, frame it as "consider this small example" and never imply it came from the trainee.
- Keep snippets at 8 lines or fewer.
- If a question says "this code", "the code", "this example", or "above", the same question string must include the snippet or concrete example being referenced.
- Avoid vague phrases like "given problem", "more efficient", "optimize performance", or "improve readability" unless the question includes a concrete scenario or constraint.
- Spread candidates across source concepts. Do not let one source concept dominate the candidate list.
- Prefer practical Java reasoning over abstract definitions.

User intent:
${conceptExtraction.user_intent}

Extracted concepts:
${JSON.stringify(conceptExtraction.concepts)}

Retrieved context:
${JSON.stringify(retrievedContext)}

Global rules:
${JSON.stringify(questionRules.global_rules)}

Question style guide:
${JSON.stringify(styleGuide)}

Return this JSON schema exactly:
{
  "candidates": [
    {
      "qid": "G01",
      "dimension": "Conceptual Understanding",
      "difficulty": "basic",
      "question": "string",
      "rubric": "string",
      "assessment_angle": "string",
      "concept_tags": ["string", "string"],
      "rationale": "string",
      "source_concepts": ["string"]
    }
  ]
}

Generate approximately ${nCandidates} candidates.`;

  const result = await callJsonLlm({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.0,
    maxTokens: 3600,
  });

  const candidates = Array.isArray(result.candidates) ? result.candidates : [];

  // Normalize missing fields with defaults
  return candidates.map((c, i) => ({
    qid: c.qid || `G${String(i + 1).padStart(2, "0")}`,
    dimension: c.dimension || "Conceptual Understanding",
    difficulty: c.difficulty || "basic",
    question: c.question || "",
    rubric: c.rubric || "Evaluate the answer for correct Java reasoning.",
    assessment_angle: c.assessment_angle || "Assess technical reasoning about Java reasoning.",
    concept_tags: Array.isArray(c.concept_tags) ? c.concept_tags : [],
    source_concepts: Array.isArray(c.source_concepts) ? c.source_concepts : [],
    rationale: c.rationale || "",
  }));
}

// ── Step 4: Batch Difficulty Classification (LLM call) ───────────────────────

async function classifyDifficulty(candidates) {
  const ALLOWED_DIFFICULTIES = ["basic", "intermediate", "hard"];
  const chunks = chunkArray(candidates, 5);

  for (const chunk of chunks) {
    const compact = chunk.map((c) => ({
      qid: c.qid,
      dimension: c.dimension,
      difficulty: c.difficulty,
      question: c.question,
      assessment_angle: c.assessment_angle,
      concept_tags: c.concept_tags,
      source_concepts: c.source_concepts,
    }));

    const userPrompt = `You are a Java assessment difficulty classifier.

Task:
Classify each generated interview question as basic, intermediate, or hard.

Rules:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- No extra commentary.
- Use "basic" for definitions, single-concept explanations, and direct recall.
- Use "intermediate" for step-by-step explanation, comparison, or applied reasoning.
- Use "hard" for redesign, edge cases, trade-offs, constraints, or failure analysis.
- If a candidate is declared hard and asks about changed requirements, edge cases, trade-offs, constraints, failure modes, debugging under uncertainty, or redesign, keep it hard.
- Do not downgrade hard adaptability questions merely because the wording is polite.
- Every confidence score must be within the inclusive range 0.0 to 1.0.
- Return exactly one result for each input candidate qid.
- Keep each justification under 8 words.

Candidates:
${JSON.stringify(compact)}

Return this JSON schema exactly:
{
  "classified": [
    {
      "qid": "G01",
      "difficulty": "basic",
      "confidence": 0.0,
      "justification": "string"
    }
  ]
}`;

    try {
      const result = await callJsonLlm({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.0,
        maxTokens: 450,
      });

      const classified = Array.isArray(result.classified) ? result.classified : [];
      const classMap = new Map(classified.map((c) => [c.qid, c]));

      for (const candidate of chunk) {
        const cl = classMap.get(candidate.qid);
        if (cl) {
          candidate.difficulty = ALLOWED_DIFFICULTIES.includes(cl.difficulty)
            ? cl.difficulty
            : "basic";
          candidate.difficulty_confidence = clamp(
            typeof cl.confidence === "number" ? cl.confidence : 0.7,
            0.0,
            1.0
          );
          candidate.difficulty_reason = cl.justification || "";
        }
      }
    } catch (err) {
      console.error("Difficulty classification chunk failed:", err.message);
      // Keep original difficulties
    }
  }

  return candidates;
}

// ── Step 5: Batch Quality Evaluation (LLM call) ─────────────────────────────

async function evaluateQuality(candidates) {
  const chunks = chunkArray(candidates, 3);

  for (const chunk of chunks) {
    const compact = chunk.map((c) => ({
      qid: c.qid,
      dimension: c.dimension,
      difficulty: c.difficulty,
      question: c.question,
      rubric: c.rubric,
      assessment_angle: c.assessment_angle,
      concept_tags: c.concept_tags,
      source_concepts: c.source_concepts,
    }));

    const userPrompt = `You are a Java assessment question quality evaluator.

Task:
Evaluate whether each generated Java interview question is suitable for a trainee assessment.

Rules:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- No extra commentary.
- Every quality score must be within the inclusive range 0.0 to 1.0.
- Reward clear, Java-centric, answerable, non-duplicate, concept-grounded questions.
- Reward friendly, respectful, recruiter-like wording.
- Penalize vague, awkward, overly broad, malformed, duplicate, hallucinated, or unanswerable questions.
- Penalize questions that assess English fluency, grammar, or communication skill instead of Java reasoning.
- Penalize questions that invent unsupported project details, file paths, class names, variables, bugs, or requirements.
- Penalize questions that introduce advanced topics not present in extracted concepts, retrieved context, source concepts, concept tags, or user intent.
- Penalize questions that refer to "this code", "the code", "this example", or "above" without including the referenced snippet or scenario in the question text.
- Penalize vague wording such as "given problem", "more efficient", "optimize performance", or "improve readability" unless a concrete scenario or constraint is included.
- Penalize textbook-like phrasing and reward natural recruiter-style phrasing.
- Reward a clear and distinct assessment_angle.
- Return exactly one result for each input candidate qid.
- Keep quality_reason under 12 words.

Candidates:
${JSON.stringify(compact)}

Return this JSON schema exactly:
{
  "evaluated": [
    {
      "qid": "G01",
      "quality": 0.0,
      "quality_reason": "string",
      "checks": {
        "is_java_centric": true,
        "is_answerable": true,
        "is_specific": true,
        "is_human_friendly": true,
        "avoids_hallucinated_context": true,
        "avoids_english_skill_assessment": true,
        "has_distinct_assessment_angle": true,
        "has_complete_context": true,
        "is_recruiter_style": true,
        "score_is_in_range": true
      }
    }
  ]
}`;

    try {
      const result = await callJsonLlm({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.0,
        maxTokens: 700,
      });

      const evaluated = Array.isArray(result.evaluated) ? result.evaluated : [];
      const evalMap = new Map(evaluated.map((e) => [e.qid, e]));

      for (const candidate of chunk) {
        const ev = evalMap.get(candidate.qid);
        if (ev) {
          candidate.quality = clamp(
            typeof ev.quality === "number" ? ev.quality : 0.7,
            0.0,
            1.0
          );
          candidate.quality_reason = ev.quality_reason || "";
          candidate.quality_checks = ev.checks || {};
        } else {
          candidate.quality = 0.7;
          candidate.quality_reason = "Default quality.";
          candidate.quality_checks = {};
        }
      }
    } catch (err) {
      console.error("Quality evaluation chunk failed:", err.message);
      for (const candidate of chunk) {
        candidate.quality = 0.7;
        candidate.quality_reason = "Quality eval failed, using default.";
        candidate.quality_checks = {};
      }
    }
  }

  return candidates;
}

// ── Step 6: Local Quality Guards ─────────────────────────────────────────────

function applyLocalQualityGuards(candidates) {
  const codeTriggerPhrases = ["this code", "the code", "above"];
  const snippetMarkers = ["`", "{", ";"];
  const vaguePhrases = ["given problem", "more efficient", "optimize performance", "improve readability"];
  const concreteMarkers = ["suppose", "for example", "consider", "when ", "where "];
  const textbookOpeners = ["what is the purpose of", "can you explain the concept of", "define "];

  for (const c of candidates) {
    const qLower = c.question.toLowerCase();
    let reasons = [];

    // Check: references code without including a snippet
    const refsCode = codeTriggerPhrases.some((p) => qLower.includes(p));
    const hasSnippet = snippetMarkers.some((m) => c.question.includes(m));
    if (refsCode && !hasSnippet) {
      c.quality = clamp(c.quality - 0.35, 0.0, 1.0);
      if (c.quality_checks) c.quality_checks.has_complete_context = false;
      reasons.push("References code without including it.");
    }

    // Check: vague phrases without concrete scenario
    const hasVague = vaguePhrases.some((p) => qLower.includes(p));
    const hasConcrete = concreteMarkers.some((m) => qLower.includes(m));
    if (hasVague && !hasConcrete) {
      c.quality = clamp(c.quality - 0.2, 0.0, 1.0);
      if (c.quality_checks) c.quality_checks.is_specific = false;
      reasons.push("Needs a more concrete scenario.");
    }

    // Check: textbook openers
    const hasTextbook = textbookOpeners.some((p) => qLower.startsWith(p));
    if (hasTextbook) {
      c.quality = clamp(c.quality - 0.12, 0.0, 1.0);
      if (c.quality_checks) c.quality_checks.is_recruiter_style = false;
      reasons.push("Could sound more recruiter-like.");
    }

    if (reasons.length > 0) {
      c.quality_reason = [c.quality_reason, ...reasons].filter(Boolean).join(" ");
    }
  }

  return candidates;
}

// ── Step 7: Rebalance Hard Questions ─────────────────────────────────────────

function rebalanceHard(candidates) {
  const hardCount = candidates.filter((c) => c.difficulty === "hard").length;
  const needed = DIFFICULTY_TARGET.hard - hardCount;

  if (needed <= 0) return candidates;

  // Find promotable candidates
  const promotable = candidates
    .filter((c) => c.difficulty !== "hard")
    .filter((c) => {
      const qLower = c.question.toLowerCase();
      return HARD_SIGNAL_PHRASES.some((p) => qLower.includes(p));
    })
    .sort((a, b) => {
      if (b.quality !== a.quality) return b.quality - a.quality;
      return b.qid.localeCompare(a.qid);
    });

  for (let i = 0; i < Math.min(needed, promotable.length); i++) {
    promotable[i].difficulty = "hard";
    promotable[i].difficulty_confidence = Math.max(
      promotable[i].difficulty_confidence || 0,
      0.7
    );
    promotable[i].difficulty_reason =
      "Promoted to hard because it asks for adaptation, trade-off, edge-case, debugging, or redesign reasoning.";
  }

  return candidates;
}

// ── Step 8: Dedupe and Select ────────────────────────────────────────────────

function normalizeText(text) {
  return text.toLowerCase().replace(/[?,]/g, "").replace(/\s+/g, " ").trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((t) => !STOPWORDS.has(t) && t.length > 0);
}

function areSemanticallyDuplicate(a, b) {
  // Only compare same dimension
  if (a.dimension !== b.dimension) return false;

  // If they don't share concepts, allow both
  const aConcepts = new Set([...(a.source_concepts || []), ...(a.concept_tags || [])]);
  const bConcepts = new Set([...(b.source_concepts || []), ...(b.concept_tags || [])]);
  const sharedConcepts = [...aConcepts].some((c) => bConcepts.has(c));
  if (!sharedConcepts) return false;

  // If assessment_angle matches exactly
  if (
    normalizeText(a.assessment_angle || "") ===
    normalizeText(b.assessment_angle || "")
  ) {
    return true;
  }

  // Token overlap check
  const aTokens = new Set([
    ...tokenize(a.question),
    ...tokenize(a.assessment_angle || ""),
    ...(a.source_concepts || []).flatMap((c) => tokenize(c)),
    ...(a.concept_tags || []).flatMap((c) => tokenize(c)),
  ]);
  const bTokens = new Set([
    ...tokenize(b.question),
    ...tokenize(b.assessment_angle || ""),
    ...(b.source_concepts || []).flatMap((c) => tokenize(c)),
    ...(b.concept_tags || []).flatMap((c) => tokenize(c)),
  ]);

  const smaller = Math.min(aTokens.size, bTokens.size);
  if (smaller === 0) return false;

  const overlap = [...aTokens].filter((t) => bTokens.has(t)).length;
  return overlap / smaller >= 0.88;
}

function dedupeAndSelect(candidates, nFinal = N_FINAL) {
  // 1. Semantic dedup
  const deduped = [];
  for (const c of candidates) {
    const isDup = deduped.some((existing) => areSemanticallyDuplicate(existing, c));
    if (!isDup) {
      deduped.push(c);
    }
  }

  // 2. Sort by quality descending
  deduped.sort((a, b) => (b.quality || 0) - (a.quality || 0));

  // 3. Select by difficulty quota
  const selected = [];
  const conceptCount = new Map(); // track primary source concept usage

  for (const [diff, quota] of Object.entries(DIFFICULTY_TARGET)) {
    const pool = deduped.filter(
      (c) => c.difficulty === diff && !selected.includes(c)
    );

    let picked = 0;
    for (const c of pool) {
      if (picked >= quota) break;

      // Max 3 from same primary source concept
      const primaryConcept =
        (c.source_concepts && c.source_concepts[0]) ||
        (c.concept_tags && c.concept_tags[0]) ||
        "unknown";
      const count = conceptCount.get(primaryConcept) || 0;
      if (count >= 3) continue;

      selected.push(c);
      conceptCount.set(primaryConcept, count + 1);
      picked++;
    }
  }

  // If we don't have enough, fill from remaining
  if (selected.length < nFinal) {
    const remaining = deduped.filter((c) => !selected.includes(c));
    for (const c of remaining) {
      if (selected.length >= nFinal) break;
      selected.push(c);
    }
  }

  return selected.slice(0, nFinal);
}

// ── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Generate interview questions from submitted code and/or topic.
 *
 * @param {object} opts
 * @param {string} [opts.code] - Submitted Java code
 * @param {string} [opts.topic] - Topic or intent
 * @param {number} [opts.nCandidates=14] - Number of candidates to generate
 * @param {number} [opts.nFinal=10] - Number of final questions
 * @returns {Promise<{questions: object[], counts: object, conceptExtraction: object}>}
 */
async function generateQuestions({ code, topic, nCandidates = 14, nFinal = 10 }) {
  console.log("[Agent2] Starting question generation pipeline...");

  // Step 1: Normalize input
  const userInput = normalizeInput({ code, topic });
  console.log("[Agent2] Input normalized.");

  // Step 2: Concept extraction
  const conceptExtraction = await extractConcepts(userInput);
  console.log(`[Agent2] Extracted ${conceptExtraction.concepts.length} concepts.`);

  // Step 3: Generate candidates
  let candidates = await generateCandidates(userInput, conceptExtraction, nCandidates);
  console.log(`[Agent2] Generated ${candidates.length} candidates.`);

  if (candidates.length === 0) {
    throw new Error("QUESTION_GENERATION_FAILED: No candidates generated.");
  }

  // Step 4: Classify difficulty
  candidates = await classifyDifficulty(candidates);
  console.log("[Agent2] Difficulty classified.");

  // Step 5: Evaluate quality
  candidates = await evaluateQuality(candidates);
  console.log("[Agent2] Quality evaluated.");

  // Step 6: Local quality guards
  candidates = applyLocalQualityGuards(candidates);
  console.log("[Agent2] Local quality guards applied.");

  // Step 7: Rebalance hard
  candidates = rebalanceHard(candidates);
  console.log("[Agent2] Hard questions rebalanced.");

  // Step 8: Dedupe and select
  const finalQuestions = dedupeAndSelect(candidates, nFinal);
  console.log(`[Agent2] Selected ${finalQuestions.length} final questions.`);

  const counts = {
    basic: finalQuestions.filter((q) => q.difficulty === "basic").length,
    intermediate: finalQuestions.filter((q) => q.difficulty === "intermediate").length,
    hard: finalQuestions.filter((q) => q.difficulty === "hard").length,
  };

  return {
    questions: finalQuestions,
    counts,
    conceptExtraction,
  };
}

module.exports = { generateQuestions };
