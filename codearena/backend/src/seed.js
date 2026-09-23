require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const User = require("./models/User");
const Problem = require("./models/Problem");
const StaticProblem = require("./models/StaticProblem");
const Assignment = require("./models/Assignment");
const Batch = require("./models/Batch");
const InterviewSession = require("./models/InterviewSession");
const Submission = require("./models/Submission");
const PreCodeAssessment = require("./models/PreCodeAssessment");
const Report = require("./models/Report");

const javaBoilerplate = `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your code here
        
        sc.close();
    }
}`;

const users = [
  { name: "Admin User", email: "admin@code.io", password: "admin123", role: "admin" },
  { name: "Dr. Robert Smith", email: "faculty@code.io", password: "faculty123", role: "faculty" },
  { name: "Prof. Sarah Connor", email: "sarah.faculty@code.io", password: "faculty123", role: "faculty" },
  { name: "Alice Johnson", email: "user@code.io", password: "user123", role: "user" },
  { name: "Bob Smith", email: "bob@code.io", password: "user123", role: "user" },
  { name: "Charlie Davis", email: "charlie@code.io", password: "user123", role: "user" },
  { name: "Diana Patel", email: "diana@code.io", password: "user123", role: "user" },
];

const problems = [
  {
    title: "Two Sum",
    difficulty: "Easy",
    description: `<h2>Two Sum</h2>
<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <strong>indices of the two numbers</strong> such that they add up to <code>target</code>.</p>
<p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.</p>
<h3>Example 1:</h3>
<pre><code>Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].</code></pre>
<h3>Example 2:</h3>
<pre><code>Input: nums = [3,2,4], target = 6
Output: [1,2]</code></pre>`,
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
    sampleInput: "4\n2 7 11 15\n9",
    sampleOutput: "0 1",
    testCases: [
      { input: "4\n2 7 11 15\n9", expectedOutput: "0 1" },
      { input: "3\n3 2 4\n6", expectedOutput: "1 2" },
      { input: "2\n3 3\n6", expectedOutput: "0 1" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
  },
  {
    title: "FizzBuzz",
    difficulty: "Easy",
    description: `<h2>FizzBuzz</h2>
<p>Given an integer <code>n</code>, return a string array <code>answer</code> (<strong>1-indexed</strong>) where:</p>
<ul>
<li><code>answer[i] == "FizzBuzz"</code> if <code>i</code> is divisible by 3 and 5.</li>
<li><code>answer[i] == "Fizz"</code> if <code>i</code> is divisible by 3.</li>
<li><code>answer[i] == "Buzz"</code> if <code>i</code> is divisible by 5.</li>
<li><code>answer[i] == i</code> (as a string) if none of the above conditions are true.</li>
</ul>
<h3>Example:</h3>
<pre><code>Input: n = 15
Output: ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]</code></pre>`,
    constraints: "1 <= n <= 10^4",
    sampleInput: "15",
    sampleOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
    testCases: [
      { input: "5", expectedOutput: "1\n2\nFizz\n4\nBuzz" },
      { input: "3", expectedOutput: "1\n2\nFizz" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
  },
  {
    title: "Palindrome Check",
    difficulty: "Easy",
    description: `<h2>Palindrome Check</h2>
<p>Given a string <code>s</code>, return <code>true</code> if it is a <strong>palindrome</strong>, or <code>false</code> otherwise.</p>
<p>A string is a palindrome if it reads the same forward and backward, considering only alphanumeric characters and ignoring cases.</p>
<h3>Example 1:</h3>
<pre><code>Input: s = "A man, a plan, a canal: Panama"
Output: true</code></pre>
<h3>Example 2:</h3>
<pre><code>Input: s = "race a car"
Output: false</code></pre>`,
    constraints: "1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.",
    sampleInput: "A man, a plan, a canal: Panama",
    sampleOutput: "true",
    testCases: [
      { input: "A man, a plan, a canal: Panama", expectedOutput: "true" },
      { input: "race a car", expectedOutput: "false" },
      { input: " ", expectedOutput: "true" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
  },
  {
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    description: `<h2>Longest Substring Without Repeating Characters</h2>
<p>Given a string <code>s</code>, find the length of the <strong>longest substring</strong> without repeating characters.</p>
<h3>Example 1:</h3>
<pre><code>Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.</code></pre>
<h3>Example 2:</h3>
<pre><code>Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.</code></pre>`,
    constraints: "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
    sampleInput: "abcabcbb",
    sampleOutput: "3",
    testCases: [
      { input: "abcabcbb", expectedOutput: "3" },
      { input: "bbbbb", expectedOutput: "1" },
      { input: "pwwkew", expectedOutput: "3" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
  },
  {
    title: "Merge Sorted Arrays",
    difficulty: "Medium",
    description: `<h2>Merge Sorted Arrays</h2>
<p>You are given two integer arrays <code>nums1</code> and <code>nums2</code>, sorted in <strong>non-decreasing order</strong>. Merge <code>nums2</code> into <code>nums1</code> as one sorted array.</p>
<p>Print the merged sorted array.</p>
<h3>Example:</h3>
<pre><code>Input:
nums1 = [1,2,3]
nums2 = [2,5,6]
Output: 1 2 2 3 5 6</code></pre>`,
    constraints: "1 <= nums1.length, nums2.length <= 200\n-10^9 <= nums1[i], nums2[j] <= 10^9",
    sampleInput: "3\n1 2 3\n3\n2 5 6",
    sampleOutput: "1 2 2 3 5 6",
    testCases: [
      { input: "3\n1 2 3\n3\n2 5 6", expectedOutput: "1 2 2 3 5 6" },
      { input: "1\n1\n0", expectedOutput: "1" },
    ],
    boilerplate: javaBoilerplate,
    isActive: false,
  },
  {
    title: "Binary Tree Level Order Traversal",
    difficulty: "Hard",
    description: `<h2>Binary Tree Level Order Traversal</h2>
<p>Given the <code>root</code> of a binary tree, return the <strong>level order traversal</strong> of its nodes' values (i.e., from left to right, level by level).</p>
<p>The tree is given as space-separated values in level order, with <code>-1</code> representing null nodes.</p>
<h3>Example:</h3>
<pre><code>Input: 3 9 20 -1 -1 15 7
Output:
3
9 20
15 7</code></pre>`,
    constraints: "The number of nodes in the tree is in the range [0, 2000].\n-1000 <= Node.val <= 1000",
    sampleInput: "3 9 20 -1 -1 15 7",
    sampleOutput: "3\n9 20\n15 7",
    testCases: [
      { input: "3 9 20 -1 -1 15 7", expectedOutput: "3\n9 20\n15 7" },
      { input: "1", expectedOutput: "1" },
    ],
    boilerplate: javaBoilerplate,
    isActive: false,
  },
];

// ── CSV Parser for Static Problems ───────────────────────────────────────────

/**
 * Parse a CSV line handling quoted fields with commas inside.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse questions.csv into an array of static problem objects.
 */
function parseQuestionsCSV() {
  const csvPath = path.join(__dirname, "..", "questions.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("questions.csv not found at", csvPath);
    return [];
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());

  if (lines.length < 2) return [];

  // Skip header line
  const problems = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;

    const [topic, subTopic, difficulty, question, expectedAnswer, explanation] = fields;
    if (!question || !question.trim()) continue;

    // Normalize difficulty
    let normalizedDifficulty = (difficulty || "Basic").trim();
    if (!["Basic", "Intermediate", "Advanced"].includes(normalizedDifficulty)) {
      const lower = normalizedDifficulty.toLowerCase();
      if (lower === "basic" || lower === "easy") normalizedDifficulty = "Basic";
      else if (lower === "intermediate" || lower === "medium") normalizedDifficulty = "Intermediate";
      else if (lower === "advanced" || lower === "hard") normalizedDifficulty = "Advanced";
      else normalizedDifficulty = "Basic";
    }

    problems.push({
      topic: (topic || "Java").trim(),
      subTopic: (subTopic || "General").trim(),
      difficulty: normalizedDifficulty,
      question: question.trim(),
      expectedAnswer: (expectedAnswer || "").trim(),
      explanation: (explanation || "").trim(),
    });
  }

  return problems;
}

// ── Seed Function ────────────────────────────────────────────────────────────

async function seed() {
  try {
    await mongoose.connect("mongodb://localhost:27017/codearena");
    console.log("Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Problem.deleteMany({});
    await Assignment.deleteMany({});
    await Batch.deleteMany({});
    await InterviewSession.deleteMany({});
    await PreCodeAssessment.deleteMany({});
    await Submission.deleteMany({});
    await Report.deleteMany({});
    console.log("Cleared existing data");

    // Create users
    const createdUsers = await User.create(users);
    console.log(`Created ${createdUsers.length} users`);

    const adminUser = createdUsers.find(u => u.email === "admin@code.io");
    const faculty1 = createdUsers.find(u => u.email === "faculty@code.io");
    const faculty2 = createdUsers.find(u => u.email === "sarah.faculty@code.io");
    const alice = createdUsers.find(u => u.email === "user@code.io");
    const bob = createdUsers.find(u => u.email === "bob@code.io");
    const charlie = createdUsers.find(u => u.email === "charlie@code.io");
    const diana = createdUsers.find(u => u.email === "diana@code.io");

    // Assign faculty to problems
    const problemsWithCreator = problems.map((p, idx) => ({
      ...p,
      createdBy: idx % 2 === 0 ? faculty1._id : faculty2._id,
    }));

    // Create problems
    const createdProblems = await Problem.create(problemsWithCreator);
    console.log(`Created ${createdProblems.length} problems with faculty creators`);

    // Create a batch
    const batch = await Batch.create({
      name: "Batch 2026 - CS Alpha",
      description: "Core algorithms and systems track",
      candidates: [alice._id, bob._id, charlie._id, diana._id],
      createdBy: adminUser._id,
    });
    console.log("Created sample batch:", batch.name);

    // Create assignments for Two Sum (problem 0) and FizzBuzz (problem 1)
    const twoSum = createdProblems[0];
    const fizzBuzz = createdProblems[1];

    await Assignment.create([
      { assessment: twoSum._id, candidate: alice._id, batch: batch._id, assignedBy: adminUser._id, status: "Completed", codingPassed: true, bestCodingScore: 100 },
      { assessment: twoSum._id, candidate: bob._id, batch: batch._id, assignedBy: adminUser._id, status: "In Progress", codingPassed: true, bestCodingScore: 100 },
      { assessment: twoSum._id, candidate: charlie._id, batch: batch._id, assignedBy: adminUser._id, status: "In Progress", codingPassed: false, bestCodingScore: 50 },
      { assessment: twoSum._id, candidate: diana._id, batch: batch._id, assignedBy: adminUser._id, status: "Completed", codingPassed: true, bestCodingScore: 100 },
      { assessment: fizzBuzz._id, candidate: alice._id, batch: batch._id, assignedBy: adminUser._id, status: "In Progress" },
      { assessment: fizzBuzz._id, candidate: bob._id, batch: batch._id, assignedBy: adminUser._id, status: "Pending" },
    ]);

    // 1. Alice - Completed Two Sum Assessment with Report
    await PreCodeAssessment.create({
      user: alice._id,
      problem: twoSum._id,
      status: "passed",
      integrityScore: 95,
      completedAt: new Date(Date.now() - 3600000 * 5),
    });

    const aliceSub = await Submission.create({
      user: alice._id,
      problem: twoSum._id,
      code: "class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{0,1}; } }",
      status: "Accepted",
      executionTime: "12ms",
      testCaseResults: [{ passed: true }, { passed: true }, { passed: true }],
    });

    const aliceSession = await InterviewSession.create({
      user: alice._id,
      submission: aliceSub._id,
      problem: twoSum._id,
      status: "completed",
      codingScore: 100,
      interviewScore: 85,
      overallScore: 88,
      codingPassed: true,
      interviewPassed: true,
      overallPassed: true,
      feedback: "Strong grasp of hash map trade-offs and complexity analysis.",
      grade: "A",
      completedAt: new Date(Date.now() - 3600000 * 4),
    });

    await Report.create({
      user: alice._id,
      interviewSession: aliceSession._id,
      reportType: "Full Candidate Assessment Report",
      version: "2.0",
      generatedBy: faculty1._id,
      reportData: {
        summary: "Alice demonstrated excellent mastery in Two Sum, solving via HashMap with optimal O(n) runtime.",
        scores: { preCode: 95, coding: 100, postCode: 85, overall: 88 },
        verdict: "PASSED",
        breakdown: { timeComplexity: "O(n)", spaceComplexity: "O(n)" },
      },
    });

    // 2. Diana - Completed Two Sum Assessment with Report (Failed)
    await PreCodeAssessment.create({
      user: diana._id,
      problem: twoSum._id,
      status: "passed",
      integrityScore: 70,
      completedAt: new Date(Date.now() - 3600000 * 3),
    });

    const dianaSub = await Submission.create({
      user: diana._id,
      problem: twoSum._id,
      code: "class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{0,1}; } }",
      status: "Accepted",
      executionTime: "45ms",
      testCaseResults: [{ passed: true }, { passed: true }, { passed: true }],
    });

    const dianaSession = await InterviewSession.create({
      user: diana._id,
      submission: dianaSub._id,
      problem: twoSum._id,
      status: "completed",
      codingScore: 70,
      interviewScore: 35,
      overallScore: 42,
      codingPassed: true,
      interviewPassed: false,
      overallPassed: false,
      feedback: "Needs deeper understanding of hash collisions and edge condition handling.",
      grade: "D",
      completedAt: new Date(Date.now() - 3600000 * 2),
    });

    await Report.create({
      user: diana._id,
      interviewSession: dianaSession._id,
      reportType: "Full Candidate Assessment Report",
      version: "2.0",
      generatedBy: faculty1._id,
      reportData: {
        summary: "Diana passed pre-coding but struggled to explain time complexity tradeoffs during AI interview.",
        scores: { preCode: 70, coding: 70, postCode: 35, overall: 42 },
        verdict: "FAILED",
      },
    });

    // 3. Bob - In Progress (Pre-code passed, coding passed, interview in progress - NO report)
    await PreCodeAssessment.create({
      user: bob._id,
      problem: twoSum._id,
      status: "passed",
      integrityScore: 90,
      completedAt: new Date(Date.now() - 3600000),
    });

    const bobSub = await Submission.create({
      user: bob._id,
      problem: twoSum._id,
      code: "class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{0,1}; } }",
      status: "Accepted",
      executionTime: "15ms",
      testCaseResults: [{ passed: true }, { passed: true }, { passed: true }],
    });

    await InterviewSession.create({
      user: bob._id,
      submission: bobSub._id,
      problem: twoSum._id,
      status: "in_progress",
      startedAt: new Date(Date.now() - 1800000),
    });

    // 4. Charlie - In Progress (Pre-code passed, coding attempt wrong answer, no interview)
    await PreCodeAssessment.create({
      user: charlie._id,
      problem: twoSum._id,
      status: "passed",
      integrityScore: 82,
      completedAt: new Date(Date.now() - 7200000),
    });

    await Submission.create({
      user: charlie._id,
      problem: twoSum._id,
      code: "class Solution { public int[] twoSum() {} }",
      status: "Wrong Answer",
      executionTime: "20ms",
      testCaseResults: [{ passed: false }, { passed: false }, { passed: true }],
    });

    console.log("Seeded sample assessment attempts, submissions, and reports.");

    // Seed static problems from questions.csv
    const existingStaticCount = await StaticProblem.countDocuments();
    if (existingStaticCount === 0) {
      console.log("Seeding static problems from questions.csv...");
      const staticProblems = parseQuestionsCSV();
      if (staticProblems.length > 0) {
        const createdStatic = await StaticProblem.insertMany(staticProblems);
        console.log(`Created ${createdStatic.length} static problems in 'staticproblems' collection`);
      } else {
        console.warn("No static problems parsed from CSV.");
      }
    } else {
      console.log(`Static problems already exist (${existingStaticCount} docs), skipping CSV seed.`);
    }

    console.log("\nSeed complete! Ready for all 3 logins:");
    console.log("  Admin:   admin@code.io / admin123");
    console.log("  Faculty: faculty@code.io / faculty123");
    console.log("  Student: user@code.io / user123");

    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exit(1);
  }
}

seed();

