"use strict";

/**
 * Candidate Profile Service
 * ---------------------------------------------
 * Maintains the candidate's interview profile during
 * the entire interview.
 *
 * This service is intentionally:
 * - Stateless
 * - Database independent
 * - LLM independent
 * - Express independent
 *
 * The profile object is stored inside:
 *
 * InterviewSession.interviewState.candidateProfile
 *
 * Every exported function mutates only the supplied
 * profile object and returns it.
 */

/**
 * Default numeric values
 */
const DEFAULTS = Object.freeze({
    MAX_SCORE: 100,
    MIN_SCORE: 0,

    WARNING_PENALTY: 5,
    ABUSE_PENALTY: 15,
    PROMPT_INJECTION_PENALTY: 20,

    MASTERY_THRESHOLD: 80,
    MIN_ATTEMPTS_FOR_MASTERY: 2,

    EMA_ALPHA: 0.30,

    COMPETENCY_CONFIDENCE_INCREMENT: 8,

    HISTORY_LIMIT: 25
});

/**
 * Supported warning types
 */
const WARNING_TYPES = Object.freeze({
    ABUSE: "abuse",
    PROMPT_INJECTION: "prompt_injection",
    IRRELEVANT: "irrelevant",
    SKIP: "skip",
});

function createCompetency(initialScore = 0) {

    return {

        score: initialScore,

        confidence: 0,

        trend: "stable",

        history: [],

        evidenceIds: [],

        lastUpdated: null

    };

}

function updateTrend(history = []) {

    if (history.length < 3) {

        return "stable";

    }

    const recent = history.slice(-3);

    if (
        recent[2].score >
        recent[1].score &&
        recent[1].score >
        recent[0].score
    ) {

        return "improving";

    }

    if (
        recent[2].score <
        recent[1].score &&
        recent[1].score <
        recent[0].score
    ) {

        return "declining";

    }

    return "stable";

}

function ema(previous, incoming) {

    return Math.round(

        previous * (1 - DEFAULTS.EMA_ALPHA) +

        incoming * DEFAULTS.EMA_ALPHA

    );

}

/**
 * Creates a completely new candidate profile.
 *
 * @returns {Object}
 */
