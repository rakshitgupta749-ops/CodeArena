"use strict";

/**
 * ---------------------------------------------------------
 * Report Generator
 * ---------------------------------------------------------
 * Converts the complete interview state into a structured
 * recruiter report.
 *
 * Input:
 *  - Candidate Profile
 *  - Evidence Store
 *  - Concept Graph
 *  - Interview Session
 *
 * Output:
 *  - Recruiter Report
 * ---------------------------------------------------------
 */

const DEFAULTS = Object.freeze({

    HIRE_THRESHOLD: 80,

    BORDERLINE_THRESHOLD: 60,

    LOW_CONFIDENCE: 40,

    HIGH_CONFIDENCE: 80

});

/**
 * Clamp value to 0-100.
 */
function normalizeScore(value) {

    let score = Number(value);

    if (!Number.isFinite(score)) {

        score = 0;

    }

    score = Math.max(

        0,

        Math.min(

            100,

            score

        )

    );

    return Math.round(score);

}

/**
 * Average helper.
 */
function average(values = []) {

    if (!values.length) {

        return 0;

    }

    const total = values.reduce(

        (sum, value) => sum + Number(value || 0),

        0

    );

    return Math.round(total / values.length);

}

/**
 * Recommendation.
 */
function determineRecommendation(

    overallScore,

    confidence

) {

    overallScore = normalizeScore(overallScore);

    confidence = normalizeScore(confidence);

    if (

        overallScore >= DEFAULTS.HIRE_THRESHOLD &&

        confidence >= DEFAULTS.HIGH_CONFIDENCE

    ) {

        return "Hire";

    }

    if (

        overallScore >= DEFAULTS.BORDERLINE_THRESHOLD

    ) {

        return "Borderline";

    }

    return "Reject";

}

/**
 * Empty report.
 */
function createReport() {

    return {

        generatedAt: new Date(),

        version: "2.0",

        recommendation: "Pending",

        overallScore: 0,

        confidence: 0,

        executiveSummary: "",

        competencies: {},

        conceptAnalysis: {},

        evidenceSummary: {},

        interviewStatistics: {},

        strengths: [],

        weaknesses: [],

        risks: [],

        improvementSuggestions: [],

        timeline: []

    };

}

/**
 * ---------------------------------------------------------
 * Competency Report
 * ---------------------------------------------------------
 */

/**
 * Returns normalized competency scores.
 */
function buildCompetencyReport(profile) {

    const competencies =
        profile?.competencies || {};

    return {

        technicalKnowledge: normalizeScore(
            competencies.technicalKnowledge?.score
        ),

        reasoning: normalizeScore(
            competencies.reasoning?.score
        ),

        communication: normalizeScore(
            competencies.communication?.score
        ),

        debugging: normalizeScore(
            competencies.debugging?.score
        ),

        decisionMaking: normalizeScore(
            competencies.decisionMaking?.score
        ),

        learningAbility: normalizeScore(
            competencies.learningAbility?.score
        ),

        professionalism: normalizeScore(
            competencies.professionalism?.score
        ),

        integrity: normalizeScore(
            competencies.integrity?.score
        )

    };

}

/**
 * Returns overall competency score.
 */
function competencyAverage(report) {

    return average(

        Object.values(report)

    );

}

/**
 * Extracts strongest competencies.
 */
function strongestCompetencies(report) {

    return Object.entries(report)

        .sort(

            (a, b) => b[1] - a[1]

        )

        .slice(0, 3)

        .map(

            ([name, score]) => ({

                competency: name,

                score

            })

        );

}

/**
 * Extracts weakest competencies.
 */
function weakestCompetencies(report) {

    return Object.entries(report)

        .sort(

            (a, b) => a[1] - b[1]

        )

        .slice(0, 3)

        .map(

            ([name, score]) => ({

                competency: name,

                score

            })

        );

}

/**
 * Populates report with competency analysis.
 */
function populateCompetencySection(

    report,

    candidateProfile

) {

    const competencyReport =
        buildCompetencyReport(

            candidateProfile

        );

    report.competencies = {

        scores:

            competencyReport,

        average:

            competencyAverage(

                competencyReport

            ),

        strongest:

            strongestCompetencies(

                competencyReport

            ),

        weakest:

            weakestCompetencies(

                competencyReport

            )

    };

    return report;

}

