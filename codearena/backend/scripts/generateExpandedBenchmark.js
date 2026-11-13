"use strict";

const fs = require("fs");
const path = require("path");

const cases = [
  // =========================================================================
  // CATEGORY 1: GROUNDED VALID QUESTIONS (15 Cases: EXP-01 to EXP-15)
  // =========================================================================
  {
    id: "EXP-01",
    name: "Valid question with exact anchor: Encapsulation private fields",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class Employee {
    private int id;
    private String name;
    private String department;
    private double salary;

    public Employee(int id, String name, String department, double salary) {
        this.id = id;
        this.name = name;
        this.department = department;
        this.salary = salary;
    }

    public double getSalary() {
        return salary;
    }
}`,
    generated_question: {
      qid: "Q01",
      dimension: "Class / Object / Constructor",
      difficulty: "Basic",
      question: "Looking at your Employee class fields, what access modifiers and data types did you choose for id, name, department, and salary, and why?",
      code_anchor: "    private int id;\n    private String name;\n    private String department;\n    private double salary;",
      code_line_start: 2,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "Fields use private access modifiers for encapsulation with types int, String, and double.",
      answer_criteria: [
        { point: "Identifies private access modifiers for encapsulation", marks: 3 },
        { point: "Explains types int, String, double", marks: 2 }
      ],
      scoring_guide: { full: "Full explanation", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Encapsulation"
    },
    decomposed_claims: [
      { claim_id: "EXP01-C1", text: "Candidate declared private fields id, name, department, salary.", evidence_type: "code_declaration", expected_classification: "SUPPORTED" }
    ],
    rationale: "Fields exist verbatim in anchor."
  },
  {
    id: "EXP-02",
    name: "Valid question with exact anchor: Binary search midpoint calculation",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class Searcher {
    public int binarySearch(int[] arr, int target) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] == target) return mid;
            else if (arr[mid] < target) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }
}`,
    generated_question: {
      qid: "Q02",
      dimension: "Control Structures / Loops",
      difficulty: "Intermediate",
      question: "In your binarySearch method, why did you calculate the midpoint using low + (high - low) / 2 instead of (low + high) / 2?",
      code_anchor: "            int mid = low + (high - low) / 2;\n            if (arr[mid] == target) return mid;",
      code_line_start: 5,
      code_line_end: 6,
      source: "submitted_code_llm",
      rubric: "Using low + (high - low) / 2 prevents potential integer overflow when low and high are large.",
      answer_criteria: [
        { point: "Identifies integer overflow prevention", marks: 3 },
        { point: "Contrasts with standard addition", marks: 2 }
      ],
      scoring_guide: { full: "Full explanation", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Integer overflow avoidance"
    },
    decomposed_claims: [
      { claim_id: "EXP02-C1", text: "Candidate calculates mid using low + (high - low) / 2.", evidence_type: "code_arithmetic", expected_classification: "SUPPORTED" }
    ],
    rationale: "Anchor shows exact formula."
  },
  {
    id: "EXP-03",
    name: "Valid question with exact anchor: HashMap frequency counting",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `import java.util.*;

public class WordFrequency {
    public Map<String, Integer> countWords(String[] words) {
        Map<String, Integer> freq = new HashMap<>();
        for (String w : words) {
            freq.put(w, freq.getOrDefault(w, 0) + 1);
        }
        return freq;
    }
}`,
    generated_question: {
      qid: "Q03",
      dimension: "Array / ArrayList",
      difficulty: "Basic",
      question: "How does getOrDefault(w, 0) simplify your frequency counting loop in the countWords method?",
      code_anchor: "        for (String w : words) {\n            freq.put(w, freq.getOrDefault(w, 0) + 1);\n        }",
      code_line_start: 6,
      code_line_end: 8,
      source: "submitted_code_llm",
      rubric: "getOrDefault avoids explicit null/containsKey checks by returning 0 for unseen words.",
      answer_criteria: [
        { point: "Explains default value avoids null checks", marks: 3 },
        { point: "Describes map update logic", marks: 2 }
      ],
      scoring_guide: { full: "Full explanation", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Map API usage"
    },
    decomposed_claims: [
      { claim_id: "EXP03-C1", text: "Candidate uses freq.getOrDefault(w, 0) in loop.", evidence_type: "code_invocation", expected_classification: "SUPPORTED" }
    ],
    rationale: "Anchor matches loop and method call exactly."
  },
  {
    id: "EXP-04",
    name: "Valid question with exact anchor: Tree traversal null base case",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class TreeMaxDepth {
    public int maxDepth(TreeNode root) {
        if (root == null) {
            return 0;
        }
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`,
    generated_question: {
      qid: "Q04",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "Why does your maxDepth method return 0 when root is null as the base case?",
      code_anchor: "        if (root == null) {\n            return 0;\n        }",
      code_line_start: 3,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "A null node has height 0, terminating recursion.",
      answer_criteria: [
        { point: "Identifies null base case height", marks: 3 },
        { point: "Explains recursion termination", marks: 2 }
      ],
      scoring_guide: { full: "Full explanation", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Recursion base case"
    },
    decomposed_claims: [
      { claim_id: "EXP04-C1", text: "Candidate returns 0 when root == null.", evidence_type: "code_condition", expected_classification: "SUPPORTED" }
    ],
    rationale: "Anchor is exact."
  },
  {
    id: "EXP-05",
    name: "Valid question with exact anchor: 1D Dynamic Programming tabulation",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class ClimbingStairs {
    public int climbStairs(int n) {
        if (n <= 2) return n;
        int[] dp = new int[n + 1];
        dp[1] = 1;
        dp[2] = 2;
        for (int i = 3; i <= n; i++) {
            dp[i] = dp[i - 1] + dp[i - 2];
        }
        return dp[n];
    }
}`,
    generated_question: {
      qid: "Q05",
      dimension: "Control Structures / Loops",
      difficulty: "Intermediate",
      question: "In your climbStairs method, what does dp[i] represent, and why did you size the array to n + 1?",
      code_anchor: "        int[] dp = new int[n + 1];\n        dp[1] = 1;\n        dp[2] = 2;",
      code_line_start: 4,
      code_line_end: 6,
      source: "submitted_code_llm",
      rubric: "dp[i] represents distinct ways to reach step i, and n + 1 allows 1-based direct indexing up to n.",
      answer_criteria: [
        { point: "Defines dp[i] state representation", marks: 3 },
        { point: "Explains 1-based indexing allocation", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "DP array indexing"
    },
    decomposed_claims: [
      { claim_id: "EXP05-C1", text: "Candidate allocates dp array of size n + 1 with base states.", evidence_type: "code_allocation", expected_classification: "SUPPORTED" }
    ],
    rationale: "Array size n + 1 matches anchor."
  },
  {
    id: "EXP-06",
    name: "Valid question with exact anchor: Sliding window boundary adjustment",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class SubarraySum {
    public int minSubArrayLen(int target, int[] nums) {
        int left = 0, sum = 0, minLen = Integer.MAX_VALUE;
        for (int right = 0; right < nums.length; right++) {
            sum += nums[right];
            while (sum >= target) {
                minLen = Math.min(minLen, right - left + 1);
                sum -= nums[left++];
            }
        }
        return minLen == Integer.MAX_VALUE ? 0 : minLen;
    }
}`,
    generated_question: {
      qid: "Q06",
      dimension: "Control Structures / Loops",
      difficulty: "Advanced",
      question: "How does contracting the window with sum -= nums[left++] inside the while loop maintain correctness?",
      code_anchor: "            while (sum >= target) {\n                minLen = Math.min(minLen, right - left + 1);\n                sum -= nums[left++];\n            }",
      code_line_start: 6,
      code_line_end: 9,
      source: "submitted_code_llm",
      rubric: "Contracting left advances the window to seek the minimal qualifying subarray length while maintaining sum.",
      answer_criteria: [
        { point: "Explains window shrinkage", marks: 3 },
        { point: "Identifies minimal length check", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Sliding window"
    },
    decomposed_claims: [
      { claim_id: "EXP06-C1", text: "Candidate shrinks window while sum >= target.", evidence_type: "code_loop", expected_classification: "SUPPORTED" }
    ],
    rationale: "Anchor matches while loop and index advance."
  },
  {
    id: "EXP-07",
    name: "Valid question with exact anchor: Stack balanced parentheses",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `import java.util.*;

public class ParenthesesValidator {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '{') stack.push('}');
            else if (c == '[') stack.push(']');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }
}`,
    generated_question: {
      qid: "Q07",
      dimension: "Array / ArrayList",
      difficulty: "Intermediate",
      question: "In your isValid method, why do you push the expected closing bracket onto the stack instead of the opening bracket?",
      code_anchor: "            if (c == '(') stack.push(')');\n            else if (c == '{') stack.push('}');\n            else if (c == '[') stack.push(']');",
      code_line_start: 6,
      code_line_end: 8,
      source: "submitted_code_llm",
      rubric: "Pushing closing brackets simplifies matching: encountering a closing bracket only requires checking stack.pop() == c.",
      answer_criteria: [
        { point: "Identifies simplification of pop comparison", marks: 3 },
        { point: "Explains stack mapping", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Stack pattern"
    },
    decomposed_claims: [
      { claim_id: "EXP07-C1", text: "Candidate pushes closing brackets when encountering opening brackets.", evidence_type: "code_push", expected_classification: "SUPPORTED" }
    ],
    rationale: "Anchor shows push(')'), push('}'), push(']')."
  },
  {
    id: "EXP-08",
    name: "Valid question with exact anchor: Interface implementation",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `interface Shape {
    double calculateArea();
}

public class Circle implements Shape {
    private double radius;

    public Circle(double radius) {
        this.radius = radius;
    }

    @Override
    public double calculateArea() {
        return Math.PI * radius * radius;
    }
}`,
    generated_question: {
      qid: "Q08",
      dimension: "Class / Object / Constructor",
      difficulty: "Basic",
      question: "How does implementing Shape and overriding calculateArea support polymorphism in your Circle class?",
      code_anchor: "    @Override\n    public double calculateArea() {\n        return Math.PI * radius * radius;\n    }",
      code_line_start: 12,
      code_line_end: 15,
      source: "submitted_code_llm",
      rubric: "Circle implements Shape contract, allowing generic Shape references to invoke calculateArea polymorphically.",
      answer_criteria: [
        { point: "Explains interface contract and @Override", marks: 3 },
        { point: "Mentions polymorphic invocation", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Polymorphism"
    },
    decomposed_claims: [
      { claim_id: "EXP08-C1", text: "Circle overrides calculateArea() returning Math.PI * radius * radius.", evidence_type: "code_method", expected_classification: "SUPPORTED" }
    ],
    rationale: "Method and override exist in anchor."
  },
  {
    id: "EXP-09",
    name: "Valid question with exact anchor: Custom argument validation exception",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class BankTransfer {
    public void transfer(double amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Transfer amount must be strictly positive");
        }
    }
}`,
    generated_question: {
      qid: "Q09",
      dimension: "Exception Handling / Runtime Safety",
      difficulty: "Basic",
      question: "Why did you choose IllegalArgumentException when amount <= 0 instead of returning a boolean error flag?",
      code_anchor: "        if (amount <= 0) {\n            throw new IllegalArgumentException(\"Transfer amount must be strictly positive\");\n        }",
      code_line_start: 3,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "Throwing an exception signals invalid caller arguments immediately and prevents silent failure.",
      answer_criteria: [
        { point: "Explains fail-fast exception design", marks: 3 },
        { point: "Addresses caller error handling", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Exception design"
    },
    decomposed_claims: [
      { claim_id: "EXP09-C1", text: "Candidate throws IllegalArgumentException on non-positive amount.", evidence_type: "code_throw", expected_classification: "SUPPORTED" }
    ],
    rationale: "Throw statement exists in anchor."
  },
  {
    id: "EXP-10",
    name: "Valid question with exact anchor: StringBuilder efficiency in loop",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class CsvFormatter {
    public String buildRow(String[] values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            sb.append(values[i]);
            if (i < values.length - 1) sb.append(",");
        }
        return sb.toString();
    }
}`,
    generated_question: {
      qid: "Q10",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "Why did you use StringBuilder instead of String concatenation (+) inside the buildRow loop?",
      code_anchor: "        StringBuilder sb = new StringBuilder();\n        for (int i = 0; i < values.length; i++) {",
      code_line_start: 3,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "StringBuilder avoids creating immutable intermediate String objects in O(N^2) time.",
      answer_criteria: [
        { point: "Identifies String immutability overhead", marks: 3 },
        { point: "Contrasts StringBuilder mutable buffer", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "StringBuilder memory"
    },
    decomposed_claims: [
      { claim_id: "EXP10-C1", text: "Candidate instantiates StringBuilder before loop.", evidence_type: "code_instantiation", expected_classification: "SUPPORTED" }
    ],
    rationale: "StringBuilder instantiation matches anchor."
  },
  {
    id: "EXP-11",
    name: "Valid question with exact anchor: Matrix DFS connected components",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `public class IslandCounter {
    public int numIslands(char[][] grid) {
        int count = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[0].length; c++) {
                if (grid[r][c] == '1') {
                    count++;
                    dfs(grid, r, c);
                }
            }
        }
        return count;
    }

    private void dfs(char[][] grid, int r, int c) {
        if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length || grid[r][c] != '1') return;
        grid[r][c] = '0';
        dfs(grid, r + 1, c);
        dfs(grid, r - 1, c);
        dfs(grid, r, c + 1);
        dfs(grid, r, c - 1);
    }
}`,
    generated_question: {
      qid: "Q11",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "In your dfs method, why do you set grid[r][c] = '0' before recursing to neighboring cells?",
      code_anchor: "        grid[r][c] = '0';\n        dfs(grid, r + 1, c);\n        dfs(grid, r - 1, c);",
      code_line_start: 16,
      code_line_end: 18,
      source: "submitted_code_llm",
      rubric: "Mutating '1' to '0' acts as an in-place visited marker, avoiding infinite recursion.",
      answer_criteria: [
        { point: "Explains in-place visited marking", marks: 3 },
        { point: "Identifies avoidance of cycles/recursion", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "In-place visited marking"
    },
    decomposed_claims: [
      { claim_id: "EXP11-C1", text: "Candidate marks cell grid[r][c] = '0' before recursive calls.", evidence_type: "code_assignment", expected_classification: "SUPPORTED" }
    ],
    rationale: "Anchor shows in-place mutation."
  },
  {
    id: "EXP-12",
    name: "Valid question with exact anchor: Min-heap Top-K elements",
    category: "Grounded Valid",
    language: "java",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `import java.util.*;

public class TopKElements {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> minHeap = new PriorityQueue<>();
        for (int n : nums) {
            minHeap.offer(n);
            if (minHeap.size() > k) {
                minHeap.poll();
            }
        }
        return minHeap.peek();
    }
}`,
    generated_question: {
      qid: "Q12",
      dimension: "Array / ArrayList",
      difficulty: "Advanced",
      question: "Why does maintaining a PriorityQueue of size k allow findKthLargest to operate in O(N log K) time?",
      code_anchor: "            minHeap.offer(n);\n            if (minHeap.size() > k) {\n                minHeap.poll();\n            }",
      code_line_start: 7,
      code_line_end: 10,
      source: "submitted_code_llm",
      rubric: "Capping heap size to k bounds insertion/removal cost to O(log k), producing O(N log k) overall time.",
      answer_criteria: [
        { point: "Explains heap size k bounds log k operations", marks: 3 },
        { point: "Relates to overall O(N log K) time", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Heap bound complexity"
    },
    decomposed_claims: [
      { claim_id: "EXP12-C1", text: "Candidate offers elements and polls when minHeap.size() > k.", evidence_type: "code_heap", expected_classification: "SUPPORTED" }
    ],
    rationale: "Heap capping logic in anchor."
  },
  {
    id: "EXP-13",
    name: "Valid question with exact anchor (Python): List comprehension filter",
    category: "Grounded Valid",
    language: "python",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `class UserFilter:
    def get_active_users(self, users):
        return [u["name"] for u in users if u.get("is_active", False)]
`,
    generated_question: {
      qid: "Q13",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "In your get_active_users method, how does the list comprehension filter active users?",
      code_anchor: "        return [u[\"name\"] for u in users if u.get(\"is_active\", False)]",
      code_line_start: 3,
      code_line_end: 3,
      source: "submitted_code_llm",
      rubric: "The list comprehension evaluates u.get('is_active', False) for each dict and collects names of active users.",
      answer_criteria: [
        { point: "Explains comprehension filter clause", marks: 3 },
        { point: "Describes dictionary key extraction", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "List comprehension"
    },
    decomposed_claims: [
      { claim_id: "EXP13-C1", text: "Candidate filters users using list comprehension with if u.get('is_active', False).", evidence_type: "code_comprehension", expected_classification: "SUPPORTED" }
    ],
    rationale: "Python list comprehension exists in anchor."
  },
  {
    id: "EXP-14",
    name: "Valid question with exact anchor (Python): __init__ encapsulation",
    category: "Grounded Valid",
    language: "python",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `class Rectangle:
    def __init__(self, width: float, height: float):
        self._width = width
        self._height = height

    def area(self) -> float:
        return self._width * self._height
`,
    generated_question: {
      qid: "Q14",
      dimension: "Class / Object / Constructor",
      difficulty: "Basic",
      question: "In your Rectangle class, why did you prefix _width and _height with an underscore in __init__?",
      code_anchor: "    def __init__(self, width: float, height: float):\n        self._width = width\n        self._height = height",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "The single leading underscore indicates non-public convention for internal state in Python.",
      answer_criteria: [
        { point: "Explains Python private/internal convention", marks: 3 },
        { point: "Addresses encapsulation in constructor", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Python encapsulation"
    },
    decomposed_claims: [
      { claim_id: "EXP14-C1", text: "Candidate assigns self._width and self._height in __init__.", evidence_type: "code_declaration", expected_classification: "SUPPORTED" }
    ],
    rationale: "Python __init__ matches anchor."
  },
  {
    id: "EXP-15",
    name: "Valid question with exact anchor (Python): Generator yield memory efficiency",
    category: "Grounded Valid",
    language: "python",
    ground_truth_label: "VALID",
    sub_type: "VALID_EXACT_ANCHOR",
    expected_admission: "ADMIT",
    source_code: `def batch_streamer(records, batch_size):
    for i in range(0, len(records), batch_size):
        yield records[i:i + batch_size]
`,
    generated_question: {
      qid: "Q15",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "Why did you use yield inside batch_streamer instead of creating a list of all batches and returning it?",
      code_anchor: "    for i in range(0, len(records), batch_size):\n        yield records[i:i + batch_size]",
      code_line_start: 2,
      code_line_end: 3,
      source: "submitted_code_llm",
      rubric: "yield produces a generator that evaluates lazily in O(1) memory instead of holding all batches in memory.",
      answer_criteria: [
        { point: "Identifies lazy generator evaluation", marks: 3 },
        { point: "Explains memory efficiency vs list", marks: 2 }
      ],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Generator yield"
    },
    decomposed_claims: [
      { claim_id: "EXP15-C1", text: "Candidate yields slices of records in a range loop.", evidence_type: "code_generator", expected_classification: "SUPPORTED" }
    ],
    rationale: "Python generator loop matches anchor."
  },

  // =========================================================================
  // CATEGORY 2: NONEXISTENT ENTITIES (8 Cases: EXP-16 to EXP-23)
  // =========================================================================
  {
    id: "EXP-16",
    name: "Nonexistent method: applyDiscount",
    category: "Nonexistent Entity",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_FUNCTION",
    expected_admission: "REJECT",
    source_code: `public class Product {
    private double price;
    public Product(double p) { this.price = p; }
    public double getPrice() { return price; }
}`,
    generated_question: {
      qid: "Q16",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "In your applyDiscount(double percentage) method, how do you prevent prices from dropping below zero?",
      code_anchor: "    public void applyDiscount(double percentage) {\n        price -= price * (percentage / 100.0);\n    }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Validates percentage lower bounds.",
      answer_criteria: [{ point: "Checks bounds", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Discount logic"
    },
    decomposed_claims: [
      { claim_id: "EXP16-C1", text: "Solution contains applyDiscount method.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "applyDiscount does not exist."
  },
  {
    id: "EXP-17",
    name: "Nonexistent method: calculateTaxes",
    category: "Nonexistent Entity",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_FUNCTION",
    expected_admission: "REJECT",
    source_code: `public class Payroll {
    private double grossSalary;
    public Payroll(double salary) { this.grossSalary = salary; }
    public double getGross() { return grossSalary; }
}`,
    generated_question: {
      qid: "Q17",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "How does your calculateTaxes() method determine the applicable tax bracket?",
      code_anchor: "    public double calculateTaxes() {\n        return grossSalary * 0.25;\n    }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Explains bracket matching.",
      answer_criteria: [{ point: "Tax bracket logic", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Tax logic"
    },
    decomposed_claims: [
      { claim_id: "EXP17-C1", text: "Solution contains calculateTaxes method.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "calculateTaxes does not exist."
  },
  {
    id: "EXP-18",
    name: "Nonexistent variable: userSessionToken",
    category: "Nonexistent Entity",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_VARIABLE",
    expected_admission: "REJECT",
    source_code: `public class AuthController {
    public boolean login(String username, String password) {
        return "admin".equals(username) && "secret".equals(password);
    }
}`,
    generated_question: {
      qid: "Q18",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "Where do you store and refresh the userSessionToken after login succeeds?",
      code_anchor: "    String userSessionToken = UUID.randomUUID().toString();",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Session token lifecycle.",
      answer_criteria: [{ point: "Token storage", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Session token"
    },
    decomposed_claims: [
      { claim_id: "EXP18-C1", text: "Solution declares userSessionToken variable.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "userSessionToken does not exist in code."
  },
  {
    id: "EXP-19",
    name: "Nonexistent class: AuditLogger",
    category: "Nonexistent Entity",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_CLASS",
    expected_admission: "REJECT",
    source_code: `public class SimpleService {
    public void execute() {
        System.out.println("Processing");
    }
}`,
    generated_question: {
      qid: "Q19",
      dimension: "Class / Object / Constructor",
      difficulty: "Intermediate",
      question: "Why did you define a separate AuditLogger class to monitor the execute method?",
      code_anchor: "    AuditLogger.log(\"Execution started\");",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Audit logger design.",
      answer_criteria: [{ point: "Audit logging", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Audit logger"
    },
    decomposed_claims: [
      { claim_id: "EXP19-C1", text: "Solution defines AuditLogger class.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "AuditLogger is completely hallucinated."
  },
  {
    id: "EXP-20",
    name: "Nonexistent method: sanitizeInput",
    category: "Nonexistent Entity",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_FUNCTION",
    expected_admission: "REJECT",
    source_code: `public class Parser {
    public int parse(String s) {
        return Integer.parseInt(s);
    }
}`,
    generated_question: {
      qid: "Q20",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "In your sanitizeInput helper, what characters do you strip out before parsing?",
      code_anchor: "    private String sanitizeInput(String s) {\n        return s.trim();\n    }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Sanitization rules.",
      answer_criteria: [{ point: "Input sanitization", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Sanitization"
    },
    decomposed_claims: [
      { claim_id: "EXP20-C1", text: "Solution contains sanitizeInput method.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "sanitizeInput does not exist."
  },
  {
    id: "EXP-21",
    name: "Nonexistent method: exportToCsv",
    category: "Nonexistent Entity",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_FUNCTION",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class ReportManager {
    private List<String> lines = new ArrayList<>();
    public void add(String l) { lines.add(l); }
}`,
    generated_question: {
      qid: "Q21",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "How does exportToCsv format headers when writing report data?",
      code_anchor: "    public void exportToCsv(String path) {\n        // write file\n    }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "CSV export headers.",
      answer_criteria: [{ point: "CSV formatting", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Export logic"
    },
    decomposed_claims: [
      { claim_id: "EXP21-C1", text: "Solution contains exportToCsv method.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "exportToCsv does not exist."
  },
  {
    id: "EXP-22",
    name: "Nonexistent function (Python): validate_token",
    category: "Nonexistent Entity",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_FUNCTION",
    expected_admission: "REJECT",
    source_code: `def login(user, pwd):
    return user == "admin" and pwd == "pass"
`,
    generated_question: {
      qid: "Q22",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "In your validate_token function, what cryptographic algorithm verifies the payload signature?",
      code_anchor: "def validate_token(tok):\n    return tok == 'secret'",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Token verification.",
      answer_criteria: [{ point: "Token signature", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Token validation"
    },
    decomposed_claims: [
      { claim_id: "EXP22-C1", text: "Python solution contains validate_token function.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "validate_token does not exist in Python code."
  },
  {
    id: "EXP-23",
    name: "Nonexistent invocation (Python): asyncio.sleep in sync function",
    category: "Nonexistent Entity",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "NONEXISTENT_FUNCTION",
    expected_admission: "REJECT",
    source_code: `import time

def fetch_data():
    time.sleep(1)
    return {"status": "ok"}
`,
    generated_question: {
      qid: "Q23",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "Why did you call asyncio.sleep inside fetch_data rather than blocking the main thread?",
      code_anchor: "    await asyncio.sleep(1)",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Asynchronous sleep.",
      answer_criteria: [{ point: "Asyncio sleep", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Asyncio sleep"
    },
    decomposed_claims: [
      { claim_id: "EXP23-C1", text: "Candidate invokes asyncio.sleep.", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code uses time.sleep, not asyncio.sleep."
  },

  // =========================================================================
  // CATEGORY 3: SEMANTIC CONTRADICTIONS (8 Cases: EXP-24 to EXP-31)
  // =========================================================================
  {
    id: "EXP-24",
    name: "Semantic contradiction: Descending sort claimed on ascending comparator",
    category: "Semantic Contradiction",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class Sorter {
    public void sortItems(List<Integer> list) {
        Collections.sort(list, (a, b) -> a - b);
    }
}`,
    generated_question: {
      qid: "Q24",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "Why did you decide to sort the list in descending order using your custom comparator?",
      code_anchor: "        Collections.sort(list, (a, b) -> a - b);",
      code_line_start: 5,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "Sorting order logic.",
      answer_criteria: [{ point: "Sort ordering", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Comparator"
    },
    decomposed_claims: [
      { claim_id: "EXP24-C1", text: "Comparator sorts in descending order.", evidence_type: "semantic_sort_order", expected_classification: "CONTRADICTED" }
    ],
    rationale: "a - b sorts ascending, not descending."
  },
  {
    id: "EXP-25",
    name: "Semantic contradiction: Min-heap claimed on reverseOrder max-heap",
    category: "Semantic Contradiction",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class HeapManager {
    public PriorityQueue<Integer> createHeap() {
        return new PriorityQueue<>(Collections.reverseOrder());
    }
}`,
    generated_question: {
      qid: "Q25",
      dimension: "Array / ArrayList",
      difficulty: "Intermediate",
      question: "How does your min-heap ensure the smallest integer remains at the head of the queue?",
      code_anchor: "        return new PriorityQueue<>(Collections.reverseOrder());",
      code_line_start: 5,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "PriorityQueue ordering.",
      answer_criteria: [{ point: "Heap ordering", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Heap ordering"
    },
    decomposed_claims: [
      { claim_id: "EXP25-C1", text: "Candidate created a min-heap keeping smallest integer at head.", evidence_type: "semantic_sort_order", expected_classification: "CONTRADICTED" }
    ],
    rationale: "reverseOrder creates a max-heap, not a min-heap."
  },
  {
    id: "EXP-26",
    name: "Semantic contradiction: BFS queue claimed on Stack DFS traversal",
    category: "Semantic Contradiction",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class GraphTraversal {
    public void traverse(int start) {
        Stack<Integer> stack = new Stack<>();
        stack.push(start);
        while (!stack.isEmpty()) {
            int curr = stack.pop();
            System.out.println(curr);
        }
    }
}`,
    generated_question: {
      qid: "Q26",
      dimension: "Control Structures / Loops",
      difficulty: "Intermediate",
      question: "How does your breadth-first search queue guarantee level-by-level exploration of graph vertices?",
      code_anchor: "        Stack<Integer> stack = new Stack<>();\n        stack.push(start);",
      code_line_start: 5,
      code_line_end: 6,
      source: "submitted_code_llm",
      rubric: "BFS traversal order.",
      answer_criteria: [{ point: "BFS queue", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "BFS vs DFS"
    },
    decomposed_claims: [
      { claim_id: "EXP26-C1", text: "Candidate implemented breadth-first search with a queue.", evidence_type: "code_datastructure", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code uses Stack for DFS, not Queue for BFS."
  },
  {
    id: "EXP-27",
    name: "Semantic contradiction: 0-indexed claimed on 1-based indexing",
    category: "Semantic Contradiction",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `public class CalendarMonth {
    public String getMonthName(int monthNumber) {
        String[] months = {"", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        return months[monthNumber];
    }
}`,
    generated_question: {
      qid: "Q27",
      dimension: "Array / ArrayList",
      difficulty: "Basic",
      question: "Why did you use standard 0-based indexing where month 0 corresponds to January?",
      code_anchor: "        String[] months = {\"\", \"Jan\", \"Feb\", \"Mar\", \"Apr\", \"May\", \"Jun\", \"Jul\", \"Aug\", \"Sep\", \"Oct\", \"Nov\", \"Dec\"};\n        return months[monthNumber];",
      code_line_start: 3,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Month indexing.",
      answer_criteria: [{ point: "Indexing", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Array indexing"
    },
    decomposed_claims: [
      { claim_id: "EXP27-C1", text: "January is accessed at index 0.", evidence_type: "code_indexing", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Array has dummy empty string at index 0; January is index 1."
  },
  {
    id: "EXP-28",
    name: "Semantic contradiction: Binary search claimed on linear scan",
    category: "Semantic Contradiction",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `public class SearchTool {
    public int find(int[] arr, int target) {
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) return i;
        }
        return -1;
    }
}`,
    generated_question: {
      qid: "Q28",
      dimension: "Control Structures / Loops",
      difficulty: "Intermediate",
      question: "How does your binary search implementation eliminate half the search space on each iteration?",
      code_anchor: "        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) return i;\n        }",
      code_line_start: 3,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "Binary search reduction.",
      answer_criteria: [{ point: "Halving search space", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Search algorithm"
    },
    decomposed_claims: [
      { claim_id: "EXP28-C1", text: "Candidate implemented binary search halving space each iteration.", evidence_type: "code_algorithm", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code is a simple linear for-loop scan."
  },
  {
    id: "EXP-29",
    name: "Semantic contradiction: Returns true on duplicate claimed on return false",
    category: "Semantic Contradiction",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class DuplicateDetector {
    public boolean hasDuplicates(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int n : nums) {
            if (!set.add(n)) return false; // returns false when duplicate found
        }
        return true;
    }
}`,
    generated_question: {
      qid: "Q29",
      dimension: "Control Structures / Loops",
      difficulty: "Basic",
      question: "In hasDuplicates, why do you return true immediately upon encountering a duplicate number?",
      code_anchor: "            if (!set.add(n)) return false;",
      code_line_start: 7,
      code_line_end: 7,
      source: "submitted_code_llm",
      rubric: "Duplicate return value.",
      answer_criteria: [{ point: "Return value", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Return logic"
    },
    decomposed_claims: [
      { claim_id: "EXP29-C1", text: "Method returns true immediately on duplicate.", evidence_type: "code_return", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code returns false, not true."
  },
  {
    id: "EXP-30",
    name: "Semantic contradiction (Python): Descending sort claimed on sorted()",
    category: "Semantic Contradiction",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `def get_sorted_numbers(nums):
    return sorted(nums)
`,
    generated_question: {
      qid: "Q30",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "Why did you choose to sort the numbers in descending order?",
      code_anchor: "    return sorted(nums)",
      code_line_start: 2,
      code_line_end: 2,
      source: "submitted_code_llm",
      rubric: "Sorting order.",
      answer_criteria: [{ point: "Sorting order", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Python sort"
    },
    decomposed_claims: [
      { claim_id: "EXP30-C1", text: "Python function sorts numbers in descending order.", evidence_type: "semantic_sort_order", expected_classification: "CONTRADICTED" }
    ],
    rationale: "sorted(nums) sorts ascending by default; reverse=True is absent."
  },
  {
    id: "EXP-31",
    name: "Semantic contradiction (Python): Mutable default claimed when default is None",
    category: "Semantic Contradiction",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "CONTRADICTED_BEHAVIOR",
    expected_admission: "REJECT",
    source_code: `def append_to_list(item, target=None):
    if target is None:
        target = []
    target.append(item)
    return target
`,
    generated_question: {
      qid: "Q31",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "Why did you use a mutable default argument target=[] in your function header?",
      code_anchor: "def append_to_list(item, target=None):\n    if target is None:\n        target = []",
      code_line_start: 1,
      code_line_end: 3,
      source: "submitted_code_llm",
      rubric: "Default arguments.",
      answer_criteria: [{ point: "Mutable defaults", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Python default arguments"
    },
    decomposed_claims: [
      { claim_id: "EXP31-C1", text: "Function uses mutable default target=[].", evidence_type: "code_header", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Default argument is None, not mutable list []."
  },

  // =========================================================================
  // CATEGORY 4: UNRELATED CODE ANCHORS (6 Cases: EXP-32 to EXP-37)
  // =========================================================================
  {
    id: "EXP-32",
    name: "Unrelated anchor: Outer loop anchor for helper boundary logic",
    category: "Unrelated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "UNRELATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class GridValidator {
    public int process(int[][] grid) {
        for (int i = 0; i < grid.length; i++) {
            for (int j = 0; j < grid[0].length; j++) {
                if (checkCell(grid, i, j)) return 1;
            }
        }
        return 0;
    }

    private boolean checkCell(int[][] grid, int r, int c) {
        return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
    }
}`,
    generated_question: {
      qid: "Q32",
      dimension: "Control Structures / Loops",
      difficulty: "Intermediate",
      question: "How does checkCell prevent ArrayIndexOutOfBoundsException when evaluating border cells?",
      code_anchor: "        for (int i = 0; i < grid.length; i++) {\n            for (int j = 0; j < grid[0].length; j++) {",
      code_line_start: 3,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Boundary checking in checkCell.",
      answer_criteria: [{ point: "Boundary checks", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Helper validation"
    },
    decomposed_claims: [
      { claim_id: "EXP32-C1", text: "Anchor demonstrates checkCell boundary logic.", evidence_type: "anchor_relevance", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor only shows outer loop, not checkCell."
  },
  {
    id: "EXP-33",
    name: "Unrelated anchor: Constructor anchor for bonus calculation question",
    category: "Unrelated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "UNRELATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class Consultant {
    private String name;
    private double rate;

    public Consultant(String name, double rate) {
        this.name = name;
        this.rate = rate;
    }

    public double calculateBonus(int hoursWorked) {
        return hoursWorked > 160 ? (hoursWorked - 160) * rate * 1.5 : 0;
    }
}`,
    generated_question: {
      qid: "Q33",
      dimension: "Class / Object / Constructor",
      difficulty: "Intermediate",
      question: "Looking at your calculateBonus method, what overtime multiplier did you apply and why?",
      code_anchor: "    public Consultant(String name, double rate) {\n        this.name = name;\n        this.rate = rate;\n    }",
      code_line_start: 5,
      code_line_end: 8,
      source: "submitted_code_llm",
      rubric: "Overtime multiplier.",
      answer_criteria: [{ point: "Multiplier logic", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Overtime calculation"
    },
    decomposed_claims: [
      { claim_id: "EXP33-C1", text: "Anchor displays calculateBonus method logic.", evidence_type: "anchor_relevance", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor shows constructor, not calculateBonus."
  },
  {
    id: "EXP-34",
    name: "Unrelated anchor: Imports anchor for sorting question",
    category: "Unrelated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "UNRELATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import java.util.List;
import java.util.Collections;

public class NumberSorter {
    public void sort(List<Integer> list) {
        Collections.sort(list);
    }
}`,
    generated_question: {
      qid: "Q34",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "How does Collections.sort handle the elements in your list?",
      code_anchor: "import java.util.List;\nimport java.util.Collections;",
      code_line_start: 1,
      code_line_end: 2,
      source: "submitted_code_llm",
      rubric: "Sorting logic.",
      answer_criteria: [{ point: "Sorting", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Sorting"
    },
    decomposed_claims: [
      { claim_id: "EXP34-C1", text: "Anchor displays sorting execution.", evidence_type: "anchor_relevance", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor only displays import statements."
  },
  {
    id: "EXP-35",
    name: "Unrelated anchor: Field declaration anchor for recursive traversal",
    category: "Unrelated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "UNRELATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class TreePrinter {
    private int printCount = 0;

    public void printInorder(TreeNode node) {
        if (node == null) return;
        printInorder(node.left);
        System.out.println(node.val);
        printCount++;
        printInorder(node.right);
    }
}`,
    generated_question: {
      qid: "Q35",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "In printInorder, what recursive traversal order do you use to visit left and right subtrees?",
      code_anchor: "    private int printCount = 0;",
      code_line_start: 2,
      code_line_end: 2,
      source: "submitted_code_llm",
      rubric: "Inorder traversal order.",
      answer_criteria: [{ point: "Inorder traversal", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Traversal order"
    },
    decomposed_claims: [
      { claim_id: "EXP35-C1", text: "Anchor demonstrates printInorder recursive traversal.", evidence_type: "anchor_relevance", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor shows single field count, not recursive traversal."
  },
  {
    id: "EXP-36",
    name: "Unrelated anchor: Println anchor for data structure insertion",
    category: "Unrelated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "UNRELATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class LoggerService {
    private List<String> logs = new ArrayList<>();

    public void log(String msg) {
        logs.add(msg);
        System.out.println("LOG: " + msg);
    }
}`,
    generated_question: {
      qid: "Q36",
      dimension: "Array / ArrayList",
      difficulty: "Basic",
      question: "How does adding entries to your logs list ensure message retention?",
      code_anchor: "        System.out.println(\"LOG: \" + msg);",
      code_line_start: 8,
      code_line_end: 8,
      source: "submitted_code_llm",
      rubric: "List retention.",
      answer_criteria: [{ point: "List addition", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "List insertion"
    },
    decomposed_claims: [
      { claim_id: "EXP36-C1", text: "Anchor shows insertion into logs list.", evidence_type: "anchor_relevance", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor shows stdout print, not list addition."
  },
  {
    id: "EXP-37",
    name: "Unrelated anchor (Python): Imports anchor for dictionary question",
    category: "Unrelated Anchor",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "UNRELATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import math
import sys

def calculate_square_roots(numbers):
    return {n: math.sqrt(n) for n in numbers if n >= 0}
`,
    generated_question: {
      qid: "Q37",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "How does your dictionary comprehension filter negative numbers when computing square roots?",
      code_anchor: "import math\nimport sys",
      code_line_start: 1,
      code_line_end: 2,
      source: "submitted_code_llm",
      rubric: "Dictionary comprehension filter.",
      answer_criteria: [{ point: "Dict comprehension", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Dict comprehension"
    },
    decomposed_claims: [
      { claim_id: "EXP37-C1", text: "Anchor demonstrates dictionary comprehension filtering.", evidence_type: "anchor_relevance", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor only shows import statements."
  },

  // =========================================================================
  // CATEGORY 5: INSUFFICIENT ANCHOR EVIDENCE / HALLUCINATED FEATURES (7 Cases: EXP-38 to EXP-44)
  // =========================================================================
  {
    id: "EXP-38",
    name: "Hallucinated feature: Transactional rollback on simple subtraction",
    category: "Insufficient Anchor Evidence",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class SimpleBank {
    private double balance = 100.0;
    public boolean withdraw(double amt) {
        if (balance >= amt) {
            balance -= amt;
            return true;
        }
        return false;
    }
}`,
    generated_question: {
      qid: "Q38",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "I see you added transactional rollback logic if a debit operation encounters an audit failure. How does your rollback restore balance?",
      code_anchor: "        if (balance >= amt) {\n            balance -= amt;\n            return true;\n        }",
      code_line_start: 4,
      code_line_end: 7,
      source: "submitted_code_llm",
      rubric: "Transactional rollback.",
      answer_criteria: [{ point: "Rollback", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Rollback"
    },
    decomposed_claims: [
      { claim_id: "EXP38-C1", text: "Code implements transactional rollback on debit.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Plain subtraction has zero transactional or rollback features."
  },
  {
    id: "EXP-39",
    name: "Hallucinated feature: Thread synchronization on plain ArrayList",
    category: "Insufficient Anchor Evidence",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class ItemContainer {
    private List<String> items = new ArrayList<>();
    public void add(String s) {
        items.add(s);
    }
}`,
    generated_question: {
      qid: "Q39",
      dimension: "Array / ArrayList",
      difficulty: "Intermediate",
      question: "What locking mechanism or synchronized lock does your add method use to guarantee thread-safe writes across concurrent threads?",
      code_anchor: "    public void add(String s) {\n        items.add(s);\n    }",
      code_line_start: 5,
      code_line_end: 7,
      source: "submitted_code_llm",
      rubric: "Thread synchronization.",
      answer_criteria: [{ point: "Synchronization", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Thread safety"
    },
    decomposed_claims: [
      { claim_id: "EXP39-C1", text: "add method uses locking/synchronization for thread safety.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Plain ArrayList has no synchronization or locking."
  },
  {
    id: "EXP-40",
    name: "Hallucinated feature: Exponential backoff retry on HTTP fetch",
    category: "Insufficient Anchor Evidence",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class SimpleClient {
    public String fetch(String url) {
        return HttpUtil.get(url);
    }
}`,
    generated_question: {
      qid: "Q40",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "How does your exponential backoff retry mechanism handle transient 503 HTTP status errors in fetch?",
      code_anchor: "    public String fetch(String url) {\n        return HttpUtil.get(url);\n    }",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Exponential backoff.",
      answer_criteria: [{ point: "Retry logic", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Retry policy"
    },
    decomposed_claims: [
      { claim_id: "EXP40-C1", text: "Candidate implemented exponential backoff retry logic.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "No retry or backoff loops exist in code."
  },
  {
    id: "EXP-41",
    name: "Hallucinated feature: Redis distributed caching on SQL query",
    category: "Insufficient Anchor Evidence",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class UserRepository {
    public User findById(int id) {
        return Database.query("SELECT * FROM users WHERE id = " + id);
    }
}`,
    generated_question: {
      qid: "Q41",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "What cache TTL and invalidation strategy did you configure on your Redis distributed cache layer in findById?",
      code_anchor: "    public User findById(int id) {\n        return Database.query(\"SELECT * FROM users WHERE id = \" + id);\n    }",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Redis caching.",
      answer_criteria: [{ point: "Cache TTL", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Caching"
    },
    decomposed_claims: [
      { claim_id: "EXP41-C1", text: "Candidate configured Redis distributed caching.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Zero caching or Redis integration exists."
  },
  {
    id: "EXP-42",
    name: "Hallucinated feature: Token bucket rate limiter on controller",
    category: "Insufficient Anchor Evidence",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class ApiEndpoint {
    public Response handle(Request req) {
        return Response.ok("Hello");
    }
}`,
    generated_question: {
      qid: "Q42",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "How does your token bucket rate limiter throttle abusive IP addresses in handle?",
      code_anchor: "    public Response handle(Request req) {\n        return Response.ok(\"Hello\");\n    }",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Rate limiting.",
      answer_criteria: [{ point: "Token bucket", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Rate limiting"
    },
    decomposed_claims: [
      { claim_id: "EXP42-C1", text: "Candidate implemented token bucket rate limiting.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "No rate limiter exists in code."
  },
  {
    id: "EXP-43",
    name: "Hallucinated feature: AES encryption on Base64 encoding",
    category: "Insufficient Anchor Evidence",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import java.util.Base64;

public class SecretEncoder {
    public String encode(String raw) {
        return Base64.getEncoder().encodeToString(raw.getBytes());
    }
}`,
    generated_question: {
      qid: "Q43",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "What AES cipher mode (e.g. GCM or CBC) and IV generation did you use to encrypt raw strings in encode?",
      code_anchor: "    public String encode(String raw) {\n        return Base64.getEncoder().encodeToString(raw.getBytes());\n    }",
      code_line_start: 4,
      code_line_end: 6,
      source: "submitted_code_llm",
      rubric: "AES encryption.",
      answer_criteria: [{ point: "AES cipher", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Encryption"
    },
    decomposed_claims: [
      { claim_id: "EXP43-C1", text: "Candidate uses AES encryption with IV in encode.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Base64 is an encoding, not AES encryption."
  },
  {
    id: "EXP-44",
    name: "Hallucinated feature (Python): ThreadPoolExecutor on list iteration",
    category: "Insufficient Anchor Evidence",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INSUFFICIENT_ANCHOR",
    expected_admission: "REJECT",
    source_code: `def process_all(items):
    out = []
    for item in items:
        out.append(item.strip())
    return out
`,
    generated_question: {
      qid: "Q44",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "How does your ThreadPoolExecutor manage worker pool sizing when processing items concurrently?",
      code_anchor: "    out = []\n    for item in items:\n        out.append(item.strip())",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "ThreadPoolExecutor sizing.",
      answer_criteria: [{ point: "Thread pool", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Concurrent processing"
    },
    decomposed_claims: [
      { claim_id: "EXP44-C1", text: "Function uses ThreadPoolExecutor for concurrent worker execution.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code is a simple sequential for-loop."
  },

  // =========================================================================
  // CATEGORY 6: STALE / INVALIDATED ANCHORS (4 Cases: EXP-45 to EXP-48)
  // =========================================================================
  {
    id: "EXP-45",
    name: "Invalidated anchor: Refactored while loop into for loop",
    category: "Invalidated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INVALIDATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `public class NodeTraverser {
    public void traverse(ListNode head) {
        for (ListNode curr = head; curr != null; curr = curr.next) {
            System.out.println(curr.val);
        }
    }
}`,
    generated_question: {
      qid: "Q45",
      dimension: "Control Structures / Loops",
      difficulty: "Intermediate",
      question: "Why did you use an explicit while loop instead of a for loop to advance your list pointer?",
      code_anchor: "        while (curr != null) {\n            curr = curr.next;\n        }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Loop selection.",
      answer_criteria: [{ point: "Loop choice", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Loop selection"
    },
    decomposed_claims: [
      { claim_id: "EXP45-C1", text: "Code contains while loop.", evidence_type: "syntax_loop_type", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Candidate refactored while into for loop; anchor is stale."
  },
  {
    id: "EXP-46",
    name: "Invalidated anchor: Refactored ArrayList into HashSet",
    category: "Invalidated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INVALIDATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class Deduplicator {
    public Set<String> getUnique(List<String> raw) {
        return new HashSet<>(raw);
    }
}`,
    generated_question: {
      qid: "Q46",
      dimension: "Array / ArrayList",
      difficulty: "Intermediate",
      question: "Why did you initialize an empty ArrayList and iterate through elements with contains checks?",
      code_anchor: "        List<String> list = new ArrayList<>();\n        for (String s : raw) {\n            if (!list.contains(s)) list.add(s);\n        }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Deduplication strategy.",
      answer_criteria: [{ point: "Deduplication", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "ArrayList deduplication"
    },
    decomposed_claims: [
      { claim_id: "EXP46-C1", text: "Code initializes ArrayList and iterates with contains().", evidence_type: "anchor_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code uses HashSet constructor directly; anchor from earlier draft is missing."
  },
  {
    id: "EXP-47",
    name: "Invalidated anchor: Refactored recursive helper to iterative stack",
    category: "Invalidated Anchor",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INVALIDATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `import java.util.*;

public class InorderSolver {
    public List<Integer> inorder(TreeNode root) {
        List<Integer> res = new ArrayList<>();
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode curr = root;
        while (curr != null || !stack.isEmpty()) {
            while (curr != null) {
                stack.push(curr);
                curr = curr.left;
            }
            curr = stack.pop();
            res.add(curr.val);
            curr = curr.right;
        }
        return res;
    }
}`,
    generated_question: {
      qid: "Q47",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "In your recursive helper method helper(node, list), how does passing the accumulator list avoid extra memory copies?",
      code_anchor: "    private void helper(TreeNode node, List<Integer> list) {\n        if (node == null) return;\n        helper(node.left, list);\n        list.add(node.val);\n        helper(node.right, list);\n    }",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Recursive helper design.",
      answer_criteria: [{ point: "Helper method", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Recursive helper"
    },
    decomposed_claims: [
      { claim_id: "EXP47-C1", text: "Solution contains recursive helper method helper(TreeNode, List).", evidence_type: "entity_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Solution was refactored to an iterative while loop; helper method was deleted."
  },
  {
    id: "EXP-48",
    name: "Invalidated anchor (Python): Refactored loop into set comprehension",
    category: "Invalidated Anchor",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "INVALIDATED_ANCHOR",
    expected_admission: "REJECT",
    source_code: `def get_unique_lengths(words):
    return {len(w) for w in words}
`,
    generated_question: {
      qid: "Q48",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "Why did you declare an empty seen set and use an explicit for loop with seen.add(len(w))?",
      code_anchor: "    seen = set()\n    for w in words:\n        seen.add(len(w))\n    return seen",
      code_line_start: null,
      code_line_end: null,
      source: "submitted_code_llm",
      rubric: "Set loop.",
      answer_criteria: [{ point: "Set iteration", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Loop pattern"
    },
    decomposed_claims: [
      { claim_id: "EXP48-C1", text: "Candidate declared seen = set() and used for loop with seen.add().", evidence_type: "anchor_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Candidate refactored into a concise set comprehension; old loop anchor is missing."
  },

  // =========================================================================
  // CATEGORY 7: PARTIALLY UNSUPPORTED CONJUNCTIONS (4 Cases: EXP-49 to EXP-52)
  // =========================================================================
  {
    id: "EXP-49",
    name: "Partial conjunction: Length check true, DNS MX query fabricated",
    category: "Partially Unsupported",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "PARTIALLY_UNSUPPORTED",
    expected_admission: "REJECT",
    source_code: `public class EmailValidator {
    public boolean isValid(String email) {
        if (email == null || email.length() > 254) return false;
        return email.matches("^[A-Za-z0-9+_.-]+@(.+)$");
    }
}`,
    generated_question: {
      qid: "Q49",
      dimension: "Control Structures / Loops",
      difficulty: "Advanced",
      question: "In isValid, you check for null inputs, enforce a 254-character limit, and query external DNS servers for MX records. How do you handle DNS timeouts?",
      code_anchor: "        if (email == null || email.length() > 254) return false;\n        return email.matches(\"^[A-Za-z0-9+_.-]+@(.+)$\");",
      code_line_start: 3,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "DNS MX handling.",
      answer_criteria: [{ point: "DNS query", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "DNS validation"
    },
    decomposed_claims: [
      { claim_id: "EXP49-C1", text: "Candidate checks null and 254 length limit.", evidence_type: "code_condition", expected_classification: "SUPPORTED" },
      { claim_id: "EXP49-C2", text: "Candidate queries external DNS for MX records.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "DNS claim is fabricated; strict conjunction requires rejection."
  },
  {
    id: "EXP-50",
    name: "Partial conjunction: Age validation true, Credit bureau API fabricated",
    category: "Partially Unsupported",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "PARTIALLY_UNSUPPORTED",
    expected_admission: "REJECT",
    source_code: `public class LoanApplicant {
    public boolean checkEligibility(int age, double salary) {
        return age >= 18 && salary >= 30000;
    }
}`,
    generated_question: {
      qid: "Q50",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "You verify age >= 18 and minimum salary, and then invoke an external credit bureau API. How do you retry credit check failures?",
      code_anchor: "    public boolean checkEligibility(int age, double salary) {\n        return age >= 18 && salary >= 30000;\n    }",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Credit bureau retry.",
      answer_criteria: [{ point: "Credit API", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Credit API"
    },
    decomposed_claims: [
      { claim_id: "EXP50-C1", text: "Candidate verifies age >= 18 and salary >= 30000.", evidence_type: "code_condition", expected_classification: "SUPPORTED" },
      { claim_id: "EXP50-C2", text: "Candidate invokes external credit bureau API.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Credit bureau API call does not exist."
  },
  {
    id: "EXP-51",
    name: "Partial conjunction: Trim true, XSS sanitization library fabricated",
    category: "Partially Unsupported",
    language: "java",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "PARTIALLY_UNSUPPORTED",
    expected_admission: "REJECT",
    source_code: `public class CommentPost {
    public String cleanComment(String raw) {
        return raw != null ? raw.trim() : "";
    }
}`,
    generated_question: {
      qid: "Q51",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "You trim whitespace and sanitize dangerous HTML tags using an XSS sanitizer library. What tags does your sanitizer permit?",
      code_anchor: "    public String cleanComment(String raw) {\n        return raw != null ? raw.trim() : \"\";\n    }",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "XSS sanitizer.",
      answer_criteria: [{ point: "XSS tags", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "XSS sanitization"
    },
    decomposed_claims: [
      { claim_id: "EXP51-C1", text: "Candidate trims whitespace.", evidence_type: "code_method", expected_classification: "SUPPORTED" },
      { claim_id: "EXP51-C2", text: "Candidate uses XSS sanitizer library for HTML tags.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Code only trims; no XSS sanitizer library exists."
  },
  {
    id: "EXP-52",
    name: "Partial conjunction (Python): File open true, S3 cloud upload fabricated",
    category: "Partially Unsupported",
    language: "python",
    ground_truth_label: "UNSUPPORTED",
    sub_type: "PARTIALLY_UNSUPPORTED",
    expected_admission: "REJECT",
    source_code: `def save_local_log(filename, content):
    with open(filename, "w") as f:
        f.write(content.strip())
`,
    generated_question: {
      qid: "Q52",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "You write the content to a local file and then upload a replica to an Amazon S3 bucket. How do you handle AWS authorization credentials?",
      code_anchor: "    with open(filename, \"w\") as f:\n        f.write(content.strip())",
      code_line_start: 2,
      code_line_end: 3,
      source: "submitted_code_llm",
      rubric: "AWS S3 upload.",
      answer_criteria: [{ point: "AWS credentials", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Cloud upload"
    },
    decomposed_claims: [
      { claim_id: "EXP52-C1", text: "Candidate opens local file and writes stripped content.", evidence_type: "code_io", expected_classification: "SUPPORTED" },
      { claim_id: "EXP52-C2", text: "Candidate uploads replica to Amazon S3.", evidence_type: "advanced_feature", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Amazon S3 upload is fabricated."
  },

  // =========================================================================
  // CATEGORY 8: AMBIGUOUS / CONTEXT-DEPENDENT / INSUFFICIENT EVIDENCE (6 Cases: EXP-53 to EXP-58)
  // =========================================================================
  {
    id: "EXP-53",
    name: "Context-dependent: Binary search precondition sorted in constructor",
    category: "Context-Dependent Invariant",
    language: "java",
    ground_truth_label: "AMBIGUOUS",
    sub_type: "CONTEXT_DEPENDENT",
    expected_admission: "MANUAL_REVIEW",
    source_code: `import java.util.*;

public class FastLookup {
    private List<String> list;

    public FastLookup(List<String> raw) {
        this.list = new ArrayList<>(raw);
        Collections.sort(this.list);
    }

    public boolean contains(String s) {
        return Collections.binarySearch(list, s) >= 0;
    }
}`,
    generated_question: {
      qid: "Q53",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Intermediate",
      question: "In contains, you use Collections.binarySearch. How do you guarantee the required sortedness precondition is met?",
      code_anchor: "    public boolean contains(String s) {\n        return Collections.binarySearch(list, s) >= 0;\n    }",
      code_line_start: 11,
      code_line_end: 13,
      source: "submitted_code_llm",
      rubric: "Precondition is met in constructor.",
      answer_criteria: [{ point: "Precondition sortedness", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Precondition invariant"
    },
    decomposed_claims: [
      { claim_id: "EXP53-C1", text: "contains() executes Collections.binarySearch.", evidence_type: "code_invocation", expected_classification: "SUPPORTED" },
      { claim_id: "EXP53-C2", text: "Precondition sortedness is guaranteed within anchor scope.", evidence_type: "interprocedural_context", expected_classification: "UNRESOLVED" }
    ],
    rationale: "Precondition established in constructor outside local method anchor."
  },
  {
    id: "EXP-54",
    name: "Insufficient evidence: External library socket timeout claim",
    category: "External Dependency",
    language: "java",
    ground_truth_label: "AMBIGUOUS",
    sub_type: "INSUFFICIENT_EVIDENCE",
    expected_admission: "MANUAL_REVIEW",
    source_code: `public class RemoteConfigFetcher {
    public String fetch(String url) {
        return ExternalHttpClient.get(url);
    }
}`,
    generated_question: {
      qid: "Q54",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "What connection pool timeout is configured on the underlying HTTP socket pool in ExternalHttpClient?",
      code_anchor: "    public String fetch(String url) {\n        return ExternalHttpClient.get(url);\n    }",
      code_line_start: 2,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Socket timeout parameters.",
      answer_criteria: [{ point: "Socket timeout", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Socket timeout"
    },
    decomposed_claims: [
      { claim_id: "EXP54-C1", text: "Candidate invokes ExternalHttpClient.get(url).", evidence_type: "code_invocation", expected_classification: "SUPPORTED" },
      { claim_id: "EXP54-C2", text: "Underlying socket pool timeout is determinable from student code.", evidence_type: "external_configuration", expected_classification: "UNRESOLVED" }
    ],
    rationale: "Timeout is configured in external library; unresolvable from student submission."
  },
  {
    id: "EXP-55",
    name: "Ambiguous duplicate anchor: if (node == null) return; in 2 methods",
    category: "Duplicate Anchors",
    language: "java",
    ground_truth_label: "AMBIGUOUS",
    sub_type: "MULTIPLE_ANCHORS",
    expected_admission: "REJECT",
    source_code: `public class BinaryTreeOps {
    public void inorder(TreeNode node) {
        if (node == null) return;
        inorder(node.left);
        System.out.println(node.val);
        inorder(node.right);
    }

    public void postorder(TreeNode node) {
        if (node == null) return;
        postorder(node.left);
        postorder(node.right);
        System.out.println(node.val);
    }
}`,
    generated_question: {
      qid: "Q55",
      dimension: "Control Structures / Loops",
      difficulty: "Basic",
      question: "What is the purpose of this base-case null check before recursing?",
      code_anchor: "        if (node == null) return;",
      code_line_start: 3,
      code_line_end: 3,
      source: "submitted_code_llm",
      rubric: "Base case termination.",
      answer_criteria: [{ point: "Null check base case", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Base case"
    },
    decomposed_claims: [
      { claim_id: "EXP55-C1", text: "Anchor snippet if (node == null) return; matches uniquely.", evidence_type: "anchor_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "Anchor occurs at line 3 and line 11; ambiguous match."
  },
  {
    id: "EXP-56",
    name: "Context-dependent: Subclass super.compute() with external base class",
    category: "External Dependency",
    language: "java",
    ground_truth_label: "AMBIGUOUS",
    sub_type: "CONTEXT_DEPENDENT",
    expected_admission: "MANUAL_REVIEW",
    source_code: `public class CustomCalculator extends FrameworkCalculator {
    @Override
    public double calculate(double x) {
        return super.calculate(x) * 1.1;
    }
}`,
    generated_question: {
      qid: "Q56",
      dimension: "Class / Object / Constructor",
      difficulty: "Intermediate",
      question: "What default scaling or normalization does FrameworkCalculator.calculate apply before your 1.1 multiplier?",
      code_anchor: "    @Override\n    public double calculate(double x) {\n        return super.calculate(x) * 1.1;\n    }",
      code_line_start: 2,
      code_line_end: 5,
      source: "submitted_code_llm",
      rubric: "Superclass calculate implementation.",
      answer_criteria: [{ point: "Superclass logic", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Superclass behavior"
    },
    decomposed_claims: [
      { claim_id: "EXP56-C1", text: "Candidate invokes super.calculate(x).", evidence_type: "code_invocation", expected_classification: "SUPPORTED" },
      { claim_id: "EXP56-C2", text: "FrameworkCalculator internal normalization can be verified from code.", evidence_type: "external_configuration", expected_classification: "UNRESOLVED" }
    ],
    rationale: "Base class FrameworkCalculator is not provided in submission."
  },
  {
    id: "EXP-57",
    name: "Ambiguous duplicate anchor: return count; in 2 methods",
    category: "Duplicate Anchors",
    language: "java",
    ground_truth_label: "AMBIGUOUS",
    sub_type: "MULTIPLE_ANCHORS",
    expected_admission: "REJECT",
    source_code: `public class CounterBox {
    public int getAlphaCount() {
        int count = 10;
        return count;
    }

    public int getBetaCount() {
        int count = 20;
        return count;
    }
}`,
    generated_question: {
      qid: "Q57",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Basic",
      question: "Why do you return count at the conclusion of your method?",
      code_anchor: "        return count;",
      code_line_start: 4,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Return statement.",
      answer_criteria: [{ point: "Return value", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "Return statement"
    },
    decomposed_claims: [
      { claim_id: "EXP57-C1", text: "Anchor snippet return count; matches uniquely.", evidence_type: "anchor_presence", expected_classification: "CONTRADICTED" }
    ],
    rationale: "return count; appears at line 4 and line 9; ambiguous match."
  },
  {
    id: "EXP-58",
    name: "Insufficient evidence (Python): External requests session pool timeout",
    category: "External Dependency",
    language: "python",
    ground_truth_label: "AMBIGUOUS",
    sub_type: "INSUFFICIENT_EVIDENCE",
    expected_admission: "MANUAL_REVIEW",
    source_code: `import external_service

def ping_health():
    return external_service.check_status()
`,
    generated_question: {
      qid: "Q58",
      dimension: "Functions / Methods / Parameters / Return Type",
      difficulty: "Advanced",
      question: "What read and connect timeout values did external_service configure on its HTTP adapter?",
      code_anchor: "def ping_health():\n    return external_service.check_status()",
      code_line_start: 3,
      code_line_end: 4,
      source: "submitted_code_llm",
      rubric: "Adapter timeout.",
      answer_criteria: [{ point: "Adapter timeout", marks: 5 }],
      scoring_guide: { full: "Full", partial: "Partial", minimal: "Minimal", zero: "Zero" },
      evaluates: "External adapter timeout"
    },
    decomposed_claims: [
      { claim_id: "EXP58-C1", text: "Function calls external_service.check_status().", evidence_type: "code_invocation", expected_classification: "SUPPORTED" },
      { claim_id: "EXP58-C2", text: "Adapter read/connect timeout can be determined from code.", evidence_type: "external_configuration", expected_classification: "UNRESOLVED" }
    ],
    rationale: "Implementation of external_service is not in submission."
  }
];

const benchmarkData = {
  benchmark_version: "2.0.0-expanded",
  name: "CodeArena Source-Code Grounding Expanded Benchmark (58 Cases)",
  description: "Comprehensive 58-case benchmark evaluating question grounding across Java and Python.",
  created_at: new Date().toISOString(),
  metadata: {
    total_cases: cases.length,
    valid_cases: cases.filter(c => c.ground_truth_label === "VALID").length,
    unsupported_cases: cases.filter(c => c.ground_truth_label === "UNSUPPORTED").length,
    ambiguous_cases: cases.filter(c => c.ground_truth_label === "AMBIGUOUS").length,
    languages: {
      java: cases.filter(c => c.language === "java").length,
      python: cases.filter(c => c.language === "python").length,
    }
  },
  cases: cases
};

const outputPathRoot = path.resolve(__dirname, "../../../GROUNDING_BENCHMARK_EXPANDED.json");
const outputPathSub = path.resolve(__dirname, "../../GROUNDING_BENCHMARK_EXPANDED.json");

fs.writeFileSync(outputPathRoot, JSON.stringify(benchmarkData, null, 2), "utf8");
fs.writeFileSync(outputPathSub, JSON.stringify(benchmarkData, null, 2), "utf8");

console.log("=================================================================");
console.log("  Successfully generated GROUNDING_BENCHMARK_EXPANDED.json");
console.log(`  Total Cases: ${cases.length}`);
console.log(`  VALID:       ${benchmarkData.metadata.valid_cases}`);
console.log(`  UNSUPPORTED: ${benchmarkData.metadata.unsupported_cases}`);
console.log(`  AMBIGUOUS:   ${benchmarkData.metadata.ambiguous_cases}`);
console.log(`  Languages:   Java (${benchmarkData.metadata.languages.java}), Python (${benchmarkData.metadata.languages.python})`);
console.log("=================================================================");

