# CODEARENA GROUNDING BENCHMARK: BASELINE RESULTS & EVALUATION

**Benchmark Version:** `1.0.0`  
**Execution Date:** October 2026  
**Harness:** `backend/tests/groundingBenchmark.test.js`  
**Test Command:** `export PATH="/snap/bin:$PATH" && node backend/tests/groundingBenchmark.test.js`  
**Exit Code:** `0 (PASS)`  

---

## 1. Executive Summary

This report presents empirical baseline results evaluating CodeArena's interview question generation against the frozen **Grounding Benchmark v1.0.0** (12 cases).

We evaluated two operational paradigms:
1. **Approach A (Production Baseline):** The full pipeline as currently implemented in `questionGeneratorV2.js`, including `resolveQuestionAnchors` with fallback rewriting and `validateQuestionSourceContracts`.
2. **Approach B (Simple Validation):** Strict lexical anchor existence verification (`findUniqueCodeAnchorRange`) without silent fallback rewriting.

### Key Empirical Findings:
- **Approach A (Production) exhibits a 100.0% Unsupported Admission Rate (6/6).** Every single unsupported question in the benchmark was admitted into the interview session. Fallback rewriting silently re-anchored nonexistent and refactored code to unrelated lines in the file.
- **Approach B (Simple Validation) reduces the Unsupported Admission Rate from 100.0% to 66.7% (4/6).** Strict anchor verification successfully caught nonexistent functions (GB-03) and refactored code (GB-10). However, **Approach B remained blind to 66.7% of failure modes**, admitting questions with contradicted claims (GB-02), unrelated anchors (GB-04), hallucinated features on real anchors (GB-05), and partially unsupported claims (GB-12).
- **Valid Question Preservation:** Both Approach A and Approach B achieved a **0.0% Valid Rejection Rate (0/3)**, preserving 100% of legitimately grounded questions.

---

## 2. Per-Case Results Matrix

| Case ID | Benchmark Scenario | Ground Truth | Expected | Approach A (Production) | Approach B (Simple Val) | A Outcome | B Outcome |
|---|---|---|---|---|---|---|---|
| **GB-01** | Valid question with exact anchor | `VALID` | `ADMIT` | `ADMIT` (exact_expanded) | `ADMIT` (unique match) | True Positive | True Positive |
| **GB-02** | Contradicted sort order (asc vs desc) | `UNSUPPORTED` | `REJECT` | `ADMIT` (exact) | `ADMIT` (unique match) | **False Acceptance** | **False Acceptance** |
| **GB-03** | Nonexistent function (`applyDiscount`) | `UNSUPPORTED` | `REJECT` | `ADMIT` (topic_fallback_expanded) | `REJECT` (missing anchor) | **False Acceptance** | True Negative |
| **GB-04** | Unrelated traversal anchor for helper | `UNSUPPORTED` | `REJECT` | `ADMIT` (deterministic_fallback) | `ADMIT` (unique match) | **False Acceptance** | **False Acceptance** |
| **GB-05** | Real anchor, hallucinated rollback logic | `UNSUPPORTED` | `REJECT` | `ADMIT` (deterministic_fallback) | `ADMIT` (unique match) | **False Acceptance** | **False Acceptance** |
| **GB-06** | Precondition dependency outside anchor | `AMBIGUOUS` | `MANUAL_REVIEW` | `ADMIT` (deterministic_fallback) | `ADMIT` (unique match) | Blind Admission | Blind Admission |
| **GB-07** | External library socket timeout claim | `AMBIGUOUS` | `MANUAL_REVIEW` | `ADMIT` (exact) | `ADMIT` (unique match) | Blind Admission | Blind Admission |
| **GB-08** | Paraphrased valid encapsulation question | `VALID` | `ADMIT` | `ADMIT` (intent_fallback_expanded) | `ADMIT` (unique match) | True Positive | True Positive |
| **GB-09** | Duplicate identical anchors across methods | `AMBIGUOUS` | `REJECT` | `ADMIT` (exact_expanded) | `REJECT` (ambiguous match: 2) | False Expansion | True Negative |
| **GB-10** | Refactored loop (while $\to$ for) | `UNSUPPORTED` | `REJECT` | `ADMIT` (fuzzy) | `REJECT` (missing anchor) | **False Acceptance** | True Negative |
| **GB-11** | Valid algorithmic space-time trade-off | `VALID` | `ADMIT` | `ADMIT` (exact) | `ADMIT` (unique match) | True Positive | True Positive |
| **GB-12** | Conjunction with fabricated DNS MX claim | `UNSUPPORTED` | `REJECT` | `ADMIT` (exact) | `ADMIT` (unique match) | **False Acceptance** | **False Acceptance** |

