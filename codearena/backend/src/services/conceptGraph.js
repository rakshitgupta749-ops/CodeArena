"use strict";

/**
 * ------------------------------------------------------------
 * Concept Graph Service
 * ------------------------------------------------------------
 *
 * Maintains the candidate's conceptual understanding graph.
 *
 * Unlike CandidateProfile, this service models relationships
 * between concepts.
 *
 * Example:
 *
 * Java
 *   └── OOP
 *        ├── Inheritance
 *        │      ├── IS-A
 *        │      ├── HAS-A
 *        │      └── Composition
 *        │
 *        ├── Encapsulation
 *        ├── Abstraction
 *        └── Polymorphism
 *
 * Every node stores:
 *
 * - confidence
 * - attempts
 * - correctness
 * - misconceptions
 * - evidence
 * - mastery
 *
 * Pure JavaScript.
 * Serializable.
 * No database.
 * No LLM.
 */

/**
 * Configuration
 */
const DEFAULTS = Object.freeze({

    DEFAULT_CONFIDENCE: 50,

    MASTERY_SCORE: 80,

    MIN_ATTEMPTS: 2

});

/**
 * Creates an empty graph.
 *
 * @returns {Object}
 */
function createGraph() {

    return {

        nodes: {},

        roots: [],

        createdAt: new Date(),

        updatedAt: new Date()

    };

}

/**
 * Updates graph timestamp.
 *
 * @param {Object} graph
 */
function touch(graph) {

    if (!graph) return;

    graph.updatedAt = new Date();

}

/**
 * Returns true if string.
 *
 * @param {*} value
 *
 * @returns {boolean}
 */
function isValidString(value) {

    return (

        typeof value === "string" &&

        value.trim().length > 0

    );

}

/**
 * Normalizes score.
 *
 * @param {*} value
 *
 * @returns {number}
 */
function normalizeScore(value) {

    let score = Number(value);

    if (!Number.isFinite(score)) {

        score = 0;

    }

    if (score < 0) score = 0;

    if (score > 100) score = 100;

    return Math.round(score);

}

/**
 * Creates a graph node.
 *
 * @param {string} name
 * @param {string|null} parent
 *
 * @returns {Object}
 */
function createNode(name, parent = null) {

    return {

        name,

        parent,

        children: [],

        confidence: DEFAULTS.DEFAULT_CONFIDENCE,

        attempts: 0,

        correct: 0,

        incorrect: 0,

        mastered: false,

        misconceptions: [],

        evidence: [],

        lastSeen: null

    };

}

/**
 * Adds a concept.
 *
 * @param {Object} graph
 * @param {string} name
 * @param {string|null} parent
 *
 * @returns {Object}
 */
function addConcept(graph, name, parent = null) {

    if (!graph || !isValidString(name)) {

        return graph;

    }

    if (!graph.nodes) {
        graph.nodes = {};
    }

    if (!graph.roots) {
        graph.roots = [];
    }

    const concept = name.trim();

    if (!graph.nodes[concept]) {

        graph.nodes[concept] = createNode(

            concept,

            parent

        );

    }

    if (parent && isValidString(parent)) {

        const parentName = parent.trim();

        if (!graph.nodes[parentName]) {

            graph.nodes[parentName] = createNode(parentName);

        }

        graph.nodes[concept].parent = parentName;

        if (

            !graph.nodes[parentName]

                .children

                .includes(concept)

        ) {

            graph.nodes[parentName]

                .children

                .push(concept);

        }

    } else {

        if (!graph.roots.includes(concept)) {

            graph.roots.push(concept);

        }

    }

    touch(graph);

    return graph;

}

/**
 * Returns node.
 *
 * @param {Object} graph
 * @param {string} concept
 *
 * @returns {Object|null}
 */
function getNode(graph, concept) {

    if (

        !graph ||

        !isValidString(concept)

    ) {

        return null;

    }

    return graph.nodes[concept] || null;

}

/**
 * Records an interview attempt for a concept.
 *
 * Example:
 *
 * recordAttempt(graph, "Inheritance", {
 *     score: 85,
 *     correct: true,
 *     evidence: {
 *         questionId: "Q4",
 *         answer: "Inheritance represents an IS-A relationship."
 *     },
 *     misconception: null
 * });
 *
 * @param {Object} graph
 * @param {string} concept
 * @param {Object} attempt
 *
 * @returns {Object}
 */
