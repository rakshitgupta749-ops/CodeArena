const scoringRules = require("../ai-context/scoring_rules.json");

const JAVA_LEXICON = [
  {
    keys: ["encapsulation", "private", "data hiding", "hide data", "access control"],
    variants: [
      "encapsulation",
      "data hiding",
      "hide data",
      "hide state",
      "access control",
      "control access",
      "restrict access",
      "private field",
      "private variable",
      "getter",
      "setter",
    ],
  },
  {
    keys: ["has-a", "has a", "composition", "aggregation"],
    variants: [
      "composition",
      "aggregation",
      "has a relationship",
      "has-a relationship",
      "contains another object",
      "member variable",
      "field of another class",
      "object as a member",
    ],
  },
  {
    keys: ["is a relationship", "is-a relationship", "inheritance", "extends", "implements"],
    variants: [
      "inheritance",
      "is a relationship",
      "is-a relationship",
      "extends",
      "implements",
      "subclass",
      "superclass",
      "parent class",
      "child class",
    ],
  },
  {
    keys: ["arraylist", "array list", "array"],
    variants: [
      "array",
      "arraylist",
      "array list",
      "fixed size",
      "dynamic size",
      "can grow",
      "resizable",
      "add method",
      "remove method",
      "index",
    ],
  },
  {
    keys: ["primitive", "reference", "data type"],
    variants: [
      "primitive",
      "reference type",
      "reference data type",
      "data type",
      "type and size",
      "stores value",
      "stores reference",
      "points to object",
      "actual value",
      "object reference",
    ],
  },
  {
    keys: ["variable", "data type", "container", "storage"],
    variants: [
      "variable",
      "data type",
      "named storage",
      "storage location",
      "container",
      "holds value",
      "hold value",
      "stores data",
      "type of data",
      "size of data",
    ],
  },
  {
    keys: ["method", "function", "parameter", "return"],
    variants: [
      "method",
      "function",
      "parameter",
      "argument",
      "return value",
      "return type",
      "reusable",
      "modular",
      "modularity",
    ],
  },
  {
    keys: ["reuse", "reusable", "duplication", "duplicate", "maintainability", "repeat"],
    variants: [
      "code reuse",
      "reuse code",
      "reusable",
      "avoid duplication",
      "avoid duplicating code",
      "don't repeat",
      "don't need to repeat",
      "repeated task",
      "write once",
      "maintainability",
      "easier to maintain",
      "readability",
      "modular",
      "call multiple times",
      "call it repeatedly",
    ],
  },
  {
    keys: ["pass by value", "passed by value", "copy of the variable", "original unchanged"],
    variants: [
      "pass by value",
      "passed by value",
      "passes by value",
      "primitive passed by value",
      "primitive types by value",
      "copy of variable",
      "copy of the variable",
      "copy is passed",
      "method gets a copy",
      "original remains unchanged",
      "original variable unchanged",
      "original does not change",
      "original value does not change",
      "unchanged",
      "job of a value",
    ],
  },
  {
    keys: ["recursion", "recursive", "base case", "stack overflow"],
    variants: [
      "recursion",
      "recursive",
      "calls itself",
      "calling itself",
      "method calls itself",
      "smaller problem",
      "smaller instance",
      "base case",
      "stopping condition",
      "infinite loop",
      "stack overflow",
      "stackoverflowerror",
    ],
  },
  {
    keys: ["constructor", "new object", "new instance", "object created", "instance created", "initializes"],
    variants: [
      "constructor",
      "object",
      "instance",
      "new object",
      "new instance",
      "object created",
      "instance created",
      "initializes",
      "initialize",
      "fields",
      "attributes",
    ],
  },
  {
    keys: ["override", "overriding", "polymorphism", "subclass", "superclass"],
    variants: [
      "override",
      "overriding",
      "method overriding",
      "polymorphism",
      "polymorphic",
      "subclass",
      "superclass",
      "specific implementation",
      "actual object type",
      "runtime",
    ],
  },
  {
    keys: ["loop", "for loop", "while loop", "nested loop", "iterate", "iteration"],
    variants: [
      "loop",
      "for loop",
      "while loop",
      "nested loop",
      "iterate",
      "iteration",
      "repeat",
      "condition",
      "update",
      "time complexity",
      "performance",
      "slow",
      "infinite loop",
    ],
  },
  {
    keys: ["exception", "try", "catch", "error", "throws"],
    variants: [
      "exception",
      "throws",
      "throw exception",
      "might throw",
      "caller",
      "try catch",
      "catch block",
      "handle error",
      "prevents crash",
      "runtime error",
      "control flow",
    ],
  },
];

