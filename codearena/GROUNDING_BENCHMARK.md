# CODEARENA GROUNDING BENCHMARK SPECIFICATION

**Benchmark Version:** `1.0.0`  
**Target System:** CodeArena Technical Viva Question Generation Pipeline (`questionGeneratorV2.js`, `interviewController.js`)  
**Objective:** Evaluate whether CodeArena admits AI-generated interview questions or assessment claims that are not supported by the candidate's submitted source code.  
**Date:** October 2026  
**Status:** Frozen Versioned Benchmark  

---

## 1. Motivation and Vulnerability Model

CodeArena generates 5 code-anchored interview questions (Round 3 viva) based on a candidate's submitted Java solution (Round 2). The candidate is asked to explain and defend their design decisions.

### The Grounding Vulnerability
In the current production baseline, an AI model generates both the interview question and a `code_anchor` snippet intended to ground the question in the source code. Our audit identified two critical vulnerability mechanisms:

1. **Silent Fallback Anchor Rewriting:**
   When an LLM produces a question about a nonexistent method or hallucinated concept, its proposed anchor fails lexical matching. Rather than rejecting or regenerating the question, the current pipeline invokes `resolveQuestionAnchor`, which falls back through `mentioned_method_fallback`, `intent_fallback`, `topic_fallback`, and ultimately `deterministic_fallback`. This silently reassigns the question's anchor to an arbitrary unused line in the source file. The question is subsequently admitted and presented to the candidate with an anchor pointing to unrelated code.

2. **Lexical Existence Without Semantic Support:**
   Even when a code anchor matches source lines verbatim, the question text often asserts behavioral, algorithmic, or architectural claims that contradict the code or describe features that do not exist (e.g., claiming a sorting routine sorts in descending order when it sorts ascending, or claiming a method performs transactional rollback and DNS lookups when it only contains regex matching). Because validation checks only lexical presence (`findUniqueCodeAnchorRange`), all such unsupported questions are admitted.

---

## 2. Benchmark Design and Taxonomy

The benchmark contains **12 frozen, deterministic test cases** spanning 3 high-level categories:
- **VALID (3 cases):** Grounded questions whose technical claims are completely supported by the code anchor and enclosing context.
- **UNSUPPORTED (6 cases):** Questions that assert false, hallucinated, or ungrounded claims, or reference nonexistent entities.
- **AMBIGUOUS (3 cases):** Questions involving multi-method control flow, external dependencies, or non-unique duplicate anchors requiring manual adjudication or abstention.

### Taxonomy of Failure Modes

```
Question Grounding Failures
├── Nonexistent Entity (GB-03)
│   └── References classes, methods, or variables completely absent from code
├── Semantic Contradiction (GB-02)
│   └── Asserts factual properties directly opposed to runtime/AST semantics
├── Stale / Invalidated Anchor (GB-10)
│   └── References refactored or deleted code structures from earlier drafts
├── Unrelated Anchor (GB-04)
│   └── Anchor exists in code, but displays code unrelated to the question claim
├── Insufficient Anchor Evidence (GB-05)
│   └── Anchor text exists, but LLM hallucinates ungrounded features (e.g. rollbacks)
└── Partially Unsupported Conjunction (GB-12)
    └── Multiple claims in a single question where some are true and one is fabricated
```

---

## 3. The 12 Frozen Benchmark Cases