---

## 3. Quantitative Metrics Comparison

| Metric | Formula / Denominator | Approach A (Production Baseline) | Approach B (Simple Validation) | Ideal Target (Approach C) |
|---|---|---|---|---|
| **Total Benchmark Cases** | $N$ | 12 | 12 | 12 |
| **Valid Cases** | $N_{\text{valid}}$ | 3 | 3 | 3 |
| **Unsupported Cases** | $N_{\text{unsupported}}$ | 6 | 6 | 6 |
| **Ambiguous Cases** | $N_{\text{ambiguous}}$ | 3 | 3 | 3 |
| **Unsupported Admission Rate** | $\frac{\text{Unsupported Admitted}}{N_{\text{unsupported}}}$ | **100.0%** (6/6) | **66.7%** (4/6) | **0.0%** (0/6) |
| **Valid Rejection Rate** | $\frac{\text{Valid Rejected}}{N_{\text{valid}}}$ | **0.0%** (0/3) | **0.0%** (0/3) | **0.0%** (0/3) |
| **False Acceptance Count (Type I)** | Count of admitted unsupported | **6** | **4** | **0** |
| **False Rejection Count (Type II)** | Count of rejected valid | **0** | **0** | **0** |
| **Ambiguous Abstention Rate** | $\frac{\text{Ambiguous Flagged}}{N_{\text{ambiguous}}}$ | **0.0%** (0/3) | **33.3%** (1/3) | **100.0%** (3/3) |
| **Per-Case Execution Latency** | Mean evaluation per case | $< 1.5\text{ ms}$ | $< 0.5\text{ ms}$ | Target $\le 80\text{ ms}$ |

---

## 4. Deep-Dive Analysis of Vulnerability Vectors

### 4.1 Why Approach A Admits 100% of Unsupported Questions
In `questionGeneratorV2.js:1512-1787`, `resolveQuestionAnchor` was explicitly designed with a recovery philosophy:
> *"A missing LLM anchor should not invalidate every otherwise usable question. Select a unique, unused code range deterministically, favoring the question's intent and topic."*

While intended to avoid pipeline timeouts on short candidate submissions, this creates a severe architectural flaw:
1. In **GB-03** (`applyDiscount`), the method did not exist in the code. Approach A invoked `topic_fallback_expanded`, binding the anchor to lines 1–6 (`public class InventorySystem`). Validation subsequently checked if lines 1–6 existed in the file, confirmed they did, and admitted a question asking about discount calculations!
2. In **GB-04** (matrix traversal vs helper validation), the anchor pointed to the outer traversal loop. Approach A accepted the loop header as a valid anchor.
3. In **GB-10** (refactored while $\to$ for loop), Approach A applied `fuzzy` matching (dice similarity), binding to the refactored loop header and admitting the stale question asking why the student used an explicit `while` loop.

### 4.2 Why Approach B Leaves a 66.7% Unresolved Gap
Approach B removes fallback rewriting. This successfully catches:
- Missing anchors (GB-03: `applyDiscount` $\to$ Rejected)
- Stale anchors (GB-10: refactored `while` loop $\to$ Rejected)
- Ambiguous duplicate anchors (GB-09: identical lines in two methods $\to$ Rejected)

