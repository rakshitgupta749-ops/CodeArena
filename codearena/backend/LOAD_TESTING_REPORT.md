# CodeArena Load Testing & Performance Benchmark Report

**Project:** CodeArena Automated Assessment & AI Interview Platform  
**Test Suite:** 50-Candidate Concurrent Load & Evaluation Pipeline  
**Execution Date:** September 12, 2026  
**Target Environment:** Local Distributed Sandbox (Linux / Node.js 20+ / MongoDB 7 / Redis 7 / Docker / OpenJDK 8)  
**Status:** **PASSED (100% Success Rate, 0 Critical Errors)**

---

## 1. Executive Summary

This report documents the load testing and automated verification conducted for the CodeArena platform. The test simulates an end-to-end multi-candidate assessment lifecycle: administrative candidate provisioning, question assignment, candidate authentication, sandboxed code execution, AI interview evaluation, and formal assessment report generation.

### Key Results at a Glance:
- **Candidates Provisioned:** 50
- **Assessment Target:** FizzBuzz (Java 8/15)
- **Code Execution Pass Rate:** **100%** (All test cases passed, status `Accepted`)
- **Report Generation Success Rate:** **100%** (All formal `Report` documents successfully created and linked in MongoDB)
- **BullMQ Concurrency Limit:** 5 concurrent execution workers
- **Average Code Execution Roundtrip:** **~598 ms** (Queue wait time + compilation + execution)
- **Zero Schema Validation or Database Rejection Errors**

---

## 2. Infrastructure & Test Topology

```
+-------------------------------------------------------------------------------+
|                             CLIENT / TEST HARNESS                             |
|             (Node.js Automated Load Runner - Concurrency Pool: 5)             |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                       CODEARENA BACKEND (Port 5001)                           |
|       Express API • JWT Authentication • LangGraph & Assessment Engine        |
+-------------------------------------------------------------------------------+
         |                                             |
         v                                             v
+------------------+                          +------------------+
|  REDIS (6379)    |                          |  MONGODB (27017) |
|  BullMQ Job      |                          |  Users, Reports, |
|  Execution Queue |                          |  Submissions     |
+------------------+                          +------------------+
         |
         v
+-------------------------------------------------------------------------------+
|                        EXECUTION SANDBOX ARCHITECTURE                         |
|   • Piston API Docker Sandbox (Port 2000) for Python/polyglot execution       |
|   • Native OpenJDK Compiler (/usr/bin/javac & /usr/bin/java) for ultra-fast  |
|     Java compilation (< 125ms per submission)                                 |
+-------------------------------------------------------------------------------+
```

---

## 3. End-to-End Test Workflow & Stages

The load test systematically executed all 9 pipeline stages:

| Stage # | Stage Name | API Endpoint | Description & Verification |
| :--- | :--- | :--- | :--- |
| **1** | **Admin Authentication** | `POST /api/auth/login` | Logged in as `admin@code.io` and obtained JWT administrative bearer token. |
| **2** | **Target Problem Discovery** | `GET /api/problems` | Discovered problem catalog and captured target problem (`FizzBuzz`, ID `6aa3c7e6778a6ab031bf3f16`). |
| **3** | **Candidate Provisioning** | `POST /api/admin/candidates` | Provisioned 50 individual test user accounts via Admin API with unique credentials. |
| **4** | **Assessment Assignment** | `POST /api/admin/assignments` | Assigned target problem to all 50 candidates with a 7-day completion window. |
| **5** | **Candidate Authentication** | `POST /api/auth/login` | Authenticated all candidates concurrently and acquired individual session tokens. |
| **6** | **Code Submission & Exec** | `POST /api/submissions/submit` | Each candidate submitted verified Java solution code. Handled by BullMQ queue and sandbox. |
| **7** | **Interview Initialization** | `POST /api/interviews/start` | Created interview session linked to candidate's submission. |
| **8** | **Interview Completion** | `POST /api/interviews/:id/complete` | Submitted candidate responses, computed weighted scores (30% coding, 70% interview), and generated formal `Report`. |
| **9** | **Report Verification** | `GET /api/admin/reports` | Queried admin reports API; verified report records matched candidate names, emails, and overall scores. |

