Searched for "websocket"
Searched for "socket"
Listed directory codearena
Viewed package.json:1-49
Searched for "WebSocket"
Searched for "EventSource"

### 1. Are We Using WebSockets?

**No, WebSockets are not being used anywhere in this application.**

- **Backend:** The backend uses standard Express 5 HTTP REST endpoints (`POST`, `GET`). There is no WebSocket server library installed (neither `ws` nor `socket.io` in [backend/package.json](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/package.json)).
- **Frontend:** The frontend makes standard HTTP `fetch` / REST calls for all interactions (running code, submitting solutions, answering interview questions, fetching reports). There is no native browser `WebSocket` or Server-Sent Events (`EventSource`) setup.

---

### 2. Are Any Connections Synchronous That Cause Delays When Scaled Up?

**Yes.** There are **two major types of synchronous bottlenecks** in the current code that will cause severe delays, timeouts, and system freezes under scale (150–200 concurrent users).

---

#### Critical Connection Bottlenecks

```
CLIENT (Browser)                     EXPRESS BACKEND                           REDIS / WORKER / LLM
      │                                     │                                            │
      │ ── POST /api/submissions/submit ──► │                                            │
      │                                     │ ── Adds Job to BullMQ ───────────────────► │
      │                                     │                                            │
      │      [ CONNECTION HELD OPEN ]       │ ◄── await job.waitUntilFinished() ──────── │
      │   (Client sits waiting for 30s+)    │     (Blocks HTTP response cycle)           │
      │                                     │                                            │
      │ ◄── 504 Gateway Timeout (NGINX/CDN) │                                            │
```

---

#### Bottleneck A: Synchronous HTTP Waiting on Background Jobs (`waitUntilFinished`)

* **Where:** [submissionController.js (Lines 94–100 and Lines 150–156)](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/controllers/submissionController.js#L94-L100)
* **The Code:**
  ```javascript
  const job = await codeExecutionQueue.add("submitCode", { code, testCases, language });
  const result = await job.waitUntilFinished(queueEvents); // <--- Synchronously waits!
  res.json({ ... });
  ```
* **Why it breaks under scale:**
  - Even though BullMQ has a queue, the Express HTTP handler **refuses to send a response until the worker finishes the entire job**.
  - The worker concurrency is capped at `CONCURRENCY_LIMIT = 5` in [codeExecutionQueue.js:19](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/queues/codeExecutionQueue.js#L19).
  - If **150 candidates** click "Submit" at roughly the same time (e.g., right before an exam ends):
    - 5 jobs run at a time (~600ms per job).
    - Candidate #150 is queued in line and waits:
      $$\frac{150 \text{ jobs}}{5 \text{ concurrent}} \times 600\text{ ms} \approx 18 \text{ to } 30\text{ seconds}$$
    - Because standard reverse proxies (NGINX, AWS ALB, Cloudflare) and browsers default to 30–60s timeouts, candidate connections will be **dropped with `504 Gateway Timeout`**.
    - **Industry Solution:** Return `202 Accepted` immediately with a `{ submissionId }` and let the frontend poll `GET /api/submissions/:id/status` or receive updates via WebSockets/SSE.

---

#### Bottleneck B: Synchronous 18-Second LLM Evaluation HTTP Request

* **Where:** [interviewController.js:completeInterview (Line 865)](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/controllers/interviewController.js#L865)
* **The Problem:**
  - When a student finishes their AI interview, the backend performs multi-turn evaluations and generates an overall report **synchronously inside the HTTP request**.
  - The benchmark data in [LOAD_TESTING_REPORT.md:86](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/LOAD_TESTING_REPORT.md#L86) shows this single endpoint takes **18,281 ms (~18.3 seconds) on average** to return.
* **Why it breaks under scale:**
  - When 150 candidates submit at the end of an assessment window, **150 HTTP connections remain open simultaneously for 18–25 seconds**, exhausting available socket connections.
  - Furthermore, 150 simultaneous multi-turn LLM requests will hit external provider rate limits (**Groq `429 Too Many Requests`**).

---

#### Bottleneck C: Synchronous Disk I/O Blocking the Event Loop

* **Where:** [javaExecutor.js (Lines 14–19 & 108)](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/services/javaExecutor.js#L14-L19)
* **The Code:**
  ```javascript
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codearena-"));
  fs.writeFileSync(sourceFile, code, "utf-8");
  // in finally:
  fs.rmSync(tmpDir, { recursive: true, force: true });
  ```
* **Why it breaks under scale:**
  - `fs.mkdtempSync`, `fs.writeFileSync`, and `fs.rmSync` are **synchronous blocking calls**.
  - They execute directly on Node’s single main thread. While writing or deleting directories on disk, the Node.js event loop is completely paused.
  - Under 150 concurrent runs, continuous synchronous disk I/O creates event-loop lag, delaying response times for all other API endpoints.

---

#### Bottleneck D: IP-Based Rate Limiter in Multi-User Environments

* **Where:** [server.js (Lines 33–38)](file:///home/labuser/Desktop/Project/3207854-CodeArena/3207854-CodeArena_v01/codearena/backend/src/server.js#L33-L38)
* **The Code:**
  ```javascript
  const codeExecutionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20, // max 20 per minute per IP
  });
  app.use("/api/submissions", codeExecutionLimiter);
  ```
* **Why it breaks under scale:**
  - In an on-campus or lab assessment, **all 150 candidates share the same public NAT/gateway IP**.
  - All 150 students compete for a single pool of 20 requests/minute. After the 20th submission across the entire exam hall, every subsequent candidate gets blocked with:
    `"Too many code executions, please try again in a minute."`

---

### Summary

1. **WebSockets:** Not used. Everything is currently standard HTTP polling / request-response.
2. **Synchronous Delays:**
   - **`job.waitUntilFinished()`** holds client connections open while waiting on a 5-worker queue (up to 30s delay under 150 users).
   - **`completeInterview`** blocks the client connection for **18+ seconds** per request doing LLM evaluation.
   - **`fs.*Sync`** methods block the Node.js event loop during disk operations.