/**
 * ---------------------------------------------------------
 * Concept Analysis
 * ---------------------------------------------------------
 */

/**
 * Builds concept analysis section.
 */
function buildConceptAnalysis(
    candidateProfile,
    conceptGraph
) {

    const mastered = [];
    const weak = [];
    const improving = [];
    const missing = [];

    const nodes =
        conceptGraph?.nodes || {};

    const totalConcepts =
        Object.keys(nodes).length;

    for (const [concept, node] of Object.entries(nodes)) {

        const mastery =
            normalizeScore(
                node.mastery || 0
            );

        const attempts =
            node.attempts || 0;

        if (attempts === 0) {

            missing.push(concept);

            continue;

        }

        if (mastery >= 80) {

            mastered.push({

                concept,

                mastery,

                attempts

            });

        }
        else if (mastery < 50) {

            weak.push({

                concept,

                mastery,

                attempts

            });

        }
        else {

            improving.push({

                concept,

                mastery,

                attempts

            });

        }

    }

    mastered.sort(
        (a, b) => b.mastery - a.mastery
    );

    weak.sort(
        (a, b) => a.mastery - b.mastery
    );

    improving.sort(
        (a, b) => b.mastery - a.mastery
    );

    const coveredConcepts =
        totalConcepts - missing.length;

    const coverage =
        totalConcepts === 0
            ? 0
            : Math.round(
                (coveredConcepts / totalConcepts) * 100
            );

    return {

        totalConcepts,

        coveredConcepts,

        coverage,

        mastered,

        improving,

        weak,

        missing,

        strongestConcepts:
            candidateProfile?.strongConcepts || [],

        weakestConcepts:
            candidateProfile?.weakConcepts || []

    };

}

/**
 * Populates concept section.
 */
function populateConceptSection(
    report,
    candidateProfile,
    conceptGraph
) {

    report.conceptAnalysis =
        buildConceptAnalysis(
            candidateProfile,
            conceptGraph
        );

    return report;

}

/**
 * ---------------------------------------------------------
 * Evidence Summary
 * ---------------------------------------------------------
 */

/**
 * Builds evidence analysis.
 */
function buildEvidenceSummary(evidenceStore) {

    const evidence = evidenceStore?.evidence || [];

    const summary = {

        totalEvidence: evidence.length,

        averageScore: 0,

        averageConfidence: 0,

        classifications: {},

        competencyEvidence: {},

        conceptEvidence: {},

        strongestEvidence: [],

        weakestEvidence: []

    };

    if (!evidence.length) {

        return summary;

    }

    let totalScore = 0;

    let totalConfidence = 0;

    for (const item of evidence) {

        const score = Number(item.evaluatorScore || 0);

        const confidence = Number(item.confidence || 0);

        totalScore += score;

        totalConfidence += confidence;

        const classification =
            item.classification || "Unknown";

        summary.classifications[classification] =
            (summary.classifications[classification] || 0) + 1;

        const competency =
            item.competency || "General";

        if (!summary.competencyEvidence[competency]) {

            summary.competencyEvidence[competency] = [];

        }

        summary.competencyEvidence[competency].push(item);

        const concepts =
            Array.isArray(item.tags)
                ? item.tags
                : item.concept
                    ? [item.concept]
                    : [];

        for (const concept of concepts) {

            if (!summary.conceptEvidence[concept]) {

                summary.conceptEvidence[concept] = [];

            }

            summary.conceptEvidence[concept].push(item);

        }

    }

    summary.averageScore =
        normalizeScore(
            totalScore / evidence.length
        );

    summary.averageConfidence =
        normalizeScore(
            totalConfidence / evidence.length
        );

    summary.strongestEvidence =
        [...evidence]
            .sort(
                (a, b) =>
                    (b.evaluatorScore || 0) -
                    (a.evaluatorScore || 0)
            )
            .slice(0, 5);

    summary.weakestEvidence =
        [...evidence]
            .sort(
                (a, b) =>
                    (a.evaluatorScore || 0) -
                    (b.evaluatorScore || 0)
            )
            .slice(0, 5);

    return summary;

}

/**
 * Populates evidence section.
 */
