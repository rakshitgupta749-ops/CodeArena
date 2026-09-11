"use strict";

/**
 * Adaptive Question Selector
 * --------------------------------------------
 * This service selects the next interview question.
 *
 * It NEVER:
 * - calls an LLM
 * - evaluates answers
 * - modifies interview state
 *
 * It ONLY scores questions and returns the
 * highest priority one.
 */

const EASY = "easy";
const MEDIUM = "medium";
const HARD = "hard";

const WEIGHTS = Object.freeze({

    WEAK_CONCEPT: 40,

    STRONG_CONCEPT: -30,

    NOT_ASKED: 20,

    ALREADY_ASKED: -100,

    FOLLOW_UP: 15,

    PREREQUISITE: 25,

    DIFFICULTY_MATCH: 15,

    DIFFICULTY_MISMATCH: -10,

    MASTERED: -50

});

/**
 * Decide interview difficulty.
 */
function determineDifficulty(profile) {

    const confidence = Number(profile?.confidence ?? 50);

    if (confidence < 40) {
        return EASY;
    }

    if (confidence < 70) {
        return MEDIUM;
    }

    return HARD;

}

function alreadyAsked(state, question) {

    return state.askedQuestions?.includes(
        question.qid
    );

}

function mastered(profile, concept) {

    if (!profile) return false;

    const strengths = Array.isArray(profile.strengths)
        ? profile.strengths
        : [];

    const weaknesses = Array.isArray(profile.weaknesses)
        ? profile.weaknesses
        : [];

    // Weakness takes precedence over mastery.
    // A concept that currently needs reinforcement
    // must not be treated as mastered.
    if (weaknesses.includes(concept)) {
        return false;
    }

    return strengths.includes(concept);
}


function weak(profile, concept) {

    if (!profile) return false;

    const weaknesses = Array.isArray(profile.weaknesses)
        ? profile.weaknesses
        : [];

    return weaknesses.includes(concept);

}

function validateProfileConceptState(profile, concept) {

    if (!profile) return;

    const strengths = Array.isArray(profile.strengths)
        ? profile.strengths
        : [];

    const weaknesses = Array.isArray(profile.weaknesses)
        ? profile.weaknesses
        : [];

    if (
        strengths.includes(concept) &&
        weaknesses.includes(concept)
    ) {
        console.warn(
            `[AdaptiveSelector] Concept exists in BOTH strengths and weaknesses: ${concept}`
        );
    }
}
/**
 * Computes priority score.
 */
function scoreQuestion({

    question,

    profile,

    state,

    difficulty

}) {

    let score = 0;

    const concepts =

        question.concept_tags ||

        question.source_concepts ||

        [];

    /*
     * Asked?
     */

    if (question?.qid && state.askedQuestions?.includes(question.qid)) {
        return Number.NEGATIVE_INFINITY;
    }

    score += WEIGHTS.NOT_ASKED;

    /*
     * Concept score
     */

    const hasWeakConcept = concepts.some(c => state.weakConcepts?.includes(c));
    const hasUnseenConcept = concepts.some(c => state.conceptsNotCovered?.includes(c));
    const hasUnresolvedConcept = hasWeakConcept || hasUnseenConcept;

    for (const concept of concepts) {
        validateProfileConceptState(profile, concept);

        const isWeak = state.weakConcepts?.includes(concept);
        const isMastered = state.conceptsMastered?.includes(concept);

        console.log(
            `[AdaptiveSelector] ${question.qid} concept=${concept} ` +
            `weak=${isWeak} ` +
            `mastered=${isMastered} ` +
            `asked=${state.askedQuestions?.includes(question.qid)}`
        );

        if (isWeak) {
            score += WEIGHTS.WEAK_CONCEPT;
        }
    }

    if (concepts.length > 0 && concepts.every(c => state.conceptsMastered?.includes(c)) && !hasUnresolvedConcept) {
        score += WEIGHTS.MASTERED;
    }

    /*
     * Difficulty
     */

    const qDifficulty =

        String(question.difficulty || "")

            .toLowerCase();

    if (

        qDifficulty === difficulty ||

        !qDifficulty

    ) {

        score += WEIGHTS.DIFFICULTY_MATCH;

    } else {

        score += WEIGHTS.DIFFICULTY_MISMATCH;

    }

    console.log(
        `[AdaptiveSelector] ${question.qid} FINAL SCORE=${score}`
    );

    return score;

}

/**
 * Returns highest priority question.
 */
function selectNextQuestion({

    state,

    profile,

    graph,

    questions

}) {

    const difficulty =

        determineDifficulty(profile);

    let bestQuestion = null;

    const availableQuestions = questions.filter(
        q => !state.askedQuestions?.includes(q.qid)
    );

    let bestScore = Number.NEGATIVE_INFINITY;

    for (const question of availableQuestions) {
        console.log(`[AdaptiveSelector] Evaluating ${question.qid} | completed: ${
        state.completedQuestions?.join(", ") || "none"
    }`);

        const priority = scoreQuestion({

            question,

            profile,

            state,

            difficulty

        });

        console.log(
        `[AdaptiveSelector] ${question.qid} | priority=${priority} | difficulty=${question.difficulty || "unknown"} | concepts=${
            (
                question.concept_tags ||
                question.source_concepts ||
                []
            ).join(", ")
        }`
    );
        if (priority > bestScore) {

            bestScore = priority;

            bestQuestion = question;

        }

    }

    console.log(
        `[AdaptiveSelector] SELECTED ${
            bestQuestion?.qid || "NONE"
        } | priority=${bestScore}`
    );

    if (!bestQuestion) {

        return {

            nextQuestion: null,

            interviewComplete: true,

            reason:

                "No remaining questions."

        };

    }

    return {

        nextQuestion: bestQuestion,

        priority: bestScore,

        difficulty,

        interviewComplete: false,

        targetConcept:

            (

                bestQuestion.concept_tags ||

                bestQuestion.source_concepts ||

                []

            )[0] || null,

        reason:

            "Highest priority question."

    };

}

module.exports = Object.freeze({

    determineDifficulty,

    scoreQuestion,

    selectNextQuestion

});