function recordAttempt(graph, concept, attempt = {}) {

    if (!graph || !isValidString(concept)) {
        return graph;
    }

    addConcept(graph, concept);

    const node = graph.nodes[concept];

    const score = normalizeScore(
        attempt.score ?? 0
    );

    node.attempts++;

    if (attempt.correct) {
        node.correct++;
    } else {
        node.incorrect++;
    }

    /*
     * Confidence is an exponential moving average.
     * This prevents one bad answer from destroying
     * previous confidence.
     */

    node.confidence = Math.round(

        (node.confidence * 0.7) +

        (score * 0.3)

    );

    node.mastered =

        node.confidence >= DEFAULTS.MASTERY_SCORE &&

        node.attempts >= DEFAULTS.MIN_ATTEMPTS;

    node.lastSeen = new Date();

    if (attempt.evidence) {

        recordEvidence(

            graph,

            concept,

            attempt.evidence

        );

    }

    if (attempt.misconception) {

        recordMisconception(

            graph,

            concept,

            attempt.misconception

        );

    }

    touch(graph);

    return graph;

}

/**
 * Stores evidence supporting confidence.
 *
 * Example:
 *
 * {
 *    questionId:"Q4",
 *    score:90,
 *    answer:"..."
 * }
 *
 * @param {Object} graph
 * @param {string} concept
 * @param {Object} evidence
 */
function recordEvidence(graph, concept, evidence) {

    if (

        !graph ||

        !isValidString(concept) ||

        !evidence

    ) {

        return;

    }

    addConcept(graph, concept);

    const node = graph.nodes[concept];

    const entry = {

        questionId:

            evidence.questionId || null,

        score:

            normalizeScore(

                evidence.score ?? node.confidence

            ),

        answer:

            evidence.answer || "",

        timestamp:

            evidence.timestamp

                ? new Date(evidence.timestamp)

                : new Date()

    };

    /*
     * Avoid duplicate evidence for same question.
     */

    const exists = node.evidence.some(

        e => e.questionId === entry.questionId

    );

    if (!exists) {

        node.evidence.push(entry);

    }

}

/**
 * Records misconception.
 *
 * @param {Object} graph
 * @param {string} concept
 * @param {string} misconception
 */
function recordMisconception(

    graph,

    concept,

    misconception

) {

    if (

        !graph ||

        !isValidString(concept) ||

        !isValidString(misconception)

    ) {

        return;

    }

    addConcept(graph, concept);

    const node = graph.nodes[concept];

    if (

        !node.misconceptions.includes(

            misconception

        )

    ) {

        node.misconceptions.push(

            misconception

        );

    }

}

/**
 * Marks concept mastered.
 *
 * @param {Object} graph
 * @param {string} concept
 */
function markMastered(graph, concept) {

    const node = getNode(graph, concept);

    if (!node) {

        return;

    }

    node.mastered = true;

    node.confidence = Math.max(

        node.confidence,

        DEFAULTS.MASTERY_SCORE

    );

    touch(graph);

}

/**
 * Returns mastery status.
 *
 * @param {Object} graph
 * @param {string} concept
 *
 * @returns {boolean}
 */
function isMastered(graph, concept) {

    const node = getNode(graph, concept);

    if (!node) {

        return false;

    }

    return node.mastered;

}

/**
 * Returns parent concept.
 *
 * @param {Object} graph
 * @param {string} concept
 * @returns {string|null}
 */
function getParent(graph, concept) {

    const node = getNode(graph, concept);

    if (!node) {
        return null;
    }

    return node.parent;

}

/**
 * Returns direct children.
 *
 * @param {Object} graph
 * @param {string} concept
 * @returns {Array<string>}
 */
function getChildren(graph, concept) {

    const node = getNode(graph, concept);

    if (!node) {
        return [];
    }

    return [...node.children];

}

/**
 * Returns prerequisite chain.
 *
 * Example:
 *
 * Composition
 *      ↓
 * HAS-A
 *      ↓
 * Inheritance
 *
 * @param {Object} graph
 * @param {string} concept
 * @returns {Array<string>}
 */
function getPrerequisites(graph, concept) {

    const chain = [];

    let current = getNode(graph, concept);

    while (current && current.parent) {

        chain.unshift(current.parent);

        current = getNode(graph, current.parent);

    }

    return chain;

}

/**
 * Returns weak concepts sorted by confidence.
 *
 * @param {Object} graph
 * @returns {Array<Object>}
 */
function getWeakConcepts(graph) {

    if (!graph) {
        return [];
    }

    return Object.values(graph.nodes)

        .filter(node => !node.mastered)

        .sort((a, b) => {

            if (a.confidence !== b.confidence) {
                return a.confidence - b.confidence;
            }

            return b.attempts - a.attempts;

        });

}

/**
 * Returns mastered concepts sorted by confidence.
 *
 * @param {Object} graph
 * @returns {Array<Object>}
 */
