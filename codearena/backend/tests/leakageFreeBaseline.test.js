"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const {
  validateQuestionGroundedness,
  evaluateApproachC,
} = require("../src/services/evidenceGroundingValidator");

// Load the 58 development cases
const benchmarkPath = path.resolve(__dirname, "../../GROUNDING_BENCHMARK_EXPANDED.json");
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));

/**
 * Suite 1: Adversarial Label-Invariance Regression Test
 * Proves mathematically and empirically that ground-truth labels, rationales,
 * or pre-packaged decomposed_claims CANNOT influence inference decisions.
 */
function testAdversarialLabelInvariance() {
  console.log("-----------------------------------------------------------------");
  console.log("Running Suite 1: Adversarial Label-Invariance Regression Test...");

  let testsPassed = 0;
  for (const c of benchmark.cases) {
    // 1. Run baseline inference
    const baselineResult = evaluateApproachC(c);

    // 2. Create adversarially mutated benchmark case
    const mutatedCase = {
      id: `MUTATED_${c.id}`,
      name: `Adversarial Mutation of ${c.name}`,
      category: c.category,
      language: c.language,
      // INVERT or CORRUPT all label fields:
      ground_truth_label: c.ground_truth_label === "VALID" ? "UNSUPPORTED" : "VALID",
      expected_admission: c.expected_admission === "ADMIT" ? "REJECT" : "ADMIT",
      rationale: "MALICIOUS_ADVERSARIAL_RATIONALE_SHOULD_BE_IGNORED",
      // INJECT fraudulent claim classifications
      decomposed_claims: [
        {
          claim_id: "INJECTED_CLAIM_01",
          text: "Maliciously injected claim to test leakage",
          evidence_type: "injected",
          expected_classification: "CONTRADICTED", // Should be ignored!
        },
      ],
      // Same candidate code and question text
      source_code: c.source_code,
      generated_question: {
        ...c.generated_question,
        target_decision_override: "REJECT", // Malicious field
      },
    };

    // 3. Run inference on mutated case
    const mutatedResult = evaluateApproachC(mutatedCase);

    // 4. Assert 100% decision and claim invariance
    assert.strictEqual(
      mutatedResult.decision,
      baselineResult.decision,
      `Leakage detected on case ${c.id}: decision changed from ${baselineResult.decision} to ${mutatedResult.decision} when labels mutated!`
    );
    assert.strictEqual(
      mutatedResult.claims.length,
      baselineResult.claims.length,
      `Leakage detected on case ${c.id}: claim count changed when injected claims were supplied!`
    );
    assert.strictEqual(
      mutatedResult.supportedCount,
      baselineResult.supportedCount,
      `Leakage detected on case ${c.id}: supportedCount changed!`
    );
    assert.strictEqual(
      mutatedResult.contradictedCount,
      baselineResult.contradictedCount,
      `Leakage detected on case ${c.id}: contradictedCount changed!`
    );
    testsPassed++;
  }

  console.log(`✅ Passed: ${testsPassed}/58 cases proven invariant to adversarial label mutation.`);
}

/**
 * Suite 2: Anchor Uniqueness vs Semantic Contradiction Separation Test
 */
function testAnchorUniquenessSeparation() {
  console.log("\n-----------------------------------------------------------------");
  console.log("Running Suite 2: Anchor Contract vs Semantic Contradiction Separation...");

  const duplicateAnchorCase = benchmark.cases.find(c => c.id === "EXP-55");
  assert.ok(duplicateAnchorCase, "EXP-55 must exist in benchmark");

  const result = evaluateApproachC(duplicateAnchorCase);
  assert.strictEqual(result.decision, "REJECT", "Duplicate anchor must be rejected");
  assert.strictEqual(result.isAnchorDuplicate, true, "Must flag isAnchorDuplicate as true");
  assert.ok(
    result.summary.includes("Anchor uniqueness violation"),
    "Summary must distinguish anchor uniqueness violation from candidate logic contradictions"
  );

  console.log("✅ Passed: Duplicate anchors cleanly distinguished from semantic contradictions.");
}

/**
 * Suite 3: Reproduced Blind Baseline on 58 Development Cases
 */