const GENERIC_FORBIDDEN = [
  {
    id: "score_chasing",
    label: "Asks for marks instead of answering",
    penalty: 5,
    variants: [
      "give me full marks",
      "give full marks",
      "award full marks",
      "score me five",
      "score of 5",
    ],
  },
  {
    id: "no_answer",
    label: "Says the answer is not known",
    penalty: 5,
    variants: [
      "i do not know",
      "i don't know",
      "dont know",
      "no idea",
      "not sure",
      "skip",
    ],
  },
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "can",
  "class",
  "code",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "java",
  "of",
  "or",
  "should",
  "that",
  "the",
  "this",
  "to",
  "use",
  "used",
  "what",
  "when",
  "why",
  "with",
  "would",
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\bis-a\b/g, "is a")
    .replace(/\bhas-a\b/g, "has a")
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function phraseInText(phrase, normalizedText) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;

  const escaped = normalizedPhrase.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(normalizedText);
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function extractUsefulPhrases(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const phrases = [];
  const chunks = normalized
    .replace(/\b(correctly|explains?|states?|mentions?|identifies?|describes?|connects?|uses?|shows?)\b/g, " ")
    .split(/\b(?:and|or|because|with|using|between|versus|vs)\b/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.split(" ").length >= 2 && chunk.split(" ").length <= 7);

  phrases.push(...chunks);

  const words = normalized
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  for (let size = 3; size >= 2; size -= 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      phrases.push(words.slice(index, index + size).join(" "));
    }
  }

  return unique(phrases).slice(0, 10);
}

function variantsFromLexicon(text) {
  const normalized = normalizeText(text);
  const variants = [];

  for (const entry of JAVA_LEXICON) {
    if (entry.keys.some((key) => phraseInText(key, normalized))) {
      variants.push(...entry.variants);
    }
  }

  return unique(variants);
}

function hasGenericCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) return true;

  return criteria.some((criterion) => {
    const point = normalizeText(criterion?.point || "");
    return (
      point.includes("main java idea asked") ||
      point.includes("shown code or situation") ||
      point.includes("java concept understanding")
    );
  });
}

function hasTranscriptWarnings(transcriptMeta) {
  const warnings = Array.isArray(transcriptMeta?.warnings)
    ? transcriptMeta.warnings
    : [];

  return (
    Boolean(transcriptMeta?.low_confidence) ||
    warnings.length > 0 ||
    ["medium", "low"].includes(String(transcriptMeta?.quality || "").toLowerCase())
  );
}

function matchesRuleConfig(rule, combinedText) {
  const match = rule?.match;
  if (!match) return false;

  const normalized = normalizeText(combinedText);
  const any = Array.isArray(match.any) ? match.any : [];
  if (any.some((phrase) => phraseInText(phrase, normalized))) return true;

  const all = Array.isArray(match.all) ? match.all : [];
  return all.length > 0 && all.every((phrase) => phraseInText(phrase, normalized));
}

function resolveExplicitRule({ qid, question, rubric }) {
  const rules = scoringRules.rules || {};
  if (rules[qid]) {
    return { ...rules[qid], source: "explicit_qid", rule_id: qid };
  }

  const combined = `${question}\n${rubric}`;
  for (const [ruleId, rule] of Object.entries(rules)) {
    if (matchesRuleConfig(rule, combined)) {
      return { ...rule, source: "explicit_match", rule_id: ruleId };
    }
  }

  return null;
}

