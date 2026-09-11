"use strict";

/**
 * Evidence Engine
 * ----------------------------------------
 * Stores evidence generated during the interview.
 *
 * Responsibilities:
 * - Record evidence
 * - Query evidence
 * - Summarize evidence
 *
 * Does NOT:
 * - Evaluate answers
 * - Update competencies
 * - Access database
 * - Call LLMs
 */

const DEFAULTS = Object.freeze({

    MAX_SCORE: 100,

    MIN_SCORE: 0

});

/**
 * Normalizes score.
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
 * Creates empty evidence store.
 */
function createStore() {

    return {

        nextId: 1,

        evidence: [],

        createdAt: new Date(),

        updatedAt: new Date()

    };

}

/**
 * Updates timestamp.
 */
function touch(store) {

    if (!store) return;

    store.updatedAt = new Date();

}

/**
 * Creates evidence id.
 */
function createEvidenceId(store) {

    const id =

        `EV-${store.nextId}`;

    store.nextId++;

    return id;

}

/**
 * Finds evidence.
 */
function find(store, id) {

    if (!store) {

        return null;

    }

    return store.evidence.find(

        item => item.id === id

    ) || null;

}

/**
 * Records evidence.
 */
function record(store, payload = {}) {

    if (!store) {

        throw new Error("Evidence store is required.");

    }

    const evidence = {

        id: createEvidenceId(store),

        questionId: payload.questionId || null,

        competency: payload.competency || "technicalKnowledge",

        concept: payload.concept || "General",

        candidateAnswer: String(
            payload.candidateAnswer || ""
        ),

        evaluatorScore: normalizeScore(
            payload.evaluatorScore
        ),

        confidence: normalizeScore(
            payload.confidence
        ),

        classification:
            payload.classification || "Unknown",

        reason: payload.reason || "",

        codeEvidence: Array.isArray(
            payload.codeEvidence
        )
            ? [...payload.codeEvidence]
            : [],

        tags: Array.isArray(payload.tags)
            ? [...new Set(payload.tags)]
            : [],

        metadata: {

            language:
                payload.language || null,

            questionType:
                payload.questionType || null

        },

        timestamp: new Date()

    };

    store.evidence.push(evidence);

    touch(store);

    return evidence.id;

}

/**
 * Returns one evidence object.
 */
function get(store, evidenceId) {

    return find(store, evidenceId);

}

/**
 * Returns all evidence.
 */
function getAll(store) {

    if (!store) {

        return [];

    }

    return [...store.evidence];

}

/**
 * Returns evidence for one question.
 */
function getByQuestion(store, questionId) {

    if (!store) {

        return [];

    }

    return store.evidence.filter(

        item => item.questionId === questionId

    );

}

/**
 * Returns evidence for one concept.
 */
function getByConcept(store, concept) {

    if (!store) {

        return [];

    }

    return store.evidence.filter(

        item =>

            item.concept === concept

    );

}

/**
 * Returns evidence for one competency.
 */
function getByCompetency(

    store,

    competency

) {

    if (!store) {

        return [];

    }

    return store.evidence.filter(

        item =>

            item.competency === competency

    );

}
/**
 * Returns average evaluator score.
 */
function getAverageScore(store) {

    if (!store || store.evidence.length === 0) {
        return 0;
    }

    const total = store.evidence.reduce(
        (sum, item) => sum + item.evaluatorScore,
        0
    );

    return Math.round(total / store.evidence.length);

}

/**
 * Groups evidence by competency.
 */
function getCompetencyBreakdown(store) {

    const breakdown = {};

    if (!store) {
        return breakdown;
    }

    for (const item of store.evidence) {

        if (!breakdown[item.competency]) {

            breakdown[item.competency] = {

                count: 0,

                averageScore: 0,

                averageConfidence: 0

            };

        }

        breakdown[item.competency].count++;

        breakdown[item.competency].averageScore +=
            item.evaluatorScore;

        breakdown[item.competency].averageConfidence +=
            item.confidence;

    }

    Object.values(breakdown).forEach(entry => {

        entry.averageScore = Math.round(
            entry.averageScore / entry.count
        );

        entry.averageConfidence = Math.round(
            entry.averageConfidence / entry.count
        );

    });

    return breakdown;

}