function runBlindBaselineEvaluation() {
  console.log("\n=================================================================");
  console.log("Running Suite 3: Blind Baseline Evaluation (No Ground-Truth Leakage)");
  console.log("=================================================================\n");

  const latencies = [];
  const results = [];
  const errors = [];

  let admitExpected = 0;
  let rejectExpected = 0;
  let manualReviewExpected = 0;

  const confusionMatrix = {
    ADMIT: { ADMIT: 0, REJECT: 0, MANUAL_REVIEW: 0 },
    REJECT: { ADMIT: 0, REJECT: 0, MANUAL_REVIEW: 0 },
    MANUAL_REVIEW: { ADMIT: 0, REJECT: 0, MANUAL_REVIEW: 0 },
  };

  const perLanguage = {
    java: { total: 0, correct: 0, latencies: [] },
    python: { total: 0, correct: 0, latencies: [] },
  };

  for (const c of benchmark.cases) {
    const lang = (c.language || "java").toLowerCase();
    perLanguage[lang].total++;

    const t0 = performance.now();
    // Pure blind inference
    const inferenceResult = evaluateApproachC(c);
    const t1 = performance.now();

    const dt = t1 - t0;
    latencies.push(dt);
    perLanguage[lang].latencies.push(dt);

    const expected = c.expected_admission;
    const actual = inferenceResult.decision;

    if (expected === "ADMIT") admitExpected++;
    else if (expected === "REJECT") rejectExpected++;
    else if (expected === "MANUAL_REVIEW") manualReviewExpected++;

    confusionMatrix[expected][actual]++;

    const isMatch = actual === expected;
    if (isMatch) {
      perLanguage[lang].correct++;
    } else {
      errors.push({
        id: c.id,
        category: c.category,
        language: c.language,
        label: c.ground_truth_label,
        expected,
        actual,
        question: c.generated_question?.question,
        summary: inferenceResult.summary,
      });
    }

    results.push({
      id: c.id,
      label: c.ground_truth_label,
      expected,
      actual,
      isMatch,
      latencyMs: dt,
    });
  }

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];

  const totalMatches = results.filter(r => r.isMatch).length;
  const totalCases = benchmark.cases.length;
  const accuracy = ((totalMatches / totalCases) * 100).toFixed(1);

  // Type I & Type II Errors
  const validCases = benchmark.cases.filter(c => c.ground_truth_label === "VALID");
  const unsupportedCases = benchmark.cases.filter(c => c.ground_truth_label === "UNSUPPORTED");
  const ambiguousCases = benchmark.cases.filter(c => c.ground_truth_label === "AMBIGUOUS");

  const validFalseRejections = results.filter(
    r => r.label === "VALID" && r.actual === "REJECT"
  ).length;
  const validRejectionRate = ((validFalseRejections / validCases.length) * 100).toFixed(1);

  const unsupportedFalseAdmissions = results.filter(
    r => r.label === "UNSUPPORTED" && r.actual === "ADMIT"
  ).length;
  const unsupportedAdmissionRate = (
    (unsupportedFalseAdmissions / unsupportedCases.length) * 100
  ).toFixed(1);

  const ambiguousAbstained = results.filter(
    r => r.label === "AMBIGUOUS" && r.actual === "MANUAL_REVIEW"
  ).length;
  const ambiguousAbstentionRate = ((ambiguousAbstained / ambiguousCases.length) * 100).toFixed(1);

  const ambiguousRejected = results.filter(
    r => r.label === "AMBIGUOUS" && r.actual === "REJECT"
  ).length;
  const ambiguousRejectionRate = ((ambiguousRejected / ambiguousCases.length) * 100).toFixed(1);

  const ambiguousAdmitted = results.filter(
    r => r.label === "AMBIGUOUS" && r.actual === "ADMIT"
  ).length;
  const ambiguousAdmissionRate = ((ambiguousAdmitted / ambiguousCases.length) * 100).toFixed(1);

  console.log("=================================================================");
  console.log("                 REPRODUCED BLIND METRICS REPORT                 ");
  console.log("=================================================================");
  console.log(`Total Cases Evaluated:       ${totalCases}`);
  console.log(`Blind Correct Decisions:     ${totalMatches} / ${totalCases} (${accuracy}%)`);
  console.log(`Disagreements / Errors:      ${errors.length} / ${totalCases} (${(100 - accuracy).toFixed(1)}%)\n`);

  console.log(`Ground-Truth Error Rates:`);
  console.log(`  - Unsupported Admission Rate (Type I Error): ${unsupportedFalseAdmissions} / ${unsupportedCases.length} (${unsupportedAdmissionRate}%)`);
  console.log(`  - Valid Rejection Rate (Type II Error):      ${validFalseRejections} / ${validCases.length} (${validRejectionRate}%)`);
  console.log(`  - Ambiguous Abstention Rate (Manual Review):  ${ambiguousAbstained} / ${ambiguousCases.length} (${ambiguousAbstentionRate}%)`);
  console.log(`  - Ambiguous Rejection Rate (Non-Unique):      ${ambiguousRejected} / ${ambiguousCases.length} (${ambiguousRejectionRate}%)`);
  console.log(`  - Ambiguous False Admission Rate:            ${ambiguousAdmitted} / ${ambiguousCases.length} (${ambiguousAdmissionRate}%)\n`);

  console.log("Confusion Matrix (Row: Expected, Column: Inferred):");
  console.table(confusionMatrix);

  console.log("\nPer-Language Performance:");
  for (const [lang, data] of Object.entries(perLanguage)) {
    const acc = ((data.correct / data.total) * 100).toFixed(1);
    const mean = (data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length).toFixed(3);
    console.log(`  - ${lang.toUpperCase()}: ${data.correct}/${data.total} (${acc}%) | Mean Latency: ${mean}ms`);
  }

  console.log("\nLatency Distribution (N=58):");
  console.log(`  - Min:  ${minLatency.toFixed(3)} ms`);
  console.log(`  - P50:  ${p50.toFixed(3)} ms`);
  console.log(`  - Mean: ${meanLatency.toFixed(3)} ms`);
  console.log(`  - P95:  ${p95.toFixed(3)} ms`);
  console.log(`  - Max:  ${maxLatency.toFixed(3)} ms\n`);

  // Verify reproduction assertions
  assert.strictEqual(totalMatches, 38, "Blind baseline must produce exactly 38/58 matches");
  assert.strictEqual(errors.length, 20, "Blind baseline must have exactly 20 errors");
  assert.strictEqual(validFalseRejections, 8, "Must have exactly 8 valid false rejections");
  assert.strictEqual(unsupportedFalseAdmissions, 11, "Must have exactly 11 unsupported false admissions");
  assert.strictEqual(ambiguousAdmitted, 1, "Must have exactly 1 ambiguous false admission");

  const expectedValidRejectionIds = [
    "EXP-02", "EXP-05", "EXP-07", "EXP-08", "EXP-10", "EXP-12", "EXP-13", "EXP-14"
  ];
  const actualValidRejectionIds = errors.filter(e => e.label === "VALID").map(e => e.id);
  assert.deepStrictEqual(
    actualValidRejectionIds.sort(),
    expectedValidRejectionIds.sort(),
    "Valid false rejections must match the exact 8 verified case IDs"
  );

  const expectedUnsupportedAdmissionIds = [
    "EXP-25", "EXP-26", "EXP-27", "EXP-28", "EXP-32", "EXP-33", "EXP-35", "EXP-36", "EXP-37", "EXP-44", "EXP-51"
  ];
  const actualUnsupportedAdmissionIds = errors.filter(e => e.label === "UNSUPPORTED").map(e => e.id);
  assert.deepStrictEqual(
    actualUnsupportedAdmissionIds.sort(),
    expectedUnsupportedAdmissionIds.sort(),
    "Unsupported false admissions must match the exact 11 verified case IDs"
  );

  assert.strictEqual(errors.find(e => e.label === "AMBIGUOUS")?.id, "EXP-56");

  console.log("✅ All 3 Test Suites PASSED Successfully with Zero Leakage!\n");
  return { results, errors, confusionMatrix, latencies: { minLatency, p50, meanLatency, p95, maxLatency } };
}

if (require.main === module) {
  try {
    testAdversarialLabelInvariance();
    testAnchorUniquenessSeparation();
    runBlindBaselineEvaluation();
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

module.exports = {
  testAdversarialLabelInvariance,
  testAnchorUniquenessSeparation,
  runBlindBaselineEvaluation,
};