| Case ID | Name | Ground Truth Label | Expected Admission | Decomposed Claims | Primary Failure Mode |
|---|---|---|---|---|---|
| **GB-01** | Valid Question with Exact Anchor | `VALID` | `ADMIT` | 1 claim: Private field declaration with types `id`, `name`, `department`, `salary`. | None (Grounded) |
| **GB-02** | Contradicted Sort Order | `UNSUPPORTED` | `REJECT` | 2 claims: (1) Custom comparator used; (2) Comparator sorts descending. | Claim 2 contradicts `(a, b) -> a - b` (Ascending). |
| **GB-03** | Nonexistent Method | `UNSUPPORTED` | `REJECT` | 1 claim: Solution contains `applyDiscount(double)`. | Method does not exist in AST. |
| **GB-04** | Unrelated Traversal Anchor | `UNSUPPORTED` | `REJECT` | 1 claim: Anchor demonstrates `isValidCell` boundary checks. | Anchor shows outer traversal loop, not helper method. |
| **GB-05** | Real Anchor with Hallucinated Logging | `UNSUPPORTED` | `REJECT` | 2 claims: (1) Balance check exists; (2) Transactional audit rollback exists. | Claim 2 completely fabricated on plain subtraction code. |
| **GB-06** | Precondition Context Dependency | `AMBIGUOUS` | `MANUAL_REVIEW` | 2 claims: (1) Calls `binarySearch`; (2) Precondition sortedness is guaranteed. | Precondition sorting is in constructor, outside anchor. |
| **GB-07** | External Library Dependency | `AMBIGUOUS` | `MANUAL_REVIEW` | 2 claims: (1) Calls `ExternalClient`; (2) Socket timeout configured. | Unresolvable from candidate's code alone. |
| **GB-08** | Paraphrased Valid Question | `VALID` | `ADMIT` | 1 claim: Private member encapsulation. | None (Paraphrase invariance of GB-01). |
| **GB-09** | Duplicate Lexical Anchors | `AMBIGUOUS` | `REJECT` | 1 claim: Base case null check uniquely identified. | `if (node == null) return;` appears at lines 3 and 11. |
| **GB-10** | Refactored / Invalidated Anchor | `UNSUPPORTED` | `REJECT` | 1 claim: Explicit `while` loop used for pointer advance. | Candidate refactored `while` into `for` loop. |
| **GB-11** | Algorithmic Trade-off | `VALID` | `ADMIT` | 2 claims: (1) Uses `HashMap`; (2) Introduces $O(N)$ space trade-off. | None (Grounded complexity trade-off). |
| **GB-12** | Partially Unsupported Conjunction | `UNSUPPORTED` | `REJECT` | 3 claims: (1) Null check; (2) Length $\le 254$; (3) DNS MX record query. | Claim 3 (DNS query) is completely fabricated. |

---

## 4. Evaluation Protocol: Three Comparative Approaches

To establish a scientific evaluation baseline, the benchmark defines three comparative approaches:

### Approach A: Current Production Baseline
- **Mechanism:** Executes `resolveQuestionAnchors` followed by `validateQuestionSourceContracts` and `validateParsedQuestions`.
- **Characteristics:** Allows fuzzy matching and `deterministic_fallback` anchor rewriting when proposed anchors fail to match.
- **Admission Rule:** Any question that resolves to any unique line range in the file and satisfies basic question formatting is admitted (`ADMIT`).

### Approach B: Simple Validation (Strict Anchor Verification)
- **Mechanism:** Enforces strict lexical anchor verification using `findUniqueCodeAnchorRange` on the question's *original* proposed anchor without silent fallback rewriting.
- **Characteristics:** Rejects missing anchors (`status: "missing"`) and duplicate anchors (`status: "ambiguous"`).
- **Admission Rule:** Admitted if and only if the original anchor exists uniquely in the source code and complies with line range bounds.

### Approach C: Evidence-Grounded Validation (Target Architecture)
- **Mechanism:**
  1. **Claim Decomposition:** Decomposes the question into atomic, verifiable technical propositions $\{C_1, C_2, \dots, C_n\}$.
  2. **Evidence Linking:** Identifies candidate AST / token spans in the source code $\{E_1, E_2, \dots, E_m\}$.
  3. **Verification:** Classifies each claim against evidence as `SUPPORTED`, `CONTRADICTED`, or `UNRESOLVED`.
  4. **Strict Conjunction Policy:**
     $$\text{Decision} = \begin{cases} 
     \text{ADMIT} & \text{if } \forall i, C_i = \text{SUPPORTED} \\
     \text{MANUAL\_REVIEW} & \text{if } \exists i, C_i = \text{UNRESOLVED} \land \forall j \neq i, C_j \neq \text{CONTRADICTED} \\
     \text{REJECT} & \text{if } \exists i, C_i = \text{CONTRADICTED}
     \end{cases}$$

---

## 5. Formal Adjudication Rules

For ambiguous and edge-case evaluations, human adjudicators and automated evaluators must apply these four rules:

1. **Strict Claim Conjunction Rule:**
   A question containing multiple technical claims must be rejected if even *one* claim is contradicted or fabricated. Partial grounding is treated as unsupported.
2. **Anchor Self-Sufficiency Rule:**
   The displayed code anchor must contain sufficient visual context for the candidate to answer the question without hunting through hidden methods.
3. **Interprocedural Context Exception:**
   Questions probing class invariants established outside the local method (e.g., GB-06) must be labeled `AMBIGUOUS` unless the anchor is expanded to span both sites.
4. **External Dependency Abstention Rule:**
   Claims asserting properties of third-party black-box libraries (e.g., GB-07 socket timeouts) cannot be verified from student code and must produce `UNRESOLVED` / `MANUAL_REVIEW`, not `ADMIT`.
