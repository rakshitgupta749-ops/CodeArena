# CodeArena — Grounding Validator Research Integrity and Blind Evaluation Audit Report

**Audit Date:** October 2026  
**Audited Artifacts:**
- Validator Service: `codearena/backend/src/services/evidenceGroundingValidator.js`
- Test Harness: `codearena/backend/tests/groundingExpandedBenchmark.test.js`
- Leakage-Free Test Suite: `codearena/backend/tests/leakageFreeBaseline.test.js`
- Benchmark Dataset: `GROUNDING_BENCHMARK_EXPANDED.json` (58 cases)
- Benchmark Generator: `codearena/backend/scripts/generateExpandedBenchmark.js`
- Held-Out Schema: `codearena/backend/schemas/heldOutGroundingSchema.json`
**Git Branch:** `research/leakage-free-eval` (Submodule: `3207854-CodeArena_v01`)  
**Base Commit:** `28f3ff9`

---

## 1. Executive Summary & Critical Findings Verification

A rigorous audit was conducted to investigate potential data leakage, benchmark-specific tuning, and reported blind evaluation discrepancies in `evidenceGroundingValidator.js`.

### Audit Findings Verification:
| Audit Hypothesis | Repository Verification Status | Evidence / Code Location |
|---|---|---|
| **1. `evaluateApproachC` reads ground-truth labels and overrides verdicts** | **VERIFIED (Confirmed Leakage)** | `evidenceGroundingValidator.js` lines 278–301 read `c.expected_classification` from `decomposed_claims` and explicitly overwrote `result.status` to match `claim.expected`. |
| **2. Heuristic rules were tuned against benchmark cases** | **VERIFIED (Co-Design Overfitting)** | Regexes in `extractQuestionClaims` (lines 78–111) hardcoded exact phrase clusters (`"token bucket"`, `"exponential backoff"`, `"aes"`, `"mx record"`, `"credit bureau"`) matching cases `EXP-38`–`EXP-54`. |
| **3. Blind evaluation without injected labels achieves 38/58 (20 errors)** | **VERIFIED (Exact Match)** | Executing `evaluateApproachC` blindly without label leakage produces exactly **38/58 matches** (65.5% accuracy): exactly **8 valid rejections**, **11 unsupported admissions**, and **1 ambiguous admission**. |

---

## 2. Line-by-Line Audit of Leakage Paths in Previous Implementation

### Path 1: Benchmark-Supplied Claims Bypassed Extraction
In `evidenceGroundingValidator.js` (former lines 278–285):
```javascript
const claims = (Array.isArray(decomposed_claims) && decomposed_claims.length > 0)
  ? decomposed_claims.map(c => ({
      claim_id: c.claim_id,
      text: c.text,
      type: c.evidence_type,
      expected: c.expected_classification, // <--- DIRECT LABEL LEAKAGE
    }))
  : extractQuestionClaims(generated_question, source_code, language);
```
- **Vulnerability:** When running `groundingExpandedBenchmark.test.js`, every case in `GROUNDING_BENCHMARK_EXPANDED.json` contained pre-annotated `decomposed_claims`. As a result, the real inference method `extractQuestionClaims` was **completely bypassed** during benchmark execution.

### Path 2: Ground-Truth Verdict Overriding
In `evidenceGroundingValidator.js` (former lines 292–301):
```javascript
if (claim.expected) {
  result = verifyClaim(claim, source_code, anchor, language);
  if (claim.expected === "CONTRADICTED" && result.status !== "CONTRADICTED") {
    result.status = "CONTRADICTED"; // <--- EXPLICIT OVERRIDE
    result.reason = result.reason || "Benchmark ground-truth identifies contradiction with source code.";
  } else if (claim.expected === "UNRESOLVED" && result.status !== "UNRESOLVED") {
    result.status = "UNRESOLVED"; // <--- EXPLICIT OVERRIDE
    result.reason = result.reason || "Benchmark ground-truth identifies insufficient evidence.";
  }
}
```
- **Vulnerability:** If `verifyClaim` failed to detect a contradiction or ambiguity, lines 294–300 forced `result.status = claim.expected`. This converted false acceptances into true negatives, manufacturing an artificial 100% precision score.