function populateEvidenceSection(
    report,
    evidenceStore
) {

    report.evidenceSummary =
        buildEvidenceSummary(
            evidenceStore
        );

    return report;

}

/**
 * ---------------------------------------------------------
 * Interview Statistics
 * ---------------------------------------------------------
 */

/**
 * Builds interview statistics.
 */
function buildInterviewStatistics(session) {

    const questions = session?.questions || [];
    const answers = session?.answers || [];

    const statistics = {

        totalQuestions: questions.length,

        answeredQuestions: answers.length,

        skippedQuestions: 0,

        correctAnswers: 0,

        partialAnswers: 0,

        incorrectAnswers: 0,

        averageScore: 0,

        completionPercentage: 0,

        interviewDuration: null,

        scoreDistribution: {

            excellent: 0,

            good: 0,

            average: 0,

            poor: 0

        }

    };

    if (!answers.length) {

        return statistics;

    }

    let totalScore = 0;

    for (const answer of answers) {

        const evaluation = answer.evaluation || {};

        const score = Number(evaluation.final_score || 0);

        totalScore += score;

        if (score >= 4) {

            statistics.correctAnswers++;

            statistics.scoreDistribution.excellent++;

        }
        else if (score >= 2) {

            statistics.partialAnswers++;

            statistics.scoreDistribution.good++;

        }
        else if (score > 0) {

            statistics.incorrectAnswers++;

            statistics.scoreDistribution.average++;

        }
        else {

            statistics.skippedQuestions++;

            statistics.scoreDistribution.poor++;

        }

    }

    statistics.averageScore = Math.round(

        (totalScore / answers.length) * 20

    );

    statistics.completionPercentage =

        questions.length === 0

            ? 0

            : Math.round(

                (answers.length / questions.length) * 100

            );

    if (

        session?.startedAt &&

        session?.completedAt

    ) {

        statistics.interviewDuration =

            Math.round(

                (new Date(session.completedAt) -

                 new Date(session.startedAt))

                / 1000

            );

    }

    return statistics;

}

/**
 * Populates interview statistics section.
 */
function populateInterviewStatistics(

    report,

    session

) {

    report.interviewStatistics =

        buildInterviewStatistics(

            session

        );

    return report;

}

/**
 * ---------------------------------------------------------
 * Executive Summary
 * ---------------------------------------------------------
 */

/**
 * Builds executive summary.
 */
function buildExecutiveSummary(
    report,
    candidateProfile
) {

    const competencyAverage =
        report.competencies?.average || 0;

    const confidence =
        normalizeScore(
            candidateProfile?.confidence || 0
        );

    const recommendation =
        determineRecommendation(
            competencyAverage,
            confidence
        );

    const strongestCompetencies =
        report.competencies?.strongest || [];

    const weakestCompetencies =
        report.competencies?.weakest || [];

    const strongestConcepts =
        report.conceptAnalysis?.mastered
            ?.slice(0, 3)
            .map(item => item.concept) || [];

    const weakestConcepts =
        report.conceptAnalysis?.weak
            ?.slice(0, 3)
            .map(item => item.concept) || [];

    const coverage =
        report.conceptAnalysis?.coverage || 0;

    const totalEvidence =
        report.evidenceSummary?.totalEvidence || 0;

    const averageEvidenceScore =
        report.evidenceSummary?.averageScore || 0;

    const summary = [];

    summary.push(
        `The candidate demonstrated an overall competency score of ${competencyAverage}% with an interview confidence of ${confidence}%.`
    );

    summary.push(
        `Knowledge coverage reached ${coverage}% across the evaluated concepts.`
    );

    summary.push(
        `A total of ${totalEvidence} evidence records were collected with an average evaluation score of ${averageEvidenceScore}%.`
    );

    if (strongestCompetencies.length) {

        summary.push(
            `Strongest competencies include ${strongestCompetencies
                .map(c => c.competency)
                .join(", ")}.`
        );

    }

    if (weakestCompetencies.length) {

        summary.push(
            `Primary improvement areas include ${weakestCompetencies
                .map(c => c.competency)
                .join(", ")}.`
        );

    }

    if (strongestConcepts.length) {

        summary.push(
            `Strong conceptual understanding was demonstrated in ${strongestConcepts.join(", ")}.`
        );

    }

    if (weakestConcepts.length) {

        summary.push(
            `Additional practice is recommended for ${weakestConcepts.join(", ")}.`
        );

    }

    report.overallScore = competencyAverage;

    report.confidence = confidence;

    report.recommendation = recommendation;

    report.executiveSummary =
        summary.join(" ");

    return report;

}