/**
 * Groups evidence by concept.
 */
function getConceptBreakdown(store) {

    const breakdown = {};

    if (!store) {
        return breakdown;
    }

    for (const item of store.evidence) {

        if (!breakdown[item.concept]) {

            breakdown[item.concept] = {

                count: 0,

                averageScore: 0

            };

        }

        breakdown[item.concept].count++;

        breakdown[item.concept].averageScore +=
            item.evaluatorScore;

    }

    Object.values(breakdown).forEach(entry => {

        entry.averageScore = Math.round(
            entry.averageScore / entry.count
        );

    });

    return breakdown;

}

/**
 * Returns interview evidence summary.
 */
function summary(store) {

    return {

        totalEvidence:
            store?.evidence.length || 0,

        averageScore:
            getAverageScore(store),

        competencyBreakdown:
            getCompetencyBreakdown(store),

        conceptBreakdown:
            getConceptBreakdown(store),

        generatedAt:
            new Date()

    };

}

/**
 * Clears evidence store.
 */
function clear(store) {

    if (!store) {
        return;
    }

    store.evidence = [];

    store.nextId = 1;

    touch(store);

}

/**
 * Merges two evidence stores.
 */
function mergeStores(storeA, storeB) {

    const merged = createStore();

    if (storeA) {

        merged.evidence.push(
            ...storeA.evidence
        );

    }

    if (storeB) {

        merged.evidence.push(
            ...storeB.evidence
        );

    }

    merged.nextId =
        merged.evidence.length + 1;

    touch(merged);

    return merged;

}

/**
 * Returns evidence by classification.
 */
function getByClassification(store, classification) {

    if (!store) {
        return [];
    }

    return store.evidence.filter(

        item =>

            item.classification === classification

    );

}

/**
 * Returns evidence in score range.
 */
function getByScoreRange(

    store,

    minScore = 0,

    maxScore = 100

) {

    if (!store) {

        return [];

    }

    return store.evidence.filter(

        item =>

            item.evaluatorScore >= minScore &&

            item.evaluatorScore <= maxScore

    );

}

/**
 * Returns recent evidence.
 */
function getRecentEvidence(

    store,

    limit = 10

) {

    if (!store) {

        return [];

    }

    return [...store.evidence]

        .sort(

            (a, b) =>

                b.timestamp -

                a.timestamp

        )

        .slice(0, limit);

}

/**
 * Returns evidence by tag.
 */
function getByTag(store, tag) {

    if (!store) {

        return [];

    }

    return store.evidence.filter(

        item =>

            item.tags.includes(tag)

    );

}

/**
 * Removes one evidence record.
 */
function remove(store, evidenceId) {

    if (!store) {

        return false;

    }

    const index = store.evidence.findIndex(

        item =>

            item.id === evidenceId

    );

    if (index === -1) {

        return false;

    }

    store.evidence.splice(index, 1);

    touch(store);

    return true;

}

/**
 * Export all evidence.
 */
function exportEvidence(store) {

    if (!store) {

        return [];

    }

    return JSON.parse(

        JSON.stringify(

            store.evidence

        )

    );

}

/**
 * Returns store statistics.
 */
function getStatistics(store) {

    if (!store) {

        return {};

    }

    return {

        totalEvidence:

            store.evidence.length,

        averageScore:

            getAverageScore(store),

        competencyBreakdown:

            getCompetencyBreakdown(store),

        conceptBreakdown:

            getConceptBreakdown(store),

        createdAt:

            store.createdAt,

        updatedAt:

            store.updatedAt

    };

}

module.exports = Object.freeze({

    createStore,

    record,

    get,

    getAll,

    getByQuestion,

    getByConcept,

    getByCompetency,

    getByClassification,

    getByScoreRange,

    getByTag,

    getRecentEvidence,

    remove,

    clear,

    summary,

    getStatistics,

    getAverageScore,

    getCompetencyBreakdown,

    getConceptBreakdown,

    exportEvidence,

    mergeStores

});