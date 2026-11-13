"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  resolveQuestionAnchors,
  findUniqueCodeAnchorRange,
  validateQuestionSourceContracts,
} = require("../src/services/questionGeneratorV2");

// Load the versioned grounding benchmark
const benchmarkPath = path.resolve(__dirname, "../../GROUNDING_BENCHMARK.json");
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));

/**
 * Approach A: Current Production Baseline
 * Simulates the live pipeline in questionGeneratorV2:
 * 1. resolveQuestionAnchors (which includes deterministic_fallback and expansion)
 * 2. validateQuestionSourceContracts
 */
function evaluateApproachA(benchmarkCase) {
  const { source_code, generated_question } = benchmarkCase;
  try {
    const qCopy = JSON.parse(JSON.stringify(generated_question));
    const resolvedQuestions = resolveQuestionAnchors([qCopy], source_code);
    const resolvedQ = resolvedQuestions[0];

    if (!resolvedQ || resolvedQ.anchor_resolution === "unresolved" || !resolvedQ.code_anchor) {
      return {
        decision: "REJECT",
        reason: "Anchor could not be resolved (unresolved)",
        resolvedAnchor: null,
        resolutionType: resolvedQ?.anchor_resolution || "none",
      };
    }

    validateQuestionSourceContracts([resolvedQ], source_code);

    return {
      decision: "ADMIT",
      reason: `Admitted with resolution: ${resolvedQ.anchor_resolution}`,
      resolvedAnchor: resolvedQ.code_anchor,
      resolutionType: resolvedQ.anchor_resolution,
    };
  } catch (err) {
    return {
      decision: "REJECT",
      reason: err.message,
      resolvedAnchor: null,
      resolutionType: "failed_contract",
    };
  }
}

/**
 * Approach B: Simple Validation (Strict Anchor & Contract Check)
 * Enforces strict lexical anchor existence without silent fallback rewriting.
 * If the anchor is missing, ambiguous, or ungrounded, it is rejected.
 */
function evaluateApproachB(benchmarkCase) {
  const { source_code, generated_question } = benchmarkCase;
  const originalAnchor = String(generated_question.code_anchor || "").trim();

  if (!originalAnchor) {
    return {
      decision: "REJECT",
      reason: "Missing code_anchor in question payload",
    };
  }

  const match = findUniqueCodeAnchorRange(originalAnchor, source_code);

  if (match.status === "missing") {
    return {
      decision: "REJECT",
      reason: "Original code_anchor is missing from submitted source code",
    };
  }

  if (match.status === "ambiguous") {
    return {
      decision: "REJECT",
      reason: `Original code_anchor matched multiple locations (${match.matches.length})`,
    };
  }

  // Anchor is unique in source code
  const qCopy = {
    ...generated_question,
    code_line_start: match.range.start,
    code_line_end: match.range.end,
    code_snippet: originalAnchor,
    code_anchor: originalAnchor,
  };

  try {
    validateQuestionSourceContracts([qCopy], source_code);
    return {
      decision: "ADMIT",
      reason: "Anchor exists uniquely and contract validated",
    };
  } catch (err) {
    return {
      decision: "REJECT",
      reason: `Contract check failed: ${err.message}`,
    };
  }
}