function createProfile() {
    return {

        /**
         * Concept statistics
         *
         * Example:
         *
         * concepts = {
         *      Inheritance:{
         *          attempts:2,
         *          totalScore:150,
         *          averageScore:75,
         *          mastered:false
         *      }
         * }
         */
        concepts: {},
        competencies: {

            technicalKnowledge:

                createCompetency(),

            reasoning:

                createCompetency(),

            communication:

                createCompetency(),

            debugging:

                createCompetency(),

            decisionMaking:

                createCompetency(),

            learningAbility:

                createCompetency(),

            professionalism:

                createCompetency(100),

            integrity:

                createCompetency(100)

        },

        timeline: [],

        evidenceIds: [],

        /**
         * High level summaries
         */
        strengths: [],
        weaknesses: [],

        /**
         * Map<Concept, Array<Misconception>>
         */
        misconceptions: {},

        /**
         * Stores contradiction history
         */
        contradictions: [],

        /**
         * Every evaluated answer
         */
        answerHistory: [],

        /**
         * Overall interview confidence
         */
        confidence: 50,

        /**
         * Professional behaviour score
         */
        professionalism: 100,

        /**
         * Interview integrity score
         */
        interviewIntegrity: 100,

        /**
         * Behaviour warnings
         */
        warnings: [],

        /**
         * Behaviour counters
         */
        skippedQuestions: 0,
        irrelevantAnswers: 0,
        abusiveResponses: 0,
        promptInjectionAttempts: 0,

        /**
         * Interview progress
         */
        totalQuestions: 0,
        answeredQuestions: 0,

        /**
         * Metadata
         */
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

/**
 * Returns true when value is a non-empty string.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isValidString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    );
}

/**
 * Returns score inside range 0-100.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeScore(value) {

    let score = Number(value);

    if (!Number.isFinite(score)) {
        score = 0;
    }

    if (score < DEFAULTS.MIN_SCORE) {
        score = DEFAULTS.MIN_SCORE;
    }

    if (score > DEFAULTS.MAX_SCORE) {
        score = DEFAULTS.MAX_SCORE;
    }

    return Math.round(score);
}

/**
 * Updates profile timestamp.
 *
 * @param {Object} profile
 */
function touch(profile) {
    if (!profile) return;
    profile.updatedAt = new Date();
}

function recordTimeline(profile, event) {

    if (!profile) {

        return;

    }

    profile.timeline.push({

        timestamp: new Date(),

        ...event

    });

    if (

        profile.timeline.length >

        DEFAULTS.HISTORY_LIMIT

    ) {

        profile.timeline.shift();

    }

    touch(profile);

}

function recordEvidenceReference(

    profile,

    evidenceId

) {

    if (

        !profile ||

        !isValidString(evidenceId)

    ) {

        return;

    }

    addUnique(

        profile.evidenceIds,

        evidenceId

    );

    touch(profile);

}

/**
 * Ensures a concept exists.
 *
 * @param {Object} profile
 * @param {string} concept
 *
 * @returns {Object|null}
 */
function ensureConcept(profile, concept) {

    if (!profile || !isValidString(concept)) {
        return null;
    }

    if (!profile.concepts) {
        profile.concepts = {};
    }

    if (!profile.strengths) {
        profile.strengths = [];
    }

    if (!profile.weaknesses) {
        profile.weaknesses = [];
    }

    if (!profile.misconceptions) {
        profile.misconceptions = {};
    }

    const name = concept.trim();

    if (!profile.concepts[name]) {

        profile.concepts[name] = {

            attempts: 0,

            totalScore: 0,

            averageScore: 0,

            mastered: false,

            lastUpdated: null

        };

    }

    return profile.concepts[name];

}
/**
 * Adds value only once.
 *
 * @param {Array} array
 * @param {*} value
 */
function addUnique(array, value) {

    if (!Array.isArray(array)) {
        return;
    }

    if (!array.includes(value)) {
        array.push(value);
    }

}

/**
 * Removes value if present.
 *
 * @param {Array} array
 * @param {*} value
 */
function removeValue(array, value) {

    if (!Array.isArray(array)) {
        return;
    }

    const index = array.indexOf(value);

    if (index !== -1) {
        array.splice(index, 1);
    }

}

/**
 * Ensures misconception bucket exists.
 *
 * @param {Object} profile
 * @param {string} concept
 */
function ensureMisconceptionBucket(profile, concept) {

    if (!profile || !isValidString(concept)) {
        return;
    }

    if (!Array.isArray(profile.misconceptions[concept])) {

        profile.misconceptions[concept] = [];

    }

}

/**
 * Records the score for a concept.
 *
 * @param {Object} profile
 * @param {string} concept
 * @param {number} score
 * @returns {Object}
 */
function recordConcept(profile, concept, score) {

    if (!profile || !isValidString(concept)) {

        return profile;

    }

    const node = ensureConcept(profile, concept);

    const normalizedScore = normalizeScore(score);

    node.attempts++;

    node.totalScore += normalizedScore;

    node.averageScore = Math.round(

        node.totalScore /

        node.attempts

    );

    node.mastered =

        node.averageScore >= DEFAULTS.MASTERY_THRESHOLD &&

        node.attempts >= DEFAULTS.MIN_ATTEMPTS_FOR_MASTERY;

    node.lastUpdated = new Date();

    if (node.mastered) {

        recordStrongConcept(

            profile,

            concept

        );

    }

    else if (

        node.averageScore < 60

    ) {

        recordWeakConcept(

            profile,

            concept

        );

    }

    recordTimeline(profile, {

        type: "concept",

        concept,

        score: node.averageScore,

        mastered: node.mastered

    });

    touch(profile);

    return profile;

}

function updateCompetency(

    profile,

    competency,

    {

        score = 0,

        confidence = 0,

        evidenceId = null

    } = {}

) {

    if (

        !profile ||

        !profile.competencies ||

        !profile.competencies[competency]

    ) {

        return profile;

    }

    const node =

        profile.competencies[competency];

    const normalizedScore =

        normalizeScore(score);

    node.score = ema(

        node.score,

        normalizedScore

    );

    node.confidence = Math.min(

        100,

        node.confidence +

        DEFAULTS.COMPETENCY_CONFIDENCE_INCREMENT

    );

    if (evidenceId) {

        addUnique(

            node.evidenceIds,

            evidenceId

        );

        recordEvidenceReference(

            profile,

            evidenceId

        );

    }

    node.history.push({

        score: node.score,

        timestamp: new Date()

    });

    if (

        node.history.length >

        DEFAULTS.HISTORY_LIMIT

    ) {

        node.history.shift();

    }

    node.trend =

        updateTrend(node.history);

    node.lastUpdated =

        new Date();

    touch(profile);

    return profile;

}

/**
 * Records an evaluated answer.
 *
 * Expected input:
 *
 * {
 *      questionId,
 *      classification,
 *      score,
 *      concepts,
 *      relevanceScore,
 *      timestamp
 * }
 *
 * @param {Object} profile
 * @param {Object} data
 *
 * @returns {Object}
 */
function recordAnswer(profile, data = {}) {

    if (!profile) {
        return profile;
    }

    const answer = {

        questionId: data.questionId || null,

        classification: data.classification || "Unknown",

        score: normalizeScore(data.score),

        concepts: Array.isArray(data.concepts)
            ? [...new Set(data.concepts)]
            : [],

        relevanceScore: normalizeScore(
            data.relevanceScore ?? 100
        ),

        timestamp: data.timestamp
            ? new Date(data.timestamp)
            : new Date()

    };

    profile.answerHistory.push(answer);

    profile.totalQuestions++;

    if (answer.classification !== "Skip") {

        profile.answeredQuestions++;

    }

    recordTimeline(profile, {

        type: "answer",

        questionId: answer.questionId,

        classification: answer.classification,

        score: answer.score

    });

    for (const concept of answer.concepts) {

        recordConcept(

            profile,

            concept,

            answer.score

        );

    }

    updateCompetency(

        profile,

        "technicalKnowledge",

        {

            score: answer.score

        }

    );

    touch(profile);

    return profile;

}

/**
 * Marks a concept as weak.
 *
 * @param {Object} profile
 * @param {string} concept
 *
 * @returns {Object}
 */
function recordWeakConcept(profile, concept) {

    if (!profile) {

        return profile;

    }

    addUnique(

        profile.weaknesses,

        concept

    );

    removeValue(

        profile.strengths,

        concept

    );

    updateCompetency(

        profile,

        "technicalKnowledge",

        {

            score:40

        }

    );

    touch(profile);

    return profile;

}

/**
 * Marks a concept as strong.
 *
 * @param {Object} profile
 * @param {string} concept
 *
 * @returns {Object}
 */
function recordStrongConcept(profile, concept) {

    if (!profile) {

        return profile;

    }

    addUnique(

        profile.strengths,

        concept

    );

    removeValue(

        profile.weaknesses,

        concept

    );

    updateCompetency(

        profile,

        "technicalKnowledge",

        {

            score:95

        }

    );

    touch(profile);

    return profile;

}

/**
 * Stores a misconception.
 *
 * Example:
 *
 * Inheritance
 *      - Confused HAS-A with IS-A
 *
 * @param {Object} profile
 * @param {string} concept
 * @param {string} misconception
 *
 * @returns {Object}
 */
function recordMisconception(
    profile,
    concept,
    misconception
) {

    if (
        !profile ||
        !isValidString(concept) ||
        !isValidString(misconception)
    ) {
        return profile;
    }

    ensureMisconceptionBucket(
        profile,
        concept
    );

    addUnique(
        profile.misconceptions[concept],
        misconception.trim()
    );

    recordWeakConcept(
        profile,
        concept
    );

    touch(profile);

    return profile;

}

/**
 * Records a contradiction detected during the interview.
 *
 * Example:
 * Previous:
 *      "Inheritance is HAS-A"
 *
 * Current:
 *      "Inheritance is IS-A"
 *
 * @param {Object} profile
 * @param {Object} contradiction
 *
 * @returns {Object}
 */
function recordContradiction(profile, contradiction = {}) {

    if (!profile) {
        return profile;
    }

    profile.contradictions.push({
        concept: contradiction.concept || "Unknown",
        previous: contradiction.previous || "",
        current: contradiction.current || "",
        questionId: contradiction.questionId || null,
        timestamp: new Date()
    });

    profile.confidence = Math.max(
        0,
        profile.confidence - 5
    );

    updateCompetency(

    profile,

    "reasoning",

    {

        score:30

    }

);

    recordTimeline(profile,{

        type:"contradiction",

        concept:contradiction.concept,

        questionId:contradiction.questionId

    });

    touch(profile);

    return profile;
}

/**
 * Records interview behaviour warnings.
 *
 * Supported:
 * abuse
 * prompt_injection
 * irrelevant
 * skip
 *
 * @param {Object} profile
 * @param {string} type
 *
 * @returns {Object}
 */
function recordWarning(profile, type) {

    if (!profile || !isValidString(type)) {
        return profile;
    }

    const warning = type.trim().toLowerCase();

    switch (warning) {

        case WARNING_TYPES.ABUSE:

            profile.professionalism = Math.max(
                0,
                profile.professionalism - DEFAULTS.ABUSE_PENALTY
            );

            profile.abusiveResponses++;

            break;

        case WARNING_TYPES.PROMPT_INJECTION:

            profile.interviewIntegrity = Math.max(
                0,
                profile.interviewIntegrity -
                    DEFAULTS.PROMPT_INJECTION_PENALTY
            );

            profile.promptInjectionAttempts++;

            break;

        case WARNING_TYPES.IRRELEVANT:

            profile.interviewIntegrity = Math.max(
                0,
                profile.interviewIntegrity -
                    DEFAULTS.WARNING_PENALTY
            );

            profile.irrelevantAnswers++;

            break;

        case WARNING_TYPES.SKIP:

            profile.skippedQuestions++;

            break;
        
        case WARNING_TYPES.ABUSE:


            updateCompetency(

                profile,

                "professionalism",

                {

                    score:

                    profile.professionalism

                }

            );

            break;

        default:

            break;
    }

    profile.warnings.push({
        type: warning,
        timestamp: new Date()
    });

    touch(profile);

    return profile;
}

/**
 * Calculates interview confidence.
 *
 * Confidence is based on:
 *
 * - Questions answered
 * - Concept coverage
 * - Warnings
 * - Contradictions
 *
 * Returns:
 * 0-100
 *
 * @param {Object} profile
 *
 * @returns {number}
 */
function calculateConfidence(profile) {

    if (!profile) {
        return 0;
    }

    const competencyScores = Object.values(
        profile.competencies || {}
    ).map(c => c.score || 0);

    const competencyConfidence = Object.values(
        profile.competencies || {}
    ).map(c => c.confidence || 0);

    const competencyAverage =
        competencyScores.length
            ? competencyScores.reduce((a, b) => a + b, 0) /
              competencyScores.length
            : 0;

    const confidenceAverage =
        competencyConfidence.length
            ? competencyConfidence.reduce((a, b) => a + b, 0) /
              competencyConfidence.length
            : 0;

    const answeredRatio =
        profile.totalQuestions === 0
            ? 0
            : profile.answeredQuestions /
              profile.totalQuestions;

    const masteredConcepts =
        Object.values(profile.concepts || {})
            .filter(c => c.mastered)
            .length;

    const conceptCoverage =
        Object.keys(profile.concepts || {}).length;

    const contradictionPenalty =
        profile.contradictions.length * 4;

    const warningPenalty =
        profile.warnings.length * 2;

    let confidence =

        competencyAverage * 0.35 +

        confidenceAverage * 0.25 +

        answeredRatio * 100 * 0.20 +

        Math.min(masteredConcepts * 5, 15) +

        Math.min(conceptCoverage * 2, 10) -

        contradictionPenalty -

        warningPenalty;

    confidence = normalizeScore(confidence);

    profile.confidence = confidence;

    touch(profile);

    return confidence;

}

function updateLearningAbility(profile) {

    if (!profile) {
        return profile;
    }

    const history = profile.answerHistory;

    if (history.length < 2) {
        return profile;
    }

    const grouped = {};

    for (const answer of history) {

        for (const concept of answer.concepts) {

            grouped[concept] ??= [];

            grouped[concept].push(answer.score);

        }

    }

    let improvements = 0;

    let regressions = 0;

    Object.values(grouped).forEach(scores => {

        if (scores.length < 2) {

            return;

        }

        if (

            scores[scores.length - 1] >

            scores[0]

        ) {

            improvements++;

        }

        else if (

            scores[scores.length - 1] <

            scores[0]

        ) {

            regressions++;

        }

    });

    const score =

        50 +

        improvements * 15 -

        regressions * 10;

    updateCompetency(

        profile,

        "learningAbility",

        {

            score

        }

    );

    return profile;

}

function getCompetencySummary(profile) {

    if (!profile) {

        return {};

    }

    const result = {};

    Object.entries(profile.competencies)

        .forEach(([name, value]) => {

            result[name] = {

                score: value.score,

                confidence: value.confidence,

                trend: value.trend

            };

        });

    return result;

}

/**
 * Returns weak concepts sorted by average score.
 *
 * @param {Object} profile
 *
 * @returns {Array}
 */
function getWeakConcepts(profile) {

    if (!profile) {
        return [];
    }

    return Object.entries(profile.concepts)

        .filter(([, value]) => value.averageScore < 60)

        .sort(
            (a, b) =>
                a[1].averageScore -
                b[1].averageScore
        )

        .map(([concept]) => concept);

}

/**
 * Returns strong concepts sorted by score.
 *
 * @param {Object} profile
 *
 * @returns {Array}
 */
function getStrongConcepts(profile) {

    if (!profile) {
        return [];
    }

    return Object.entries(profile.concepts)

        .filter(([, value]) => value.mastered)

        .sort(
            (a, b) =>
                b[1].averageScore -
                a[1].averageScore
        )

        .map(([concept]) => concept);

}

/**
 * Returns interview profile summary.
 *
 * Used by:
 * - Final Report
 * - Recruiter Dashboard
 * - Interview Planner
 *
 * @param {Object} profile
 * @returns {Object}
 */
function summary(profile) {

    if (!profile) {

        return createProfile();

    }

    calculateConfidence(profile);

    updateLearningAbility(profile);

    return {

        confidence: profile.confidence,

        professionalism: profile.professionalism,

        interviewIntegrity: profile.interviewIntegrity,

        competencySummary:

            getCompetencySummary(profile),

        strongConcepts:

            getStrongConcepts(profile),

        weakConcepts:

            getWeakConcepts(profile),

        concepts:

            profile.concepts,

        misconceptions:

            profile.misconceptions,

        contradictionCount:

            profile.contradictions.length,

        warnings:

            profile.warnings,

        timeline:

            profile.timeline,

        evidenceIds:

            profile.evidenceIds,

        statistics: {

            totalQuestions:

                profile.totalQuestions,

            answeredQuestions:

                profile.answeredQuestions,

            skippedQuestions:

                profile.skippedQuestions,

            abusiveResponses:

                profile.abusiveResponses,

            irrelevantAnswers:

                profile.irrelevantAnswers,

            promptInjectionAttempts:

                profile.promptInjectionAttempts

        },

        generatedAt:

            new Date()

    };

}

/**
 * Clears interview statistics.
 *
 * Mainly useful for:
 * - Testing
 * - Restart interview
 *
 * @returns {Object}
 */
function resetProfile() {
    return createProfile();
}

/**
 * Merge two candidate profiles.
 *
 * Useful for:
 * - Resume interview
 * - Multi-round interviews
 *
 * NOTE:
 * Current implementation is intentionally conservative.
 * Can be expanded later.
 *
 * @param {Object} profileA
 * @param {Object} profileB
 *
 * @returns {Object}
 */
function mergeProfiles(profileA, profileB) {

    if (!profileA) return profileB;

    if (!profileB) return profileA;

    const merged = createProfile();

    merged.answerHistory = [
        ...(profileA.answerHistory || []),
        ...(profileB.answerHistory || [])
    ];

    merged.warnings = [
        ...(profileA.warnings || []),
        ...(profileB.warnings || [])
    ];

    merged.contradictions = [
        ...(profileA.contradictions || []),
        ...(profileB.contradictions || [])
    ];

    merged.concepts = {
        ...(profileA.concepts || {}),
        ...(profileB.concepts || {})
    };

    merged.timeline = [

    ...(profileA.timeline || []),

    ...(profileB.timeline || [])

];

merged.evidenceIds = [

    ...new Set([

        ...(profileA.evidenceIds || []),

        ...(profileB.evidenceIds || [])

    ])

];

merged.competencies =

JSON.parse(

JSON.stringify(

profileA.competencies

)

);

Object.entries(

profileB.competencies || {}

).forEach(([key, value]) => {

    if (!merged.competencies[key]) {

        merged.competencies[key] = value;

        return;

    }

    merged.competencies[key].score = Math.round(

        (

            merged.competencies[key].score +

            value.score

        ) / 2

    );

    merged.competencies[key].confidence = Math.round(

        (

            merged.competencies[key].confidence +

            value.confidence

        ) / 2

    );

});

    merged.strengths = [
        ...new Set([
            ...(profileA.strengths || []),
            ...(profileB.strengths || [])
        ])
    ];

    merged.weaknesses = [
        ...new Set([
            ...(profileA.weaknesses || []),
            ...(profileB.weaknesses || [])
        ])
    ];

    merged.misconceptions = {
        ...(profileA.misconceptions || {}),
        ...(profileB.misconceptions || {})
    };

    merged.totalQuestions =
        (profileA.totalQuestions || 0) +
        (profileB.totalQuestions || 0);

    merged.answeredQuestions =
        (profileA.answeredQuestions || 0) +
        (profileB.answeredQuestions || 0);

    merged.skippedQuestions =
        (profileA.skippedQuestions || 0) +
        (profileB.skippedQuestions || 0);

    merged.abusiveResponses =
        (profileA.abusiveResponses || 0) +
        (profileB.abusiveResponses || 0);

    merged.irrelevantAnswers =
        (profileA.irrelevantAnswers || 0) +
        (profileB.irrelevantAnswers || 0);

    merged.promptInjectionAttempts =
        (profileA.promptInjectionAttempts || 0) +
        (profileB.promptInjectionAttempts || 0);

    merged.professionalism = Math.min(
        profileA.professionalism ?? 100,
        profileB.professionalism ?? 100
    );

    merged.interviewIntegrity = Math.min(
        profileA.interviewIntegrity ?? 100,
        profileB.interviewIntegrity ?? 100
    );

    calculateConfidence(merged);

    return merged;

}

/**
 * Returns one competency.
 */
function getCompetency(profile, competency) {

    if (
        !profile ||
        !profile.competencies ||
        !profile.competencies[competency]
    ) {
        return null;
    }

    return profile.competencies[competency];

}

/**
 * Returns all competencies.
 */
function getCompetencies(profile) {

    if (!profile) {
        return {};
    }

    return profile.competencies;

}

/**
 * Returns current interview statistics.
 */
function getStatistics(profile) {

    if (!profile) {
        return {};
    }

    return {

        totalQuestions:
            profile.totalQuestions,

        answeredQuestions:
            profile.answeredQuestions,

        skippedQuestions:
            profile.skippedQuestions,

        abusiveResponses:
            profile.abusiveResponses,

        irrelevantAnswers:
            profile.irrelevantAnswers,

        promptInjectionAttempts:
            profile.promptInjectionAttempts,

        contradictionCount:
            profile.contradictions.length

    };

}

/**
 * Returns interview timeline.
 */
function getTimeline(profile) {

    return profile?.timeline || [];

}

/**
 * Returns concept mastery.
 */
function getConceptSummary(profile) {

    if (!profile) {

        return [];

    }

    return Object.entries(profile.concepts)

        .map(([concept, value]) => ({

            concept,

            attempts: value.attempts,

            averageScore:

                value.averageScore,

            mastered:

                value.mastered,

            lastUpdated:

                value.lastUpdated

        }))

        .sort(

            (a, b) =>

                b.averageScore -

                a.averageScore

        );

}

/**
 * Returns interview readiness.
 */
function isRecommendationReady(profile) {

    if (!profile) {

        return false;

    }

    return (

        profile.answeredQuestions >= 8 &&

        profile.confidence >= 70

    );

}

module.exports = Object.freeze({

    createProfile,

    resetProfile,

    mergeProfiles,

    recordAnswer,

    recordConcept,

    recordWeakConcept,

    recordStrongConcept,

    recordMisconception,

    recordContradiction,

    recordWarning,

    updateCompetency,

    calculateConfidence,

    updateLearningAbility,

    recordTimeline,

    recordEvidenceReference,

    getCompetency,

    getCompetencies,

    getConceptSummary,

    getWeakConcepts,

    getStrongConcepts,

    getStatistics,

    getTimeline,

    getCompetencySummary,

    isRecommendationReady,

    summary

});