function getStrongConcepts(graph) {

    if (!graph) {
        return [];
    }

    return Object.values(graph.nodes)

        .filter(node => node.mastered)

        .sort((a, b) => b.confidence - a.confidence);

}

/**
 * Returns the next concept that should be revisited.
 *
 * Priority:
 *
 * 1. Lowest confidence
 * 2. Most misconceptions
 * 3. Highest attempts
 *
 * @param {Object} graph
 * @returns {Object|null}
 */
function nextWeakConcept(graph) {

    const weak = getWeakConcepts(graph);

    if (!weak.length) {
        return null;
    }

    weak.sort((a, b) => {

        if (a.confidence !== b.confidence) {
            return a.confidence - b.confidence;
        }

        if (a.misconceptions.length !== b.misconceptions.length) {
            return b.misconceptions.length - a.misconceptions.length;
        }

        return b.attempts - a.attempts;

    });

    return weak[0];

}

/**
 * Returns interview coverage.
 *
 * @param {Object} graph
 * @returns {Object}
 */
function coverage(graph) {

    if (!graph) {

        return {

            tested: 0,

            mastered: 0,

            remaining: 0,

            coverage: 0

        };

    }

    const nodes = Object.values(graph.nodes);

    const tested = nodes.length;

    const mastered = nodes.filter(

        node => node.mastered

    ).length;

    const remaining = tested - mastered;

    const coveragePercent =

        tested === 0

            ? 0

            : Math.round(

                (mastered / tested) * 100

            );

    return {

        tested,

        mastered,

        remaining,

        coverage: coveragePercent

    };

}

/**
 * Returns graph summary.
 *
 * Used by:
 * - Interview Planner
 * - Recruiter Report
 * - Interview Engine
 *
 * @param {Object} graph
 * @returns {Object}
 */
function summary(graph) {

    if (!graph) {
        return {
            coverage: 0,
            tested: 0,
            mastered: 0,
            remaining: 0,
            weakConcepts: [],
            strongConcepts: [],
            averageConfidence: 0
        };
    }

    const nodes = Object.values(graph.nodes);

    const weakConcepts = getWeakConcepts(graph)
        .map(node => node.name);

    const strongConcepts = getStrongConcepts(graph)
        .map(node => node.name);

    const averageConfidence =

        nodes.length === 0

            ? 0

            : Math.round(

                nodes.reduce(
                    (sum, node) => sum + node.confidence,
                    0
                ) / nodes.length

            );

    return {

        ...coverage(graph),

        weakConcepts,

        strongConcepts,

        averageConfidence,

        totalNodes: nodes.length

    };

}

/**
 * Clears graph.
 *
 * Useful for:
 * - Unit testing
 * - Restart Interview
 */
function resetGraph() {

    return createGraph();

}

/**
 * Merge two concept graphs.
 *
 * Useful for:
 * - Resume interview
 * - Multi-round interviews
 *
 * @param {Object} graphA
 * @param {Object} graphB
 *
 * @returns {Object}
 */
function mergeGraphs(graphA, graphB) {

    if (!graphA) return graphB;

    if (!graphB) return graphA;

    const merged = createGraph();

    /*
     * Copy Graph A
     */

    for (const node of Object.values(graphA.nodes)) {

        merged.nodes[node.name] = structuredClone(node);

    }

    /*
     * Merge Graph B
     */

    for (const node of Object.values(graphB.nodes)) {

        if (!merged.nodes[node.name]) {

            merged.nodes[node.name] = structuredClone(node);

            continue;

        }

        const target = merged.nodes[node.name];

        target.attempts += node.attempts;

        target.correct += node.correct;

        target.incorrect += node.incorrect;

        target.confidence = Math.round(

            (target.confidence + node.confidence) / 2

        );

        target.mastered =
            target.mastered || node.mastered;

        target.children = [

            ...new Set([

                ...target.children,

                ...node.children

            ])

        ];

        target.misconceptions = [

            ...new Set([

                ...target.misconceptions,

                ...node.misconceptions

            ])

        ];

        target.evidence = [

            ...target.evidence,

            ...node.evidence

        ];

    }

    merged.roots = [

        ...new Set([

            ...(graphA.roots || []),

            ...(graphB.roots || [])

        ])

    ];

    touch(merged);

    return merged;

}

module.exports = Object.freeze({

    createGraph,

    addConcept,

    getNode,

    recordAttempt,

    recordEvidence,

    recordMisconception,

    markMastered,

    isMastered,

    getParent,

    getChildren,

    getPrerequisites,

    getWeakConcepts,

    getStrongConcepts,

    nextWeakConcept,

    coverage,

    summary,

    resetGraph,

    mergeGraphs

});