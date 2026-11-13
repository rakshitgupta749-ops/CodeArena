"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  evaluateApproachA,
  evaluateApproachB,
} = require("./groundingBenchmark.test");
const { evaluateApproachC } = require("../src/services/evidenceGroundingValidator");

const benchmarkPath = path.resolve(__dirname, "../../GROUNDING_BENCHMARK_EXPANDED.json");
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));

function runExpandedBenchmark() {
  console.log("=================================================================");
  console.log("  CodeArena — Grounding Benchmark Evaluation (58 Expanded Cases)");
  console.log(`  Benchmark Version: ${benchmark.benchmark_version}`);
  console.log(`  Total Cases: ${benchmark.cases.length}`);
  console.log("=================================================================\n");

  const results = [];
  const disagreements = [];

  let aAdmittedUnsupported = 0;
  let aRejectedValid = 0;
  let bAdmittedUnsupported = 0;
  let bRejectedValid = 0;
  let cAdmittedUnsupported = 0;
  let cRejectedValid = 0;
  let cAbstainedAmbiguous = 0;

  let totalValid = 0;
  let totalUnsupported = 0;
  let totalAmbiguous = 0;

  const categoryBreakdown = {};

  for (const c of benchmark.cases) {
    if (!categoryBreakdown[c.category]) {
      categoryBreakdown[c.category] = { total: 0, aFalseAccept: 0, bFalseAccept: 0, cFalseAccept: 0 };
    }
    categoryBreakdown[c.category].total++;

    if (c.ground_truth_label === "VALID") totalValid++;
    else if (c.ground_truth_label === "UNSUPPORTED") totalUnsupported++;
    else if (c.ground_truth_label === "AMBIGUOUS") totalAmbiguous++;

    const outcomeA = evaluateApproachA(c);
    const outcomeB = evaluateApproachB(c);
    const outcomeC = evaluateApproachC(c);

    // Metrics for Approach A
    if (c.ground_truth_label === "UNSUPPORTED" && outcomeA.decision === "ADMIT") {
      aAdmittedUnsupported++;
      categoryBreakdown[c.category].aFalseAccept++;
    }
    if (c.ground_truth_label === "VALID" && outcomeA.decision === "REJECT") {
      aRejectedValid++;
    }

    // Metrics for Approach B
    if (c.ground_truth_label === "UNSUPPORTED" && outcomeB.decision === "ADMIT") {
      bAdmittedUnsupported++;
      categoryBreakdown[c.category].bFalseAccept++;
    }
    if (c.ground_truth_label === "VALID" && outcomeB.decision === "REJECT") {
      bRejectedValid++;
    }

    // Metrics for Approach C
    if (c.ground_truth_label === "UNSUPPORTED" && outcomeC.decision === "ADMIT") {
      cAdmittedUnsupported++;
      categoryBreakdown[c.category].cFalseAccept++;
    }
    if (c.ground_truth_label === "VALID" && outcomeC.decision === "REJECT") {
      cRejectedValid++;
    }
    if (c.ground_truth_label === "AMBIGUOUS" && outcomeC.decision === "MANUAL_REVIEW") {
      cAbstainedAmbiguous++;
    }

    // Disagreement tracking
    const disagreementItem = {
      id: c.id,
      name: c.name,
      category: c.category,
      language: c.language,
      humanLabel: c.ground_truth_label,
      expectedAdmission: c.expected_admission,
      verdictA: outcomeA.decision,
      verdictB: outcomeB.decision,
      verdictC: outcomeC.decision,
      disagreesWithA: (c.expected_admission !== outcomeA.decision),
      disagreesWithB: (c.expected_admission !== outcomeB.decision),
      disagreesWithC: (c.expected_admission !== outcomeC.decision),
    };
    disagreements.push(disagreementItem);

    results.push({
      id: c.id,
      name: c.name,
      category: c.category,
      language: c.language,
      label: c.ground_truth_label,
      expected: c.expected_admission,
      approachA: outcomeA,
      approachB: outcomeB,
      approachC: outcomeC,
    });
  }

  const aUnsupportedRate = ((aAdmittedUnsupported / totalUnsupported) * 100).toFixed(1);
  const aValidRejectionRate = ((aRejectedValid / totalValid) * 100).toFixed(1);
  const bUnsupportedRate = ((bAdmittedUnsupported / totalUnsupported) * 100).toFixed(1);
  const bValidRejectionRate = ((bRejectedValid / totalValid) * 100).toFixed(1);
  const cUnsupportedRate = ((cAdmittedUnsupported / totalUnsupported) * 100).toFixed(1);
  const cValidRejectionRate = ((cRejectedValid / totalValid) * 100).toFixed(1);
  const cAbstentionRate = ((cAbstainedAmbiguous / totalAmbiguous) * 100).toFixed(1);

  console.log("=================================================================");
  console.log("              EXPANDED BENCHMARK SUMMARY (58 CASES)              ");
  console.log("=================================================================");
  console.log(`Cases Distribution:`);
  console.log(`  - VALID cases:       ${totalValid} (25.9%)`);
  console.log(`  - UNSUPPORTED cases: ${totalUnsupported} (63.8%)`);
  console.log(`  - AMBIGUOUS cases:   ${totalAmbiguous} (10.3%)`);
  console.log(`  - Total:             ${benchmark.cases.length}\n`);

  console.log(`Approach A (Production Baseline):`);
  console.log(`  - Unsupported Admitted (Type I Error): ${aAdmittedUnsupported} / ${totalUnsupported} (${aUnsupportedRate}%)`);
  console.log(`  - Valid Rejected (Type II Error):      ${aRejectedValid} / ${totalValid} (${aValidRejectionRate}%)`);
  console.log(`  - Total Human Label Disagreements:     ${disagreements.filter(d => d.disagreesWithA).length} / 58\n`);

  console.log(`Approach B (Simple Validation):`);
  console.log(`  - Unsupported Admitted (Type I Error): ${bAdmittedUnsupported} / ${totalUnsupported} (${bUnsupportedRate}%)`);
  console.log(`  - Valid Rejected (Type II Error):      ${bRejectedValid} / ${totalValid} (${bValidRejectionRate}%)`);
  console.log(`  - Total Human Label Disagreements:     ${disagreements.filter(d => d.disagreesWithB).length} / 58\n`);

  console.log(`Approach C (Evidence-Grounded Validation):`);
  console.log(`  - Unsupported Admitted (Type I Error): ${cAdmittedUnsupported} / ${totalUnsupported} (${cUnsupportedRate}%)`);
  console.log(`  - Valid Rejected (Type II Error):      ${cRejectedValid} / ${totalValid} (${cValidRejectionRate}%)`);
  console.log(`  - Ambiguous Correctly Abstained:       ${cAbstainedAmbiguous} / ${totalAmbiguous} (${cAbstentionRate}%)`);
  console.log(`  - Total Human Label Disagreements:     ${disagreements.filter(d => d.disagreesWithC).length} / 58\n`);

  console.log("=================================================================");
  console.log("              PER-CATEGORY FALSE ACCEPTANCE BREAKDOWN            ");
  console.log("=================================================================");
  console.table(categoryBreakdown);

  // Assertions
  assert.strictEqual(results.length, 58, "Must evaluate all 58 cases");
  assert.strictEqual(totalValid, 15);
  assert.strictEqual(totalUnsupported, 37);
  assert.strictEqual(totalAmbiguous, 6);

  // Approach C must outperform Approach B and A
  assert.ok(
    cAdmittedUnsupported < bAdmittedUnsupported,
    "Approach C must have lower unsupported admission than Approach B"
  );
  assert.ok(
    bAdmittedUnsupported < aAdmittedUnsupported,
    "Approach B must have lower unsupported admission than Approach A"
  );
  // Leakage-free baseline verification
  assert.strictEqual(cRejectedValid, 8, "Blind Approach C has 8 false valid rejections due to anchor-relevance heuristics");
  assert.strictEqual(cAdmittedUnsupported, 11, "Blind Approach C admits 11 unsupported questions (down from 24 in B and 37 in A)");

  console.log("✅ All 58-Case Benchmark Assertions PASSED Successfully!\n");
  return { results, disagreements, categoryBreakdown, metrics: {
    totalCases: benchmark.cases.length,
    totalValid, totalUnsupported, totalAmbiguous,
    aAdmittedUnsupported, aUnsupportedRate, aRejectedValid, aValidRejectionRate,
    bAdmittedUnsupported, bUnsupportedRate, bRejectedValid, bValidRejectionRate,
    cAdmittedUnsupported, cUnsupportedRate, cRejectedValid, cValidRejectionRate,
    cAbstainedAmbiguous, cAbstentionRate
  }};
}

if (require.main === module) {
  try {
    runExpandedBenchmark();
  } catch (err) {
    console.error("Expanded Benchmark Failed:", err);
    process.exit(1);
  }
}

module.exports = {
  runExpandedBenchmark,
};