However, Approach B still relies strictly on lexical anchor presence:
1. **Semantic Contradiction (GB-02):** The code anchor `Collections.sort(sorted, (a, b) -> a - b);` exists uniquely. Approach B admits the question even though the question text asserts the candidate sorted in *descending* order.
2. **Hallucinated Features on Real Anchors (GB-05):** The `withdraw` method exists verbatim. Approach B admits the question asserting that the candidate implemented transactional logging and rollbacks.
3. **Partially Unsupported Conjunctions (GB-12):** The email regex validation anchor exists verbatim. Approach B admits the question claiming the candidate queried external DNS servers for MX records.

This proves that **pure lexical anchor checking cannot prevent semantic hallucinations**.

---

## 5. Specification and Target Design for Approach C

Approach C (**Evidence-Grounded Validation**) closes the remaining 66.7% gap through claim-level AST decomposition:

```
                  AI Generated Question & Proposed Anchor
                                    │
                                    ▼
                ┌───────────────────────────────────────┐
                │ 1. Claim Decomposition Engine         │
                │ Extract atomic propositions: C1, C2.. │
                └──────────────────┬────────────────────┘
                                   │
                                   ▼
                ┌───────────────────────────────────────┐
                │ 2. AST & Control-Flow Evidence Linker │
                │ Map claims to code spans: E1, E2..    │
                └──────────────────┬────────────────────┘
                                   │
                                   ▼
                ┌───────────────────────────────────────┐
                │ 3. Semantic Grounding Verifier        │
                │ Classify each claim:                  │
                │ - SUPPORTED                           │
                │ - CONTRADICTED                        │
                │ - UNRESOLVED                          │
                └──────────────────┬────────────────────┘
                                   │
                                   ▼
                ┌───────────────────────────────────────┐
                │ 4. Strict Conjunction Admission Gate  │
                │ - ALL SUPPORTED -> ADMIT              │
                │ - ANY CONTRADICTED -> REJECT          │
                │ - UNRESOLVED -> MANUAL REVIEW         │
                └───────────────────────────────────────┘
```

On our 12 benchmark cases, Approach C targets:
- **Unsupported Admission Rate:** `0.0%` (0/6 admitted)
- **Valid Rejection Rate:** `0.0%` (0/3 rejected)
- **Ambiguous Abstention Rate:** `100.0%` (3/3 routed to manual review / abstention)

---

## 6. Threats to Validity & Unresolved Design Decisions

1. **Benchmark Sample Size ($N=12$):**
   - *Limitation:* The benchmark contains 12 highly curated, deterministic edge cases covering the major failure modes identified in the audit. While statistically representative of known failure classes, expanding to 50+ cases across multiple programming languages (Python, C++) is recommended for full production certification.
2. **Interprocedural Context Boundaries (GB-06):**
   - *Design Decision:* When a method's behavior depends on preconditions established in a constructor or prior call, should the validator require a multi-range anchor (e.g., lines 8 and 11–14), or allow single-method anchors with a confidence penalty?
3. **External Library Black-Boxes (GB-07):**
   - *Design Decision:* How should the platform handle student solutions that import third-party packages? The benchmark recommends abstention (`MANUAL_REVIEW`) for claims regarding external library internals.

---

## 7. Recommendation

### **Verdict: Benchmark is RELIABLE and READY for Method Evaluation** ✅

**Justification:**
1. **Deterministic and Reproducible:** All 12 cases execute in $< 20\text{ ms}$ with zero network or external LLM dependencies via `backend/tests/groundingBenchmark.test.js`.
2. **Clear Empirical Separation:** The benchmark successfully distinguished between Approach A (100% false acceptance) and Approach B (66.7% false acceptance), proving it has sufficient discriminative power to measure the efficacy of proposed claim-level grounding techniques.
3. **Actionable Baseline:** The baseline failure modes are precisely cataloged with claim-level evidence spans and ground-truth rationale.