function createDerivedRule({ qid, question, rubric, criteria, concept_tags }) {
  const parsedCriteria = Array.isArray(criteria) && criteria.length > 0
    ? criteria
    : [{ point: rubric || question || "Java concept understanding", marks: 5 }];

  const tagsVariants = Array.isArray(concept_tags)
    ? concept_tags.flatMap((tag) => variantsFromLexicon(tag))
    : [];

  const concepts = parsedCriteria.map((criterion, index) => {
    const point = String(criterion?.point || "").trim();
    const marks = Number(criterion?.marks) || Math.max(1, 5 / parsedCriteria.length);
    const pointLexiconVariants = variantsFromLexicon(point);
    const fallbackLexiconVariants = pointLexiconVariants.length > 0
      ? []
      : variantsFromLexicon(`${question}\n${rubric}`);
    const variants = unique([
      ...pointLexiconVariants,
      ...extractUsefulPhrases(point),
      ...fallbackLexiconVariants,
      ...tagsVariants,
    ]);

    return {
      id: `criterion_${index + 1}`,
      label: point || `Criterion ${index + 1}`,
      marks,
      required: true,
      variants: variants.length > 0 ? variants : extractUsefulPhrases(`${question} ${rubric}`),
    };
  });

  const maxScore = parsedCriteria.reduce(
    (sum, criterion) => sum + (Number(criterion?.marks) || 0),
    0
  ) || 5;

  return {
    intent: "derived from question-specific answer criteria",
    max_score: maxScore,
    concepts,
    forbidden: GENERIC_FORBIDDEN,
    uncertain_if: scoringRules.defaults?.uncertain_if || {
      matched_required_concepts: 1,
      answer_tokens_below: 14,
    },
    source: "derived_criteria",
    rule_id: `${qid || "derived"}:criteria`,
  };
}

function resolveRule({ qid, question, rubric, criteria, concept_tags }) {
  return (
    resolveExplicitRule({ qid, question, rubric }) ||
    createDerivedRule({ qid, question, rubric, criteria, concept_tags })
  );
}

function isLikelyTechnicalAnswer(answer, question, rubric) {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return false;

  if (JAVA_LEXICON.some((entry) => entry.variants.some((phrase) => phraseInText(phrase, normalizedAnswer)))) {
    return true;
  }

  const questionTerms = tokenize(`${question} ${rubric}`)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
  const answerTerms = new Set(tokenize(answer));
  const overlap = questionTerms.filter((term) => answerTerms.has(term));
  return overlap.length >= 2;
}

function estimateConfidence({ score, maxScore, matchedRequiredCount, requiredCount, matchedForbidden, source, likelyTechnical, genericCriteria }) {
  if (matchedForbidden.length > 0) return 0.48;
  if (genericCriteria) return 0.42;
  if (source === "derived_criteria" && score === 0 && likelyTechnical) return 0.44;
  if (source === "derived_criteria" && score >= maxScore) return 0.58;
  if (requiredCount > 0 && matchedRequiredCount === requiredCount && score >= maxScore) return 0.92;
  if (score === 0 && !likelyTechnical) return 0.86;
  if (source === "derived_criteria" && score > 0 && score < maxScore) return 0.52;
  if (score > 0 && score < maxScore) return 0.62;
  return 0.76;
}

function buildFeedback(rule, matchedConcepts, missingConcepts, matchedForbidden) {
  const matchedLabels = matchedConcepts
    .map((id) => rule.concepts.find((concept) => concept.id === id)?.label || id)
    .filter(Boolean);
  const missingLabels = missingConcepts
    .map((id) => rule.concepts.find((concept) => concept.id === id)?.label || id)
    .filter(Boolean);
  const forbiddenLabels = matchedForbidden
    .map((id) => rule.forbidden?.find((item) => item.id === id)?.label || id)
    .filter(Boolean);

  if (forbiddenLabels.length > 0) {
    return `The answer includes a misconception: ${forbiddenLabels.join(", ")}.`;
  }

  if (matchedLabels.length === 0) {
    return "No required Java concept was detected in the answer.";
  }

  if (missingLabels.length === 0) {
    return "The answer covers the required Java ideas for this question.";
  }

  return `The answer covers ${matchedLabels.join(", ")} but still needs ${missingLabels.join(", ")}.`;
}