/**
 * ---------------------------------------------------------
 * Risk Analysis & Improvement Suggestions
 * ---------------------------------------------------------
 */

/**
 * Builds risk analysis.
 */
function buildRiskAnalysis(
    report,
    candidateProfile
) {

    const risks = [];

    const suggestions = [];

    const confidence =
        normalizeScore(
            candidateProfile?.confidence || 0
        );

    if (confidence < 50) {

        risks.push(
            "Low confidence across interview responses."
        );

        suggestions.push(
            "Improve consistency by practicing mock interviews."
        );

    }

    const weakCompetencies =
        report.competencies?.weakest || [];

    for (const competency of weakCompetencies) {

        if (competency.score < 60) {

            risks.push(
                `Low ${competency.competency} competency.`
            );

            suggestions.push(
                `Practice ${competency.competency} through targeted exercises.`
            );

        }

    }

    const weakConcepts =
        report.conceptAnalysis?.weak || [];

    for (const concept of weakConcepts.slice(0, 5)) {

        suggestions.push(
            `Revise ${concept.concept}.`
        );

    }

    const statistics =
        report.interviewStatistics || {};

    if (statistics.skippedQuestions > 0) {

        risks.push(
            `${statistics.skippedQuestions} question(s) were skipped.`
        );

        suggestions.push(
            "Attempt every question even if uncertain."
        );

    }

    if (statistics.partialAnswers > 2) {

        risks.push(
            "Several answers were only partially correct."
        );

        suggestions.push(
            "Provide more complete explanations with supporting reasoning."
        );

    }

    if (
        candidateProfile?.contradictions &&
        candidateProfile.contradictions.length > 0
    ) {

        risks.push(
            `${candidateProfile.contradictions.length} contradiction(s) detected during the interview.`
        );

        suggestions.push(
            "Maintain consistency in technical explanations."
        );

    }

    report.risks =

        [...new Set(risks)];

    report.improvementSuggestions =

        [...new Set(suggestions)];

    return report;

}

/**
 * Populates risk section.
 */
function populateRiskSection(
    report,
    candidateProfile
) {

    return buildRiskAnalysis(
        report,
        candidateProfile
    );

}

/**
 * ---------------------------------------------------------
 * Generate Final Recruiter Report
 * ---------------------------------------------------------
 */

function generateReport({

    session,

    candidateProfile,

    conceptGraph,

    evidenceStore,

    preCodeAssessment,

    crossRoundComparison

}) {

    const report = createReport();

    report.roundScores = session?.roundScores || {
        round1PreCoding: session?.preCodeScore ?? 75,
        round2Coding: session?.codingScore ?? 0,
        round3Interview: session?.interviewScore ?? 0,
        alignmentIndex: session?.alignmentScore ?? 80,
    };
    report.crossRoundComparison = crossRoundComparison || session?.crossRoundComparison || null;
    report.preCodeAssessment = preCodeAssessment ? {
        id: preCodeAssessment._id,
        status: preCodeAssessment.status,
        score: preCodeAssessment.preCodeScore,
        rubricSummary: preCodeAssessment.rubricSummary,
        intentProfile: preCodeAssessment.intentProfile,
    } : null;

    populateCompetencySection(

        report,

        candidateProfile

    );

    populateConceptSection(

        report,

        candidateProfile,

        conceptGraph

    );

    populateEvidenceSection(

        report,

        evidenceStore

    );

    populateInterviewStatistics(

        report,

        session

    );

    buildExecutiveSummary(

        report,

        candidateProfile

    );

    populateRiskSection(

        report,

        candidateProfile

    );

    report.timeline =

        candidateProfile?.timeline ||

        [];

    return report;

}

module.exports = {

    generateReport,

    determineRecommendation,

    buildCompetencyReport,

    buildConceptAnalysis,

    buildEvidenceSummary,

    buildInterviewStatistics,

    buildExecutiveSummary,

    buildRiskAnalysis

};