### Path 3: The Anchor-Relevance Flaw Causing Valid Question Rejections
In `verifyClaim` (lines 184–190):
```javascript
case "anchor_relevance": {
  const entity = claim.entityName;
  if (!entity) return { status: "SUPPORTED" };
  const anchorHasEntity = new RegExp(`\\b${entity}\\b`, "i").test(codeAnchor);
  if (!anchorHasEntity) {
    return {
      status: "CONTRADICTED",
      reason: `The displayed code anchor does not contain the referenced method '${entity}'.`,
    };
  }
```
- **Vulnerability:** When a question references an enclosing method (e.g., `binarySearch`) but anchors to the specific calculation line (e.g., `mid = low + (high - low) / 2`), the anchor snippet does not contain the method header string. The heuristic classified this as `CONTRADICTED`, falsely rejecting 8 valid questions in blind mode.

---

## 3. Architecture of Leakage-Free Inference Separation

To eliminate all leakage, `evidenceGroundingValidator.js` was refactored into two strictly decoupled layers:

```mermaid
flowchart TD
    subgraph Isolated Inference Runtime
        P[Inference Payload:\nsourceCode, questionText, codeAnchor, language]
        EC[extractQuestionClaims\n(Pure syntactic extraction from code + text)]
        VC[verifyClaim\n(Zero access to expected labels)]
        Gate{Strict Conjunction Policy}
        P --> EC --> VC --> Gate
        Gate --> Output[Inference Result:\ndecision, claims, summary, isAnchorDuplicate]
    end

    subgraph Evaluation Layer
        GT[Evaluation Ground Truth:\nexpected_admission, ground_truth_label]
        Output --> Join[Join Predictions with Labels]
        GT --> Join
        Join --> Metrics[Compute Metrics, Confusion Matrix, Disagreements]
    end
```

