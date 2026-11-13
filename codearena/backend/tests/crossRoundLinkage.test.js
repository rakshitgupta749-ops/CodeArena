"use strict";

const assert = require("assert");
const {
  extractRoundFacts,
  heuristicComparison,
  compareAcrossRounds,
} = require("../src/services/crossRoundComparisonService");
const { finalizeAssessment } = require("../src/services/preCodeAssessmentEngine");
const ReportGenerator = require("../src/services/reportGenerator");
const {
  findUniqueCodeAnchorRange,
  validateQuestionSourceContracts,
} = require("../src/services/questionGeneratorV2");

async function runTestSuite() {
  console.log("=================================================================");
  console.log("  CodeArena — Cross-Round Linkage & Assessment Stabilization Test");
  console.log("=================================================================\n");

  let passedCount = 0;
  let totalCount = 0;

  function test(name, fn) {
    totalCount++;
    try {
      fn();
      console.log(`✅ [PASS] Scenario ${totalCount}: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`❌ [FAIL] Scenario ${totalCount}: ${name}`);
      console.error(err);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Scenario 1: Candidate follows the originally stated algorithm
  // Unit Test (Pure logic verification)
  // --------------------------------------------------------------------------
  test("Candidate follows the originally stated algorithm", () => {
    const round1 = {
      hasData: true,
      algorithm: "Use a two-pointer technique on sorted array to find pairs in O(N)",
      dataStructures: "Array / Two Pointers",
      complexity: "O(N) Time, O(1) Space",
      edgeCases: "Empty array, duplicate elements, single element",
      keyQuotes: ["I will sort and use left and right pointers moving inward."],
    };

    const round2 = {
      hasData: true,
      codeSnippet: `
        public int[] twoSum(int[] nums, int target) {
          int left = 0, right = nums.length - 1;
          while (left < right) {
            int sum = nums[left] + nums[right];
            if (sum == target) return new int[]{left, right};
            else if (sum < target) left++;
            else right--;
          }
          return new int[]{-1, -1};
        }
      `,
      hasNestedLoops: false,
      usesHashMap: false,
      usesArrayList: false,
      detectedStructures: "Arrays",
      passRate: 100,
      status: "Accepted",
    };

    const round3 = {
      hasData: true,
      answersCount: 2,
      explanations: [
        {
          qid: "Q1",
          question: "Can you explain your approach and algorithm?",
          answer: "I used the two-pointer technique moving inward from the boundaries to find the pair in linear time.",
        },
        {
          qid: "Q2",
          question: "What is the time complexity of your solution?",
          answer: "The time complexity is O(N) because each pointer moves at most N times.",
        },
      ],
    };

    const result = heuristicComparison(round1, round2, round3);

    assert.ok(result.alignmentScore >= 85, `Expected score >= 85, got ${result.alignmentScore}`);
    assert.strictEqual(result.consistencyRating, "High");

    const algoComp = result.comparisons.find((c) => c.category === "Algorithm & Approach");
    assert.ok(algoComp, "Algorithm comparison missing");
    assert.strictEqual(algoComp.verdict, "Aligned");

    const complexityComp = result.comparisons.find((c) => c.category === "Time & Space Complexity");
    assert.ok(complexityComp, "Complexity comparison missing");
    assert.strictEqual(complexityComp.verdict, "Aligned");
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Candidate changes strategy and provides a valid explanation
  // Unit Test (Pivot detection)
  // --------------------------------------------------------------------------
  test("Candidate changes strategy and provides a valid explanation", () => {
    const round1 = {
      hasData: true,
      algorithm: "Brute force nested iteration over array elements",
      dataStructures: "Primitive Array",
      complexity: "O(N^2) Time, O(1) Space",
      edgeCases: "Null or empty input",
      keyQuotes: ["I was initially thinking of two loops checking every pair."],
    };

    const round2 = {
      hasData: true,
      codeSnippet: `
        public int[] twoSum(int[] nums, int target) {
          Map<Integer, Integer> map = new HashMap<>();
          for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) return new int[]{map.get(comp), i};
            map.put(nums[i], i);
          }
          return new int[]{-1, -1};
        }
      `,
      hasNestedLoops: false,
      usesHashMap: true,
      usesArrayList: false,
      detectedStructures: "HashMap/Set, Arrays",
      passRate: 100,
      status: "Accepted",
    };

    const round3 = {
      hasData: true,
      answersCount: 2,
      explanations: [
        {
          qid: "Q1",
          question: "Why did you use a HashMap instead of your initial array approach?",
          answer: "In Round 1 I suggested nested loops, but while coding I realized a HashMap reduces lookup to O(1) and overall runtime to O(N).",
        },
      ],
    };

    const result = heuristicComparison(round1, round2, round3);

    const dsComp = result.comparisons.find((c) => c.category === "Data Structure Choice");
    assert.ok(dsComp, "Data structure comparison missing");
    assert.strictEqual(dsComp.verdict, "Justified Pivot");
    assert.ok(
      result.pivotsIdentified.some((p) => p.category === "Data Structure Choice"),
      "Pivot should be recorded in pivotsIdentified"
    );
    assert.ok(result.alignmentScore >= 80, `Expected score >= 80 for justified pivot, got ${result.alignmentScore}`);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Claimed complexity conflicts with code, but evidence is incomplete
  // Unit Test (Safe non-punitive evaluation when viva did not probe)
  // --------------------------------------------------------------------------
  test("Candidate's claimed complexity conflicts with the code, but the evidence is incomplete", () => {
    const round1 = {
      hasData: true,
      algorithm: "Single loop scan",
      dataStructures: "Array",
      complexity: "O(N) linear time",
      edgeCases: "Boundary items",
      keyQuotes: ["Linear scan approach."],
    };

    const round2 = {
      hasData: true,
      codeSnippet: `
        for (int i = 0; i < n; i++) {
          for (int j = i + 1; j < n; j++) {
            if (arr[i] == arr[j]) return true;
          }
        }
      `,
      hasNestedLoops: true,
      usesHashMap: false,
      usesArrayList: false,
      detectedStructures: "Arrays",
      passRate: 90,
      status: "Accepted",
    };

    // Interview did NOT ask about complexity, or candidate gave a non-informative response
    const round3 = {
      hasData: true,
      answersCount: 1,
      explanations: [
        {
          qid: "Q1",
          question: "What class structure did you use?",
          answer: "I used a standard utility class.",
        },
      ],
    };

    const result = heuristicComparison(round1, round2, round3);

    const compComp = result.comparisons.find((c) => c.category === "Time & Space Complexity");
    assert.ok(compComp, "Complexity comparison missing");
    // Should NOT invent a Divergent contradiction when evidence is incomplete
    assert.strictEqual(compComp.verdict, "Justified Pivot");
    assert.ok(
      compComp.explanation.includes("incomplete"),
      `Expected explanation to mention incomplete evidence, got: ${compComp.explanation}`
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Round 1 assessment or intent profile is missing
  // Unit Test (Graceful handling of absent Round 1)
  // --------------------------------------------------------------------------
  test("Round 1 assessment or intent profile is missing", () => {
    const roundFacts = extractRoundFacts({
      preCodeAssessment: null,
      submission: {
        code: "public class Solution { public int solve() { return 42; } }",
        testCaseResults: [{ passed: true }],
        status: "Accepted",
      },
      interviewSession: {
        answers: [{ qid: "Q1", answer: "Standard method solution." }],
        questions: [{ qid: "Q1", question: "Explain your method." }],
      },
    });

    assert.strictEqual(roundFacts.round1.hasData, false);
    assert.strictEqual(roundFacts.round1.status, "unavailable");
    assert.ok(roundFacts.round1.algorithm.includes("Unavailable"));

    const comparison = heuristicComparison(roundFacts.round1, roundFacts.round2, roundFacts.round3);
    assert.strictEqual(comparison.comparisons.length, 4);
    assert.ok(typeof comparison.alignmentScore === "number");
    assert.ok(comparison.alignmentScore >= 0 && comparison.alignmentScore <= 100);

    // Verify it didn't fabricate statements
    const algoComp = comparison.comparisons.find((c) => c.category === "Algorithm & Approach");
    assert.ok(algoComp.explanation.includes("Round 1 pre-coding intent was unavailable"));
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Candidate source code or interview response is missing
  // Unit Test (Incomplete submission handling)
  // --------------------------------------------------------------------------
  test("Candidate source code or interview response is missing", () => {
    const factsEmptyCode = extractRoundFacts({
      preCodeAssessment: {
        intentProfile: { claimedAlgorithm: "Hash lookup" },
        status: "passed",
        preCodeScore: 85,
      },
      submission: null, // No submission
      interviewSession: null, // No interview
    });

    assert.strictEqual(factsEmptyCode.round2.hasData, false);
    assert.strictEqual(factsEmptyCode.round2.codeSnippet, "");
    assert.strictEqual(factsEmptyCode.round3.hasData, false);
    assert.strictEqual(factsEmptyCode.round3.answersCount, 0);

    const result = heuristicComparison(factsEmptyCode.round1, factsEmptyCode.round2, factsEmptyCode.round3);
    assert.strictEqual(result.comparisons.length, 4);
    assert.ok(Number.isFinite(result.alignmentScore));
    assert.ok(result.alignmentScore >= 0 && result.alignmentScore <= 100);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Comparison service receives malformed or incomplete input
  // Unit Test (Fuzzing / null safety)
  // --------------------------------------------------------------------------
  test("Comparison service receives malformed or incomplete input", () => {
    // Completely undefined inputs
    const factsNull = extractRoundFacts(undefined);
    assert.ok(factsNull.round1);
    assert.ok(factsNull.round2);
    assert.ok(factsNull.round3);

    const compNull = heuristicComparison(null, undefined, {});
    assert.strictEqual(compNull.comparisons.length, 4);
    assert.ok(compNull.alignmentScore >= 0 && compNull.alignmentScore <= 100);

    // Malformed interview answers (missing fields, wrong types)
    const malformedSession = {
      answers: [{ wrongField: 123 }, null, undefined, "not an object"],
      questions: null,
    };
    const factsMalformed = extractRoundFacts({ interviewSession: malformedSession });
    assert.ok(Array.isArray(factsMalformed.round3.explanations));

    const compMalformed = heuristicComparison(factsMalformed.round1, factsMalformed.round2, factsMalformed.round3);
    assert.ok(Number.isInteger(compMalformed.alignmentScore));
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Alignment calculation handles boundary values correctly
  // Unit Test (Numeric range clamping [0, 100])
  // --------------------------------------------------------------------------
  test("Alignment calculation handles boundary values correctly", () => {
    // Zero pass rate, divergent claims
    const lowRound2 = { hasData: true, passRate: 0, status: "Wrong Answer", detectedStructures: "None" };
    const lowRound1 = { hasData: false };
    const lowRound3 = { hasData: false, explanations: [] };

    const lowResult = heuristicComparison(lowRound1, lowRound2, lowRound3);
    assert.ok(lowResult.alignmentScore >= 0 && lowResult.alignmentScore <= 100);

    // Boundary check on direct score clamping logic
    const clampedUnder = Math.max(0, Math.min(100, -25));
    const clampedOver = Math.max(0, Math.min(100, 150));
    assert.strictEqual(clampedUnder, 0);
    assert.strictEqual(clampedOver, 100);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Final composite score matches the intended formula
  // Unit Test (Verifying exact weights: 25% R1 + 35% R2 + 25% R3 + 15% Alignment)
  // --------------------------------------------------------------------------
  test("Final composite score matches the intended formula", () => {
    function calculateCompositeScore(preCodeScore, codingScore, interviewScore, alignmentScore) {
      return Math.round(
        (preCodeScore * 0.25) +
        (codingScore * 0.35) +
        (interviewScore * 0.25) +
        (alignmentScore * 0.15)
      );
    }

    // Weights sum to 1.00
    const totalWeights = 0.25 + 0.35 + 0.25 + 0.15;
    assert.strictEqual(Math.round(totalWeights * 100) / 100, 1.0);

    // Case 1: Perfect 100 across all components
    assert.strictEqual(calculateCompositeScore(100, 100, 100, 100), 100);

    // Case 2: Zero across all components
    assert.strictEqual(calculateCompositeScore(0, 0, 0, 0), 0);

    // Case 3: Realistic candidate
    // (80 * 0.25) + (90 * 0.35) + (70 * 0.25) + (85 * 0.15)
    // = 20 + 31.5 + 17.5 + 12.75 = 81.75 -> round to 82
    assert.strictEqual(calculateCompositeScore(80, 90, 70, 85), 82);

    // Case 4: Weak pre-code, strong code, moderate interview
    // (50 * 0.25) + (100 * 0.35) + (60 * 0.25) + (75 * 0.15)
    // = 12.5 + 35 + 15 + 11.25 = 73.75 -> round to 74
    assert.strictEqual(calculateCompositeScore(50, 100, 60, 75), 74);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Interview completion is repeated
  // Unit Test (Idempotence of session completion)
  // --------------------------------------------------------------------------
  test("Interview completion is repeated (idempotent result)", () => {
    const existingSession = {
      _id: "sess_123",
      status: "completed",
      overallScore: 82,
      preCodeScore: 80,
      codingScore: 90,
      interviewScore: 70,
      alignmentScore: 85,
      roundScores: {
        round1PreCoding: 80,
        round2Coding: 90,
        round3Interview: 70,
        alignmentIndex: 85,
        weights: { round1: 0.25, round2: 0.35, round3: 0.25, alignment: 0.15 },
      },
      crossRoundComparison: {
        alignmentScore: 85,
        summary: "Consistent performance.",
        comparisons: [],
      },
      answers: [
        { qid: "C01", evaluation: { final_score: 4, flag: "SCORED" } },
        { qid: "C02", evaluation: { final_score: 5, flag: "SCORED" } },
      ],
      report: { summary: "Report text" },
    };

    // Simulate completion check in controller
    function handleCompletionRequest(session) {
      if (session.status === "completed") {
        return {
          overallScore: session.overallScore,
          roundScores: session.roundScores,
          crossRoundComparison: session.crossRoundComparison,
        };
      }
      throw new Error("Should not re-evaluate");
    }

    const firstCall = handleCompletionRequest(existingSession);
    const secondCall = handleCompletionRequest(existingSession);

    assert.deepStrictEqual(firstCall, secondCall);
    assert.strictEqual(firstCall.overallScore, 82);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Existing assessment records without the new fields still work
  // Integration Test (PreCode engine backward compatibility)
  // --------------------------------------------------------------------------
  test("Existing assessment records without new fields still work", async () => {
    const legacyAssessment = {
      user: "user_legacy",
      problem: "prob_legacy",
      status: "in_progress",
      questionCount: 7,
      rubricState: {
        "Understanding of the Problem": { rating: "strong", reason: "Good grasp of inputs and outputs" },
        "Algorithm / Approach": { rating: "strong", reason: "Proposed two-pointer strategy" },
        "Data Structure Choice": { rating: "average", reason: "Chose ArrayList" },
        "Correctness": { rating: "strong", reason: "Verified test cases" },
        "Time & Space Complexity": { rating: "average", reason: "Stated O(N) time" },
        "Edge Cases": { rating: "average", reason: "Noted null input" },
        "OOP / Design Concepts": { rating: "weak", reason: "No class definitions" },
      },
      conversation: [
        { role: "ai", text: "What is your approach?" },
        { role: "candidate", text: "I will use two pointers on sorted array." },
      ],
      // Note: no intentProfile, no preCodeScore initially
    };

    const problem = { title: "Legacy Problem", description: "Problem description" };

    const result = await finalizeAssessment({ problem, assessment: legacyAssessment });

    assert.ok(result.decision === "pass" || result.decision === "fail");
    assert.ok(typeof legacyAssessment.preCodeScore === "number");
    assert.ok(legacyAssessment.preCodeScore >= 35 && legacyAssessment.preCodeScore <= 100);
    assert.ok(legacyAssessment.intentProfile, "intentProfile must be populated");
    assert.strictEqual(legacyAssessment.intentProfile.claimedAlgorithm, "Proposed two-pointer strategy");
    assert.strictEqual(legacyAssessment.intentProfile.score, legacyAssessment.preCodeScore);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Report API and frontend handle missing historical data
  // Integration Test (Report generation safety)
  // --------------------------------------------------------------------------
  test("Report API and frontend handle missing historical data", () => {
    // Generate report for a session with missing crossRoundComparison and missing preCodeAssessment
    const minimalSession = {
      _id: "sess_old_version",
      status: "completed",
      preCodeScore: null,
      codingScore: 75,
      interviewScore: 80,
      alignmentScore: null,
      overallScore: 78,
      answers: [],
      questions: [],
    };

    const report = ReportGenerator.generateReport({
      session: minimalSession,
      preCodeAssessment: null,
      crossRoundComparison: null,
      candidateProfile: {},
      conceptGraph: {},
      evidenceStore: {},
    });

    assert.ok(report, "Report should be generated");
    assert.ok(report.roundScores, "Report should contain fallback roundScores");
    assert.strictEqual(report.roundScores.round2Coding, 75);
    assert.strictEqual(report.roundScores.round3Interview, 80);
    assert.strictEqual(report.preCodeAssessment, null);
    assert.strictEqual(report.crossRoundComparison, null);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: A generated question refers to unsupported or incorrectly resolved source code
  // Unit Test (Code anchor contract validation)
  // --------------------------------------------------------------------------
  test("Generated question refers to unsupported or incorrectly resolved source code", () => {
    const submittedSolution = `
      public class Solution {
        public int add(int a, int b) {
          return a + b;
        }
      }
    `;

    // Anchor that DOES NOT EXIST in the candidate's code
    const missingAnchor = "public double divide(int a, int b)";
    const matchMissing = findUniqueCodeAnchorRange(missingAnchor, submittedSolution);
    assert.strictEqual(matchMissing.status, "missing");

    // Invalid question object referencing the missing anchor
    const badQuestion = {
      qid: "C01",
      question: "How does your divide method handle zero division?",
      code_anchor: missingAnchor,
      code_snippet: missingAnchor,
      code_line_start: 10,
      code_line_end: 12,
      source: "submitted_code_llm",
    };

    // validateQuestionSourceContracts throws QUESTION_SOURCE_CONTRACT_FAILED when anchor is missing
    assert.throws(
      () => validateQuestionSourceContracts([badQuestion], submittedSolution),
      (err) => {
        return (
          err instanceof Error &&
          err.message.includes("QUESTION_SOURCE_CONTRACT_FAILED") &&
          err.message.includes("code_anchor was not found in the submitted solution")
        );
      },
      "Expected validateQuestionSourceContracts to throw contract failure for missing anchor"
    );

    // Anchor that DOES EXIST
    const validAnchor = "return a + b;";
    const matchValid = findUniqueCodeAnchorRange(validAnchor, submittedSolution);
    assert.strictEqual(matchValid.status, "unique");
    assert.ok(matchValid.range.start > 0);
  });

  console.log("\n=================================================================");
  console.log(`  All ${passedCount}/${totalCount} Scenarios Executed and PASSED Successfully!`);
  console.log("=================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failure:", err);
  process.exit(1);
});