function scoreRuleBasedAnswer({ qid, question, rubric, criteria, concept_tags, answer, transcriptMeta = {} }) {
  const normalized = normalizeText(answer);
  const tokens = tokenize(answer);
  const rule = resolveRule({ qid, question, rubric, criteria, concept_tags });
  const maxScore = Number(rule.max_score) || scoringRules.defaults?.max_score || 5;

  let score = 0;
  const matchedConcepts = [];
  const missingConcepts = [];
  const matchedForbidden = [];
  const breakdown = {};

  const concepts = Array.isArray(rule.concepts) ? rule.concepts : [];
  const requiredConcepts = concepts.filter((concept) => concept.required);

  for (const concept of concepts) {
    const variants = Array.isArray(concept.variants) ? concept.variants : [];
    const found = variants.some((phrase) => phraseInText(phrase, normalized));
    const conceptMarks = Number(concept.marks) || 0;

    if (found) {
      matchedConcepts.push(concept.id);
      score += conceptMarks;
    } else if (concept.required) {
      missingConcepts.push(concept.id);
    }

    breakdown[concept.id] = {
      label: concept.label || concept.id,
      score: found ? conceptMarks : 0,
      max: conceptMarks,
      reason: found
        ? "Matched accepted wording in the answer."
        : "This concept was not detected in the answer.",
      expected: variants.slice(0, 4).join("; "),
    };
  }

  for (const item of Array.isArray(rule.forbidden) ? rule.forbidden : []) {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    if (variants.some((phrase) => phraseInText(phrase, normalized))) {
      matchedForbidden.push(item.id);
      score -= Number(item.penalty) || 0;
    }
  }

  score = Math.max(0, Math.min(maxScore, Math.round(score * 2) / 2));

  const matchedRequiredCount = requiredConcepts.filter((concept) =>
    matchedConcepts.includes(concept.id)
  ).length;
  const likelyTechnical = isLikelyTechnicalAnswer(answer, question, rubric);
  const genericCriteria = hasGenericCriteria(criteria);
  const transcriptHasWarnings = hasTranscriptWarnings(transcriptMeta);
  const uncertaintyConfig = rule.uncertain_if || scoringRules.defaults?.uncertain_if || {};
  const tokenLimit = Number(uncertaintyConfig.answer_tokens_below) || 14;
  const requiredLimit = Number(uncertaintyConfig.matched_required_concepts) || 1;
  const hasOnlySoftMatch = matchedConcepts.length > 0 &&
    matchedConcepts.every((id) => concepts.find((concept) => concept.id === id)?.soft);

  const flags = [];
  if (transcriptMeta?.low_confidence || transcriptMeta?.warnings?.includes?.("low_confidence")) {
    flags.push("low_confidence_transcript");
  }
  if (transcriptHasWarnings && !flags.includes("low_confidence_transcript")) {
    flags.push("transcript_warning");
  }
  if (score === 0 && tokens.length > 0 && matchedRequiredCount === 0 && !likelyTechnical) {
    flags.push("possible_bad_transcript");
  }

  const uncertain =
    (matchedRequiredCount <= requiredLimit && tokens.length <= tokenLimit && score > 0) ||
    hasOnlySoftMatch ||
    genericCriteria ||
    (rule.source === "derived_criteria" && score > 0 && score < maxScore) ||
    (rule.source === "derived_criteria" && score >= maxScore) ||
    (score === 0 && likelyTechnical) ||
    (matchedForbidden.length > 0 && matchedRequiredCount > 0) ||
    flags.includes("low_confidence_transcript") ||
    flags.includes("transcript_warning");

  const confidence = estimateConfidence({
    score,
    maxScore,
    matchedRequiredCount,
    requiredCount: requiredConcepts.length,
    matchedForbidden,
    source: rule.source,
    likelyTechnical,
    genericCriteria,
  });

  const fallbackRecommended =
    uncertain ||
    rule.source === "derived_criteria" ||
    genericCriteria ||
    (score === 0 && likelyTechnical) ||
    (score > 0 && score < maxScore && matchedRequiredCount > 0) ||
    (score >= maxScore && (rule.source !== "explicit_qid" || transcriptHasWarnings)) ||
    (score >= 2 && score <= 3) ||
    (matchedForbidden.length > 0 && matchedRequiredCount > 0);

  return {
    qid,
    rule_id: rule.rule_id,
    source: rule.source,
    intent: rule.intent,
    score,
    max_score: maxScore,
    confidence,
    uncertain,
    fallback_recommended: fallbackRecommended,
    matched: matchedConcepts,
    missing: missingConcepts,
    forbidden: matchedForbidden,
    flags,
    feedback: buildFeedback(rule, matchedConcepts, missingConcepts, matchedForbidden),
    breakdown,
  };
}

module.exports = {
  normalizeText,
  phraseInText,
  scoreRuleBasedAnswer,
};