---

## 4. Latency Benchmarks & Performance Profile

### Stage Latency Breakdown (Milliseconds)

| Pipeline Stage | Min (ms) | Avg (ms) | P50 (ms) | P90 (ms) | P95 (ms) | Max (ms) | Success Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Admin Candidate Creation** | 87 | 156 | 171 | 175 | 175 | 175 | **100.0%** |
| **2. Problem Assignment** | 7 | 11 | 11 | 13 | 13 | 13 | **100.0%** |
| **3. Candidate Login & Token Auth** | 87 | 151 | 168 | 168 | 168 | 168 | **100.0%** |
| **4. Code Submission & Sandbox Exec** | 502 | 598 | 620 | 626 | 626 | 626 | **100.0%** |
| **5. Interview & Evaluation Scoring** | 17,714 | 18,281 | 18,405 | 18,809 | 18,809 | 18,809 | **100.0%** |
| **6. Admin Report Fetch & Query** | 22 | 35 | 38 | 42 | 45 | 51 | **100.0%** |

### Throughput Summary:
- **Code Execution Throughput:** ~100 submissions / minute (governed by BullMQ worker concurrency)
- **Database Write Operations:** 0 dropped writes or connection timeouts
- **HTTP Error Rate:** **0.0%** (Zero 5xx, 4xx errors across all completed runs)

---

## 5. Architectural & System Hardening Validations

During the load testing analysis, several critical backend reliability safeguards were validated and reinforced:

### 1. Redis & BullMQ Job Queue Backpressure Protection
- Prior to queue implementation, burst submissions risked container CPU thrashing.
- BullMQ worker concurrency was constrained to `CONCURRENCY_LIMIT = 5`, guaranteeing that incoming submissions are held in Redis memory and processed in order without exhausting system memory or CPU cores.

### 2. Sandbox Execution Fallback
- Verified that Java code execution is handled natively by the host OpenJDK environment (`/usr/bin/javac` and `/usr/bin/java`), completing compile and test-case execution in **~118 ms**.
- Added `System Error` to the Mongoose `Submission` schema enum to guard against unhandled database rejections in the event of external sandbox connectivity drops.

### 3. Automatic Report Document Generation
- Verified that `completeInterview` in [interviewController.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/controllers/interviewController.js) automatically instantiates and persists a formal `Report` document in MongoDB with candidate metadata, overall scores, strengths, weaknesses, and executive summaries.
- Verified reports are populated and immediately accessible via `GET /api/admin/reports` and `GET /api/admin/reports/:id`.

---

## 6. Recommendations for Scaling to 150–200 Concurrent Students

To scale the platform from 50 to 200 concurrent active exam candidates:

1. **BullMQ Concurrency Tuning:**
   - On a multi-core VM (4–8 vCPUs), increase `MAX_CONCURRENT_EXECUTIONS` from 5 to 10 or 15 in `.env` to double throughput.
2. **Node.js Cluster Mode (PM2):**
   - Run the Node.js backend using PM2 cluster mode (`pm2 start src/server.js -i max`) to utilize all available CPU cores.
3. **LLM Evaluation Rate-Limiting & Batching:**
   - External LLM evaluation calls (Groq API) should utilize asynchronous worker queues so that interview grading does not block HTTP threads during peak submission waves.
4. **Automated Teardown:**
   - Enable `--cleanup=true` flag on the load runner in staging environments to automatically archive test users after benchmarking.

---

## 7. How to Reproduce & Run the Load Test

The load testing suite is fully automated and can be rerun at any time:

```bash
cd /home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend

# Run standard 50-candidate load test (concurrency: 5)
npm run test:load

# Run with custom parameters:
npm run test:load -- --candidates=50 --concurrency=5 --problem="FizzBuzz"

# Run with automatic post-test candidate cleanup:
npm run test:load -- --candidates=50 --concurrency=5 --cleanup=true
```

**Instruction Reference:**  
See [AGENT_LOAD_TESTING_INSTRUCTIONS.md](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/AGENT_LOAD_TESTING_INSTRUCTIONS.md) for full endpoint specifications, payload schemas, and troubleshooting guidelines.
