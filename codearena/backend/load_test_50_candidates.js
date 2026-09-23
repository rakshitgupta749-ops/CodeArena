/**
 * CodeArena Load Testing Runner for 50 Candidates
 *
 * Workflow:
 * 1. Admin Authentication
 * 2. Problem Selection (e.g. FizzBuzz or Two Sum)
 * 3. 50 Test Candidates Creation via Admin API (POST /api/admin/candidates)
 * 4. Problem Assignment to each candidate (POST /api/admin/assignments)
 * 5. Candidate Authentication (POST /api/auth/login)
 * 6. Code Submission to solve the question (POST /api/submissions/submit)
 * 7. Start & Complete Interview to generate Report (POST /api/interviews/...)
 * 8. Report Verification via Admin API (GET /api/admin/reports)
 * 9. Performance Metrics & Summary Output
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:5001/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@code.io";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Configurable parameters via CLI arguments or env
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split("=")[1];
  return process.env[name.toUpperCase()] || defaultValue;
}

const TOTAL_CANDIDATES = parseInt(getArg("candidates", 50), 10);
const CONCURRENCY_LIMIT = parseInt(getArg("concurrency", 5), 10);
const TARGET_PROBLEM_TITLE = getArg("problem", "FizzBuzz");
const SHOULD_CLEANUP = getArg("cleanup", "false") === "true";

// Solution code for target problems
const SOLUTIONS = {
  FizzBuzz: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) System.out.println("FizzBuzz");
            else if (i % 3 == 0) System.out.println("Fizz");
            else if (i % 5 == 0) System.out.println("Buzz");
            else System.out.println(i);
        }
        sc.close();
    }
}`,
  "Two Sum": `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) {
            nums[i] = sc.nextInt();
        }
        int target = sc.nextInt();
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < n; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println(map.get(complement) + " " + i);
                return;
            }
            map.put(nums[i], i);
        }
        sc.close();
    }
}`
};

// Helper: Bulletproof Concurrency worker pool
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const i = currentIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = null;
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

// Helper: Metrics stats calculation
function calculateStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const percentile = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}

async function runLoadTest() {
  const testRunId = Date.now();
  console.log("================================================================================");
  console.log(`🚀 STARTING LOAD TEST: ${TOTAL_CANDIDATES} CANDIDATES (Concurrency: ${CONCURRENCY_LIMIT})`);
  console.log(`🎯 Target Problem: "${TARGET_PROBLEM_TITLE}"`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`⏱️  Timestamp: ${new Date(testRunId).toISOString()}`);
  console.log("================================================================================\n");

  const overallStartTime = Date.now();
  const metrics = {
    candidateCreation: [],
    assignment: [],
    login: [],
    submission: [],
    interviewComplete: [],
    reportFetch: [],
    errors: [],
  };

  // 1. Admin Authentication
  console.log("👉 Stage 1: Authenticating Admin...");
  const adminLoginStart = Date.now();
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const adminData = await adminRes.json();
  if (!adminData.token) {
    console.error("❌ Admin login failed:", adminData);
    process.exit(1);
  }
  const adminToken = adminData.token;
  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
  console.log(`✓ Admin authenticated in ${Date.now() - adminLoginStart}ms\n`);

  // 2. Problem Lookup
  console.log("👉 Stage 2: Finding Target Problem...");
  const probsRes = await fetch(`${BASE_URL}/problems`, { headers: adminHeaders });
  const probs = await probsRes.json();
  const targetProblem = probs.find((p) => p.title.toLowerCase() === TARGET_PROBLEM_TITLE.toLowerCase()) || probs[0];
  if (!targetProblem) {
    console.error("❌ Problem not found!");
    process.exit(1);
  }
  console.log(`✓ Selected Problem: "${targetProblem.title}" (ID: ${targetProblem._id}, Difficulty: ${targetProblem.difficulty})\n`);

  const solutionCode = SOLUTIONS[targetProblem.title] || SOLUTIONS.FizzBuzz;

  // 3. Candidate Creation (50 candidates via Admin API)
  console.log(`👉 Stage 3: Creating ${TOTAL_CANDIDATES} Test Candidates via Admin API...`);
  const candidatesData = [];
  for (let i = 1; i <= TOTAL_CANDIDATES; i++) {
    const num = String(i).padStart(3, "0");
    candidatesData.push({
      index: i,
      name: `LoadTest Candidate ${num}`,
      email: `loadtest_${testRunId}_${num}@loadtest.codearena.io`,
      password: "TestPassword123!",
    });
  }

  const createdCandidates = await mapConcurrent(candidatesData, CONCURRENCY_LIMIT, async (c) => {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/admin/candidates`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          name: c.name,
          email: c.email,
          password: c.password,
        }),
      });
      const data = await res.json();
      const elapsed = Date.now() - start;
      metrics.candidateCreation.push(elapsed);
      if (res.status === 201) {
        if (c.index % 10 === 0 || c.index === TOTAL_CANDIDATES) {
          console.log(`  - [${c.index}/${TOTAL_CANDIDATES}] Created: ${c.name} (${elapsed}ms)`);
        }
        return { ...c, id: data._id, candidateObj: data };
      } else {
        metrics.errors.push(`Candidate creation failed for ${c.email}: ${data.message}`);
        return null;
      }
    } catch (err) {
      metrics.errors.push(`Candidate creation error for ${c.email}: ${err.message}`);
      return null;
    }
  });

  const validCandidates = createdCandidates.filter(Boolean);
  console.log(`✓ Successfully created ${validCandidates.length}/${TOTAL_CANDIDATES} candidates.\n`);

  // 4. Assign Problem to Each Candidate
  console.log(`👉 Stage 4: Assigning "${targetProblem.title}" to ${validCandidates.length} Candidates...`);
  const assignedCandidates = await mapConcurrent(validCandidates, CONCURRENCY_LIMIT, async (c) => {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/admin/assignments`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          candidateId: c.id,
          assessmentId: targetProblem._id,
          dueDate: new Date(Date.now() + 7 * 86400000),
        }),
      });
      const data = await res.json();
      const elapsed = Date.now() - start;
      metrics.assignment.push(elapsed);
      if (res.status === 201) {
        if (c.index % 10 === 0 || c.index === TOTAL_CANDIDATES) {
          console.log(`  - [${c.index}/${TOTAL_CANDIDATES}] Assigned: ${c.name} (${elapsed}ms)`);
        }
        return { ...c, assignmentId: data._id };
      } else {
        metrics.errors.push(`Assignment failed for ${c.email}: ${data.message}`);
        return null;
      }
    } catch (err) {
      metrics.errors.push(`Assignment error for ${c.email}: ${err.message}`);
      return null;
    }
  });

  const validAssigned = assignedCandidates.filter(Boolean);
  console.log(`✓ Successfully assigned problem to ${validAssigned.length} candidates.\n`);

  // 5. Candidate Authentication (Login)
  console.log(`👉 Stage 5: Logging in ${validAssigned.length} Candidates to obtain tokens...`);
  const authenticatedCandidates = await mapConcurrent(validAssigned, CONCURRENCY_LIMIT, async (c) => {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c.email, password: c.password }),
      });
      const data = await res.json();
      const elapsed = Date.now() - start;
      metrics.login.push(elapsed);
      if (res.status === 200 && data.token) {
        return { ...c, token: data.token };
      } else {
        metrics.errors.push(`Login failed for ${c.email}: ${data.message}`);
        return null;
      }
    } catch (err) {
      metrics.errors.push(`Login error for ${c.email}: ${err.message}`);
      return null;
    }
  });

  const validTokens = authenticatedCandidates.filter(Boolean);
  console.log(`✓ Successfully authenticated ${validTokens.length} candidates.\n`);

  // 6. Question Solving & Code Submission via BullMQ
  console.log(`👉 Stage 6: Solving Question & Submitting Code for ${validTokens.length} Candidates...`);
  const submissionResults = await mapConcurrent(validTokens, CONCURRENCY_LIMIT, async (c) => {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.token}`,
        },
        body: JSON.stringify({
          code: solutionCode,
          problemId: targetProblem._id,
          language: "java",
        }),
      });
      const data = await res.json();
      const elapsed = Date.now() - start;
      metrics.submission.push(elapsed);
      const submissionId = data.submission?._id || data._id;
      if (res.status === 201 && data.status === "Accepted") {
        if (c.index % 10 === 0 || c.index === TOTAL_CANDIDATES) {
          console.log(`  - [${c.index}/${TOTAL_CANDIDATES}] Solved: ${c.name} (Status: ${data.status}, Score: ${data.currentScore || 100}, Queue & Exec: ${elapsed}ms)`);
        }
        return { ...c, submissionId, submission: data };
      } else {
        metrics.errors.push(`Submission failed for ${c.email}: status ${res.status} (${data.message || data.status})`);
        return null;
      }
    } catch (err) {
      metrics.errors.push(`Submission error for ${c.email}: ${err.message}`);
      return null;
    }
  });

  const validSubmissions = submissionResults.filter(Boolean);
  console.log(`✓ Successfully submitted and verified solution for ${validSubmissions.length} candidates.\n`);

  // 7. Interview Completion & Report Generation
  console.log(`👉 Stage 7: Interview Completion & Report Generation for ${validSubmissions.length} Candidates...`);
  const reportResults = await mapConcurrent(validSubmissions, CONCURRENCY_LIMIT, async (c) => {
    const start = Date.now();
    try {
      // Start session
      const startRes = await fetch(`${BASE_URL}/interviews/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.token}`,
        },
        body: JSON.stringify({ submissionId: c.submissionId }),
      });
      const startData = await startRes.json();
      if (!startData._id) {
        metrics.errors.push(`Start interview failed for ${c.email}: ${startData.message}`);
        return null;
      }

      const firstQ = (startData.questions && startData.questions.length > 0) ? startData.questions[0] : { qid: "q1" };

      // Complete interview with answer
      const completeRes = await fetch(`${BASE_URL}/interviews/${startData._id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.token}`,
        },
        body: JSON.stringify({
          answers: [
            {
              qid: firstQ.qid,
              answer: "The solution implements a loop from 1 to n with modular arithmetic conditions to output Fizz, Buzz, or FizzBuzz.",
              answerType: "typed",
            },
          ],
        }),
      });
      const completeData = await completeRes.json();
      const elapsed = Date.now() - start;
      metrics.interviewComplete.push(elapsed);

      if (completeRes.status === 200 && completeData.status === "completed") {
        if (c.index % 10 === 0 || c.index === TOTAL_CANDIDATES) {
          console.log(`  - [${c.index}/${TOTAL_CANDIDATES}] Assessment Completed: ${c.name} (Score: ${completeData.overallScore}, Time: ${elapsed}ms)`);
        }
        return { ...c, sessionId: startData._id, sessionResult: completeData };
      } else {
        metrics.errors.push(`Complete interview failed for ${c.email}: status ${completeRes.status} (${completeData.message})`);
        return null;
      }
    } catch (err) {
      metrics.errors.push(`Interview flow error for ${c.email}: ${err.message}`);
      return null;
    }
  });

  const validCompleted = reportResults.filter(Boolean);
  console.log(`✓ Successfully completed interview & assessment for ${validCompleted.length} candidates.\n`);

  // 8. Retrieve Generated Reports via Admin API
  console.log("👉 Stage 8: Verifying Generated Reports in Admin Reports API...");
  const reportFetchStart = Date.now();
  const reportsRes = await fetch(`${BASE_URL}/admin/reports?limit=100`, { headers: adminHeaders });
  const reportsData = await reportsRes.json();
  const fetchDuration = Date.now() - reportFetchStart;
  metrics.reportFetch.push(fetchDuration);

  const allReports = reportsData.reports || [];
  const matchedReports = validCompleted.map((c) => {
    return allReports.find((r) => r.user?._id === c.id || r.user?.email === c.email);
  }).filter(Boolean);

  console.log(`✓ Verified ${matchedReports.length}/${validCompleted.length} reports successfully retrieved via Admin Reports API.`);

  // 9. Optional Teardown / Cleanup
  if (SHOULD_CLEANUP) {
    console.log("\n👉 Stage 9: Deactivating Test Candidates (Cleanup enabled)...");
    await mapConcurrent(validCandidates, CONCURRENCY_LIMIT, async (c) => {
      try {
        await fetch(`${BASE_URL}/admin/candidates/${c.id}`, {
          method: "DELETE",
          headers: adminHeaders,
        });
      } catch (err) {
        // silent cleanup
      }
    });
    console.log("✓ Cleanup finished.");
  }

  // 10. Performance Analysis & Report Summary
  const totalDuration = Date.now() - overallStartTime;
  const candStats = calculateStats(metrics.candidateCreation);
  const assignStats = calculateStats(metrics.assignment);
  const loginStats = calculateStats(metrics.login);
  const subStats = calculateStats(metrics.submission);
  const intStats = calculateStats(metrics.interviewComplete);

  console.log("\n================================================================================");
  console.log("📊 LOAD TEST EXECUTION SUMMARY");
  console.log("================================================================================");
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`👥 Candidates Attempted: ${TOTAL_CANDIDATES}`);
  console.log(`✅ Candidates Created: ${validCandidates.length} (${(validCandidates.length / TOTAL_CANDIDATES * 100).toFixed(1)}%)`);
  console.log(`📋 Assignments Created: ${validAssigned.length}`);
  console.log(`💻 Solutions Accepted: ${validSubmissions.length}`);
  console.log(`📄 Reports Generated: ${validCompleted.length}`);
  console.log(`🔍 Reports Verified: ${matchedReports.length}`);
  console.log(`⚡ Concurrency Pool: ${CONCURRENCY_LIMIT}`);
  console.log("\n📈 LATENCY BENCHMARKS (ms):");
  console.log("--------------------------------------------------------------------------------");
  console.log(`| Stage                      | Min   | Avg   | P50   | P90   | P95   | Max   |`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`| 1. Candidate Creation      | ${candStats.min.toString().padEnd(5)} | ${candStats.avg.toString().padEnd(5)} | ${candStats.p50.toString().padEnd(5)} | ${candStats.p90.toString().padEnd(5)} | ${candStats.p95.toString().padEnd(5)} | ${candStats.max.toString().padEnd(5)} |`);
  console.log(`| 2. Problem Assignment      | ${assignStats.min.toString().padEnd(5)} | ${assignStats.avg.toString().padEnd(5)} | ${assignStats.p50.toString().padEnd(5)} | ${assignStats.p90.toString().padEnd(5)} | ${assignStats.p95.toString().padEnd(5)} | ${assignStats.max.toString().padEnd(5)} |`);
  console.log(`| 3. Candidate Login         | ${loginStats.min.toString().padEnd(5)} | ${loginStats.avg.toString().padEnd(5)} | ${loginStats.p50.toString().padEnd(5)} | ${loginStats.p90.toString().padEnd(5)} | ${loginStats.p95.toString().padEnd(5)} | ${loginStats.max.toString().padEnd(5)} |`);
  console.log(`| 4. Code Submission & Exec  | ${subStats.min.toString().padEnd(5)} | ${subStats.avg.toString().padEnd(5)} | ${subStats.p50.toString().padEnd(5)} | ${subStats.p90.toString().padEnd(5)} | ${subStats.p95.toString().padEnd(5)} | ${subStats.max.toString().padEnd(5)} |`);
  console.log(`| 5. Interview & Report Gen  | ${intStats.min.toString().padEnd(5)} | ${intStats.avg.toString().padEnd(5)} | ${intStats.p50.toString().padEnd(5)} | ${intStats.p90.toString().padEnd(5)} | ${intStats.p95.toString().padEnd(5)} | ${intStats.max.toString().padEnd(5)} |`);
  console.log("--------------------------------------------------------------------------------");

  if (metrics.errors.length > 0) {
    console.log(`\n⚠️  Encountered ${metrics.errors.length} Warnings/Errors:`);
    metrics.errors.slice(0, 5).forEach((e) => console.log(`   - ${e}`));
    if (metrics.errors.length > 5) console.log(`   ... and ${metrics.errors.length - 5} more.`);
  } else {
    console.log("\n🎉 ZERO ERRORS ENCOUNTERED DURING FULL LOAD TEST!");
  }
  console.log("================================================================================\n");

  // Save results markdown file
  const reportPath = path.join(__dirname, `load_test_results_${testRunId}.md`);
  const markdownReport = `# Load Test Results - ${TOTAL_CANDIDATES} Candidates

- **Date:** ${new Date(testRunId).toISOString()}
- **Target Problem:** ${targetProblem.title} (ID: ${targetProblem._id})
- **Total Candidates:** ${TOTAL_CANDIDATES}
- **Concurrency Limit:** ${CONCURRENCY_LIMIT}
- **Total Duration:** ${(totalDuration / 1000).toFixed(2)}s
- **Success Rate:** ${(validCompleted.length / TOTAL_CANDIDATES * 100).toFixed(1)}%

## Latency Summary (ms)

| Stage | Min | Avg | P50 | P90 | P95 | Max |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Candidate Creation | ${candStats.min} | ${candStats.avg} | ${candStats.p50} | ${candStats.p90} | ${candStats.p95} | ${candStats.max} |
| Problem Assignment | ${assignStats.min} | ${assignStats.avg} | ${assignStats.p50} | ${assignStats.p90} | ${assignStats.p95} | ${assignStats.max} |
| Candidate Login | ${loginStats.min} | ${loginStats.avg} | ${loginStats.p50} | ${loginStats.p90} | ${loginStats.p95} | ${loginStats.max} |
| Code Submission & Execution | ${subStats.min} | ${subStats.avg} | ${subStats.p50} | ${subStats.p90} | ${subStats.p95} | ${subStats.max} |
| Interview & Report Generation | ${intStats.min} | ${intStats.avg} | ${intStats.p50} | ${intStats.p90} | ${intStats.p95} | ${intStats.max} |

## Error Count: ${metrics.errors.length}
`;
  fs.writeFileSync(reportPath, markdownReport, "utf-8");
  console.log(`📄 Markdown benchmark report saved to: ${reportPath}`);
}

runLoadTest().catch((err) => {
  console.error("Fatal error during load test:", err);
  process.exit(1);
});
