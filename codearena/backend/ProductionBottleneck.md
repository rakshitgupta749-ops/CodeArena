# CodeArena Production Bottleneck & Architecture Audit

**Document:** Production Bottleneck Analysis & Hardening Roadmap  
**Target Scale:** 150 – 200 concurrent active exam candidates  
**Status:** Audit Complete — Action Plan Defined  

---

## 1. Executive Summary

While the platform successfully passed benchmark testing with 50 candidates in a controlled environment, auditing the architecture reveals **7 major bottlenecks and security hazards** that prevent it from being production-ready.

Most critically:
1. **Java code execution is running natively on the host Linux OS with zero sandboxing**, allowing arbitrary Remote Code Execution (RCE), host compromise, environment secret theft, and Denial of Service (fork bombs / memory exhaustion).
2. **Synchronous HTTP waiting patterns** on both code compilation (`waitUntilFinished`) and LLM evaluation (18+ seconds per candidate) will cause reverse proxy timeouts (`504 Gateway Timeout`) and rate-limit drops (`429 Too Many Requests`) under high concurrency.
3. **Single-threaded Node.js execution** without process clustering or worker segregation will result in event-loop freezing during peak submission waves.

---

## 2. Comprehensive Bottleneck Breakdown

```
+--------------------------------------------------------------------------------------------------+
|                                    CURRENT ARCHITECTURAL RISKS                                    |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   1. SECURITY & RCE RISK       2. SYNCHRONOUS HTTP TIMEOUT      3. LLM EVALUATION BOTTLENECK     |
|   Host javac/java execution    BullMQ waitUntilFinished()       18.3s synchronous HTTP call      |
|   No sandbox / no cgroups      Holds connection open            Causes 504 gateway timeout       |
|   Risk of server takeover      Risks 504 timeouts at >50 users  Groq 429 TPM/RPM rate limits     |
|                                                                                                  |
|   4. EVENT LOOP BLOCKING       5. DISK I/O SATURATION           6. DATABASE QUERY OVERHEAD       |
|   Single Node.js thread        Heavy /tmp file creation         Global pre(/^find/) populates    |
|   Workers share web process    Risk of ENOSPC disk fills        Missing compound indexes         |
|   Heavy CPU blocks API         Slows down under 200 runs        Spikes MongoDB connection pool   |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

### Bottleneck 1: Host-Level Java Code Execution (Critical Security & Resource Hazard)

* **Current Implementation:** [javaExecutor.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/services/javaExecutor.js#L22-L48)
  - Java source code is saved to `/tmp/codearena-*` and compiled/run directly using `child_process.spawn("javac")` and `spawn("java")`.
* **Why It Is Not Production-Ready:**
  1. **Remote Code Execution (RCE):**
     There is **zero isolation, zero chroot, and zero sandbox**. A candidate can submit malicious Java code:
     ```java
     // Read backend secrets (.env, database passwords, JWT secrets):
     String envSecrets = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(".env")));
     
     // Execute arbitrary shell commands on host:
     Runtime.getRuntime().exec("rm -rf /");
     ```
  2. **Fork Bombs & Host Crash:**
     Submitting `while(true) new Thread(...).start();` spawns infinite OS threads, exhausting PIDs and crashing the host Linux operating system.
  3. **Memory Exhaustion (OOM Killer):**
     No memory limits (e.g. `-Xmx64m`) are passed to the JVM. Submitting `byte[] arr = new byte[Integer.MAX_VALUE]` forces Linux Out-Of-Memory (OOM) killer to terminate background services like `mongod`, `redis-server`, or the Node.js backend.
  4. **JVM Spin-up Overhead:**
     Each compilation starts a full JVM for `javac` consuming 100–200 MB of RAM. 20 concurrent compilations consume 2–4 GB RAM solely for compiler processes.
* **Production Fix:**
  - Route Java submissions into an isolated Docker sandbox container (e.g., Piston with `isolate` or Judge0).
  - Apply strict kernel-level limits: `--memory=128m --cpus=0.5 --pids-limit=64 --net=none --read-only`.

---

### Bottleneck 2: Synchronous HTTP Waiting on Asynchronous BullMQ (`waitUntilFinished`)

* **Current Implementation:** [submissionController.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/controllers/submissionController.js#L94-L99) and [codeExecutionQueue.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/queues/codeExecutionQueue.js#L18-L34)
  ```javascript
  const job = await codeExecutionQueue.add("runCode", { code, testCases, language });
  const result = await job.waitUntilFinished(queueEvents); // Synchronously holds HTTP connection!
  ```
* **Why It Is A Bottleneck:**
  - While BullMQ correctly throttles worker concurrency to 5, the Express HTTP request handler **sleeps and blocks waiting for the job to finish**.
  - If 150 candidates click "Submit" simultaneously and concurrency is 5:
    - Candidate #150 waits `(150 / 5) * 1s = 30 seconds` before receiving an HTTP response.
  - Browser timeouts, NGINX reverse proxies, and Cloudflare default to 30–60s timeouts, dropping the connection with **`504 Gateway Timeout`**. The student sees an error screen even though the job eventually executes in Redis.
* **Production Fix:**
  - Implement an **asynchronous submission pattern** (industry standard used by LeetCode / HackerRank):
    1. `POST /api/submissions/submit` immediately saves a `Pending` submission and returns `202 Accepted` with `{ submissionId: "..." }`.
    2. Candidate frontend polls `GET /api/submissions/:id/status` or receives updates via Server-Sent Events (SSE) / WebSocket.

---

### Bottleneck 3: Synchronous LLM Latency & External Rate Limits (Groq 429 Errors)

* **Current Implementation:** [interviewController.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/controllers/interviewController.js#L865)
  - `completeInterview` calls `generateOverallReport` and batch evaluations synchronously inside the request handler.
  - Benchmark measurements show this single stage takes **18,281 ms (18.3 seconds) on average** per candidate.
* **Why It Is A Bottleneck:**
  - **Connection Exhaustion:** When 150 candidates finish an exam around the same deadline, 150 HTTP connections remain open simultaneously for 20+ seconds, saturating socket pools.
  - **Provider Rate Limits (`429 Too Many Requests`):** Third-party LLM APIs (Groq / OpenAI) enforce strict Tokens-Per-Minute (TPM) and Requests-Per-Minute (RPM) limits. 150 simultaneous multi-turn evaluation prompts will exhaust quotas, causing evaluations to fail or fall back to empty reports.
* **Production Fix:**
  - Move interview evaluation and report generation into a dedicated BullMQ queue (`interview-evaluation-queue`) with worker concurrency capped at 5–8 and exponential backoff retry.
  - Return `200 OK` immediately: `{ status: "evaluating" }`, and redirect candidate to a live progress screen.

---

### Bottleneck 4: Single-Threaded Node.js Process (No Clustering)

* **Current Implementation:** [server.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/server.js#L9)
  - The application runs as a single Node process (`node src/server.js`), utilizing only 1 CPU core.
  - BullMQ workers and the Express HTTP API share the exact same event loop.
* **Why It Is A Bottleneck:**
  - Heavy CPU operations (evidence graph extraction in `evidenceEngine.js`, AST analysis, JSON parsing, diffing test outputs) block the single Node.js event loop.
  - If the event loop freezes for 1.5 seconds, all 150 connected clients experience dropped pings and frozen interfaces.
  - If an unhandled fatal error occurs in a worker, the entire web server crashes for all active examinees.
* **Production Fix:**
  - Run the Express backend using **PM2 Cluster Mode**:
    ```bash
    pm2 start src/server.js -i max --name codearena-api
    ```
  - Separate BullMQ workers into their own dedicated background worker process (`src/workers/codeWorker.js`) so execution workloads never share CPU threads with web routing.

---

### Bottleneck 5: Memory & Temp Disk I/O Saturation

* **Current Implementation:** [javaExecutor.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/services/javaExecutor.js#L14-L20)
  ```javascript
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codearena-"));
  ```
* **Why It Is A Bottleneck:**
  - Disk operations (`mkdtempSync`, `writeFileSync`, `.class` generation, `rmSync`) under 200 concurrent runs create severe disk I/O bottlenecks.
  - If a child process is aborted or Node crashes before `finally { fs.rmSync }` finishes, temporary folders accumulate in `/tmp`, eventually leading to `ENOSPC: no space left on device` crashes.
* **Production Fix:**
  - Mount temporary compilation workspaces to Linux in-memory tmpfs (`/dev/shm`) or use ephemeral container volumes that are garbage-collected automatically by Docker.

---

### Bottleneck 6: Database Query Overhead & Lack of Compound Indexes

* **Current Implementation:** [Submission.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/models/Submission.js#L55)
  ```javascript
  submissionSchema.pre(/^find/, function () {
    this.populate("user", "name email");
    this.populate("problem", "title");
  });
  ```
* **Why It Is A Bottleneck:**
  - The `pre(/^find/)` hook forces **two extra collection lookups on every single query**, even when only counting submissions or checking status.
  - Core query patterns (e.g. `{ user: 1, problem: 1 }`, `{ candidate: 1, assessment: 1 }`, `{ submittedAt: -1 }`) lack compound database indexes, forcing MongoDB into full collection scans (`COLLSCAN`).
  - High frequency polling by 150 candidates will quickly exhaust the connection pool limit (`maxPoolSize: 150`) in [db.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/config/db.js#L6).
* **Production Fix:**
  - Remove universal `pre(/^find/)` hooks; populate relations explicitly only when rendering full views.
  - Add targeted compound indexes:
    ```javascript
    submissionSchema.index({ user: 1, problem: 1, submittedAt: -1 });
    assignmentSchema.index({ candidate: 1, assessment: 1 });
    interviewSessionSchema.index({ user: 1, submission: 1 });
    ```

---

### Bottleneck 7: Critical Security & Production Hardening Gaps

1. **Disabled SSL/TLS Verification:**
   - In [llmClient.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/services/llmClient.js#L7):
     ```javascript
     process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
     ```
     This disables TLS validation globally, exposing all outbound API communication to Man-in-the-Middle (MITM) attacks.
2. **Missing Security Headers:**
   - The Express app lacks `helmet` middleware, leaving it unprotected against Clickjacking, MIME sniffing, and cross-site scripting (XSS).
3. **Overly Permissive CORS:**
   - In [server.js](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/server.js#L42):
     ```javascript
     res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
     ```
     Reflecting any incoming origin with `Access-Control-Allow-Credentials: true` enables malicious third-party websites to forge authenticated candidate requests.

---

## 3. Prioritized Remediation Roadmap

| Priority | Area | Bottleneck | Remediation Step | Target Metric |
| :--- | :--- | :--- | :--- | :--- |
| 🔴 **P0** | **Sandbox** | Native host Java execution (RCE hazard) | Transition Java execution to containerized Piston sandbox (`--privileged`, `--net=none`, memory limits). | Zero host access; safe student isolation |
| 🔴 **P0** | **Submissions** | Synchronous `waitUntilFinished()` | Return `202 Accepted` immediately; add polling endpoint `GET /api/submissions/:id/status`. | HTTP response time < 50ms |
| 🟠 **P1** | **LLM Evaluation** | Synchronous 18-second HTTP evaluation | Move interview grading & report generation to a background BullMQ queue. | Zero gateway timeouts |
| 🟠 **P1** | **Clustering** | Single-threaded Node.js server | Deploy backend with PM2 cluster mode; separate worker processes from HTTP server. | Utilize 100% of multi-core CPU capacity |
| 🟡 **P2** | **Database** | Missing indexes & global pre-populate | Remove `pre(/^find/)` hooks; add compound indexes on Submissions, Assignments, and Sessions. | MongoDB query time < 10ms (IXSCAN) |
| 🟡 **P2** | **Security** | Permissive CORS, disabled TLS, no helmet | Install `helmet`, enforce strict CORS origin whitelist, re-enable TLS verification. | A+ Security Grade |