### 3.1 Clean Inference Function: `validateQuestionGroundedness`
- **Location:** [`evidenceGroundingValidator.js`](file:///home/labuser/Downloads/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/services/evidenceGroundingValidator.js)
- **Signature:** `validateQuestionGroundedness({ sourceCode, question, codeAnchor, language, contextEvidence })`
- **Strict Isolation Guarantees:**
  1. Accepts **only** candidate code, question text, proposed anchor, language, and context evidence.
  2. Strips and ignores any fields matching `expected`, `expected_classification`, `ground_truth_label`, `rationale`, or `case_id`.
  3. All `claim.expected` checks have been excised.
  4. Non-unique/duplicate anchors are flagged as contract violations (`isAnchorDuplicate: true`, `reason: "violates anchor uniqueness contract"`), cleanly separating UI contract constraints from candidate semantic contradictions.

### 3.2 Backward-Compatible Adapter: `evaluateApproachC`
- Accepts `benchmarkCase`, but extracts **strictly** `{ source_code, generated_question, language }`.
- Passes zero ground-truth metadata to inference.

---

## 4. Empirical Verification & Regression Testing

### 4.1 Suite 1: Adversarial Label-Invariance Regression Test
Automated test in [`leakageFreeBaseline.test.js`](file:///home/labuser/Downloads/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/tests/leakageFreeBaseline.test.js):
- **Method:** Iterates over all 58 benchmark cases, executes baseline inference, and compares against an adversarially mutated clone where:
  - `ground_truth_label` is inverted (`VALID` $\leftrightarrow$ `UNSUPPORTED`).
  - `expected_admission` is inverted (`ADMIT` $\leftrightarrow$ `REJECT`).
  - `rationale` is replaced with adversarial noise.
  - Fraudulent claims with `expected_classification: "CONTRADICTED"` are injected into `decomposed_claims`.
- **Result:** **58 / 58 cases PASSED**. Inferred decisions, claim counts, and verdicts were 100% byte-for-byte identical.

### 4.2 Suite 2: Anchor Contract Separation Test
- Case `EXP-55` (anchor appearing identically in multiple recursive methods) was verified:
  - Decision: `REJECT`
  - `isAnchorDuplicate`: `true`
  - Summary: `"Rejected: Anchor uniqueness violation (Code anchor is ambiguous; matched 2 distinct locations (violates anchor uniqueness contract))."`
  - Proves non-unique anchors are not classified as logic contradictions or interprocedural uncertainty.

---

## 5. Development Baseline Metrics (58 Development Cases)

Evaluating the existing validator honestly without label injection establishes the true baseline on the 58 development cases:

### 5.1 Primary Performance Metrics
| Metric | Basis / Denominator | Inferred Baseline Result | Prior Audit Finding |
|---|---|---|---|
| **Total Cases Evaluated** | $N$ | 58 | 58 |
| **Total Correct Decisions** | Matches with Human Labels | **38 / 58 (65.5%)** | 38 / 58 (65.5%) |
| **Total Disagreements / Errors** | Mismatches | **20 / 58 (34.5%)** | 20 / 58 (34.5%) |
| **Unsupported Admission Rate (Type I)** | False Acceptances / 37 Unsupported | **29.7% (11 / 37)** | 11 / 37 |
| **Valid Rejection Rate (Type II)** | False Rejections / 15 Valid | **53.3% (8 / 15)** | 8 / 15 |
| **Ambiguous Abstention Rate** | Manual Review / 6 Ambiguous | **50.0% (3 / 6)** | 3 / 6 |
| **Ambiguous Rejection Rate** | Duplicate Anchors / 6 Ambiguous | **33.3% (2 / 6)** | 2 / 6 |
| **Ambiguous False Admission Rate** | False Acceptances / 6 Ambiguous | **16.7% (1 / 6)** | 1 / 6 |

### 5.2 Confusion Matrix
```
                    PREDICTED VERDICT
                 ADMIT    REJECT    MANUAL_REVIEW    Total
EXPECTED ADMIT     7        8             0           15
EXPECTED REJECT   11       28             0           39
EXPECTED REVIEW    1        0             3            4
Total             19       36             3           58
```
- **Precision (ADMIT):** $7 / 19 = 36.8\%$
- **Recall (ADMIT):** $7 / 15 = 46.7\%$
- **Precision (REJECT):** $28 / 36 = 77.8\%$
- **Recall (REJECT):** $28 / 39 = 71.8\%$
- **Precision (MANUAL_REVIEW):** $3 / 3 = 100.0\%$
- **Recall (MANUAL_REVIEW):** $3 / 4 = 75.0\%$

### 5.3 Per-Language Performance
- **Java (46 cases):** 30 / 46 correct (65.2%) | Mean Latency: 0.018 ms
- **Python (12 cases):** 8 / 12 correct (66.7%) | Mean Latency: 0.035 ms

### 5.4 Latency Distribution ($N = 58$)
- **Measurement Method:** High-resolution Node.js `perf_hooks.performance.now()`, synchronous execution.
- **Min:** 0.009 ms
- **P50 (Median):** 0.016 ms
- **Mean:** 0.021 ms
- **P95:** 0.036 ms
- **Max:** 0.250 ms

---

## 6. Comprehensive Error Taxonomy (The 20 Baseline Failures)

The 20 errors produced by the existing validator fall into three distinct failure modes:

### Failure Mode A: False Valid Rejections (8 Cases)
- **Case IDs:** `EXP-02`, `EXP-05`, `EXP-07`, `EXP-08`, `EXP-10`, `EXP-12`, `EXP-13`, `EXP-14`
- **Root Cause:** In all 8 cases, the question mentions the method name (e.g., `binarySearch`, `reverseString`, `findKthLargest`), but the code anchor quotes the specific inner calculation or loop statement rather than the method header. The `anchor_relevance` heuristic expects the method name inside the anchor string and returns `CONTRADICTED`, triggering strict conjunction rejection.

### Failure Mode B: False Unsupported Admissions (11 Cases)
- **Case IDs:** `EXP-25`, `EXP-26`, `EXP-27`, `EXP-28`, `EXP-32`, `EXP-33`, `EXP-35`, `EXP-36`, `EXP-37`, `EXP-44`, `EXP-51`
- **Root Cause:** The code anchor exists verbatim in the candidate file, but the question makes subtle semantic assertions not covered by hardcoded regex keywords:
  - `EXP-25`: Min-heap asserted on code implementing a max-heap.
  - `EXP-26`: Breadth-first search asserted on code implementing depth-first search.
  - `EXP-27`: 0-based indexing asserted on 1-based calendar code.
  - `EXP-28`: Binary search asserted on linear scan.
  - `EXP-32`–`EXP-37`: Questions referencing unanchored helper functions.
  Because no semantic claim was extracted, only `anchor_presence` was tested. The anchor was found, and the validator silently admitted the unsupported question.

### Failure Mode C: Ambiguous False Admission (1 Case)
- **Case ID:** `EXP-56`
- **Root Cause:** Question asks about default scaling parameters in `FrameworkCalculator.calculate`, which resides in an external framework class. Because the anchor `1.1 * FrameworkCalculator.calculate(val)` existed in the file and no keyword matched, it was admitted instead of routed to `MANUAL_REVIEW`.

---

## 7. Protocol and Schema for Genuinely Held-Out Evaluation

Because the 58 cases in `GROUNDING_BENCHMARK_EXPANDED.json` were used during development and rule inspection, they constitute a **development/audit dataset**. 

To prevent benchmark-specific tuning from being mistaken for generalization, a separate schema has been defined in [`heldOutGroundingSchema.json`](file:///home/labuser/Downloads/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/schemas/heldOutGroundingSchema.json).

### 7.1 Data Collection Protocol
1. **Source Candidate Code:** Sample unseen candidate solutions from Round 2 coding problems not present in the development set.
2. **Question Generation:** Use production prompts (`questionGeneratorV2.js`) to generate candidate questions.
3. **Deduplication Check:** Compute token-level Jaccard similarity against all 58 development cases. Reject any candidate pair with similarity $\ge 0.40$ to avoid paraphrases.

### 7.2 Independent Annotation Protocol
1. **Dual Independent Review:** Two senior software engineers annotate each question without viewing the validator code or development rules.
2. **Disagreement Adjudication:** Disagreements are adjudicated by a blind third annotator. Cases where consensus cannot be reached are labeled `AMBIGUOUS`.
3. **Inter-Annotator Agreement:** Requires Cohen's Kappa $\kappa \ge 0.85$ across the dataset.

### 7.3 Isolated Evaluation Execution
1. The evaluation harness must load test cases and strip everything except `inference_payload` (`source_code`, `question_text`, `code_anchor`, `language`).
2. Inference is executed strictly via `validateQuestionGroundedness`.
3. Predictions are joined with `evaluation_ground_truth` in memory only after all inferences are finalized.

### 7.4 Explicit Research-Integrity Declaration
> [!IMPORTANT]
> **No genuinely held-out dataset currently exists in the repository.** The reported 65.5% accuracy (38/58) represents the honest, unassisted performance of the existing validator on the development dataset. **No synthetic held-out score has been manufactured.**

---

## 8. Research Integrity Summary

| Category | Claim / Assertion | Status | Empirical Basis |
|---|---|---|---|
| **Supported** | Approach C reduces unsupported admissions compared with Approach A and B. | **SUPPORTED** | Blind Approach C admits 11 / 37 (29.7%), compared to 24 / 37 (64.9%) for Approach B and 37 / 37 (100.0%) for Approach A. |
| **Supported** | Label leakage was the sole cause of the previously reported 100% precision. | **SUPPORTED** | Lines 292–301 of `evidenceGroundingValidator.js` directly overrode `result.status` with `claim.expected`. Removing this override immediately exposed the 20 errors. |
| **Supported** | Heuristic rules suffer from high Type II error on valid questions. | **SUPPORTED** | Anchor relevance requires exact method name strings inside anchor snippets, falsely rejecting 53.3% (8 / 15) of valid questions. |
| **Supported** | Heuristic rules suffer from Type I error on non-keyworded semantic claims. | **SUPPORTED** | Questions asserting inverted invariants (min vs max heap, BFS vs DFS) without trigger keywords pass anchor presence checks and are admitted (29.7% false admission). |
| **Unsupported** | "Approach C achieves 0.0% unsupported admissions and 0.0% valid rejections in production." | **UNSUPPORTED / DISPROVEN** | This claim was an artifact of label leakage in the benchmark harness and does not hold under blind inference. |
| **Untested** | Performance on unseen candidate problems and languages (C++, TypeScript). | **UNTESTED** | Generalization remains untested until the held-out collection protocol is executed on independent, unseen candidates. |

---

## 9. Verification Commands

All tests have been executed and verified in the workspace:

```bash
# 1. Run Leakage-Free Baseline Suite (Adversarial Invariance + Blind Reproduction)
cd codearena/backend && node tests/leakageFreeBaseline.test.js

# 2. Run Updated Leakage-Free Expanded Benchmark Suite
cd codearena/backend && node tests/groundingExpandedBenchmark.test.js

# 3. Verify Frozen 12-Case Baseline Suite
cd codearena/backend && node tests/groundingBenchmark.test.js

# 4. Verify Full Cross-Round Linkage Suite (12 Scenarios)
cd codearena/backend && node tests/crossRoundLinkage.test.js
```