async function runBenchmark() {
  console.log("=================================================================");
  console.log("  CodeArena — Grounding Benchmark Evaluation (Approaches A vs B)");
  console.log(`  Benchmark Version: ${benchmark.benchmark_version}`);
  console.log(`  Total Test Cases: ${benchmark.cases.length}`);
  console.log("=================================================================\n");

  const results = [];
  let aAdmittedUnsupported = 0;
  let aRejectedValid = 0;
  let bAdmittedUnsupported = 0;
  let bRejectedValid = 0;

  let totalValid = 0;
  let totalUnsupported = 0;
  let totalAmbiguous = 0;

  for (const c of benchmark.cases) {
    if (c.ground_truth_label === "VALID") totalValid++;
    else if (c.ground_truth_label === "UNSUPPORTED") totalUnsupported++;
    else if (c.ground_truth_label === "AMBIGUOUS") totalAmbiguous++;

    const outcomeA = evaluateApproachA(c);
    const outcomeB = evaluateApproachB(c);

    // Metrics for Approach A
    if (c.ground_truth_label === "UNSUPPORTED" && outcomeA.decision === "ADMIT") {
      aAdmittedUnsupported++;
    }
    if (c.ground_truth_label === "VALID" && outcomeA.decision === "REJECT") {
      aRejectedValid++;
    }

    // Metrics for Approach B
    if (c.ground_truth_label === "UNSUPPORTED" && outcomeB.decision === "ADMIT") {
      bAdmittedUnsupported++;
    }
    if (c.ground_truth_label === "VALID" && outcomeB.decision === "REJECT") {
      bRejectedValid++;
    }

    results.push({
      id: c.id,
      name: c.name,
      label: c.ground_truth_label,
      expected: c.expected_admission,
      approachA: outcomeA,
      approachB: outcomeB,
    });

    console.log(`[${c.id}] ${c.name}`);
    console.log(`      Ground Truth: ${c.ground_truth_label} (Expected: ${c.expected_admission})`);
    console.log(`      Approach A (Production): ${outcomeA.decision} (${outcomeA.reason})`);
    console.log(`      Approach B (Simple Val):  ${outcomeB.decision} (${outcomeB.reason})`);
    console.log("-----------------------------------------------------------------");
  }

  const aUnsupportedRate = ((aAdmittedUnsupported / totalUnsupported) * 100).toFixed(1);
  const aValidRejectionRate = ((aRejectedValid / totalValid) * 100).toFixed(1);
  const bUnsupportedRate = ((bAdmittedUnsupported / totalUnsupported) * 100).toFixed(1);
  const bValidRejectionRate = ((bRejectedValid / totalValid) * 100).toFixed(1);

  console.log("\n=================================================================");
  console.log("                      SUMMARY METRICS                            ");
  console.log("=================================================================");
  console.log(`Dataset Breakdown:`);
  console.log(`  - VALID cases:       ${totalValid}`);
  console.log(`  - UNSUPPORTED cases: ${totalUnsupported}`);
  console.log(`  - AMBIGUOUS cases:   ${totalAmbiguous}`);
  console.log(`  - Total:             ${benchmark.cases.length}\n`);

  console.log(`Approach A (Production Baseline with Fallback):`);
  console.log(`  - Unsupported Questions Admitted: ${aAdmittedUnsupported} / ${totalUnsupported}`);
  console.log(`  - Unsupported Admission Rate:     ${aUnsupportedRate}% (Type I False Acceptance)`);
  console.log(`  - Valid Questions Rejected:       ${aRejectedValid} / ${totalValid}`);
  console.log(`  - Valid Rejection Rate:           ${aValidRejectionRate}% (Type II False Rejection)\n`);

  console.log(`Approach B (Simple Validation without Fallback):`);
  console.log(`  - Unsupported Questions Admitted: ${bAdmittedUnsupported} / ${totalUnsupported}`);
  console.log(`  - Unsupported Admission Rate:     ${bUnsupportedRate}% (Type I False Acceptance)`);
  console.log(`  - Valid Questions Rejected:       ${bRejectedValid} / ${totalValid}`);
  console.log(`  - Valid Rejection Rate:           ${bValidRejectionRate}% (Type II False Rejection)\n`);

  // Assertions to verify the benchmark executes properly
  assert.strictEqual(results.length, 12, "Must evaluate all 12 benchmark cases");
  assert.strictEqual(totalValid, 3);
  assert.strictEqual(totalUnsupported, 6);
  assert.strictEqual(totalAmbiguous, 3);

  // Approach A should admit valid questions
  assert.strictEqual(aRejectedValid, 0, "Approach A must not reject valid questions");

  // Approach B should admit valid questions
  assert.strictEqual(bRejectedValid, 0, "Approach B must not reject valid questions");

  // Approach B must strictly outperform Approach A on rejecting missing anchors
  assert.ok(
    bAdmittedUnsupported < aAdmittedUnsupported,
    "Approach B should reject more unsupported questions than Approach A by catching missing anchors"
  );

  console.log("✅ All Benchmark Assertions PASSED Successfully!\n");
  return { results, metrics: { totalValid, totalUnsupported, totalAmbiguous, aAdmittedUnsupported, aUnsupportedRate, aRejectedValid, aValidRejectionRate, bAdmittedUnsupported, bUnsupportedRate, bRejectedValid, bValidRejectionRate } };
}

if (require.main === module) {
  runBenchmark().catch((err) => {
    console.error("Benchmark Execution Failed:", err);
    process.exit(1);
  });
}

module.exports = {
  runBenchmark,
  evaluateApproachA,
  evaluateApproachB,
};
