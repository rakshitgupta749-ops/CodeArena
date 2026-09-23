# Production Bottleneck Analysis
**Target:** 150 - 200 concurrent users taking an active, AI-driven coding exam.

Based on an audit of the current architecture and `package.json`, the system is fully functional for small-scale testing but has **4 critical bottlenecks** that will cause it to crash under the load of 200 simultaneous students.

---

## 1. Piston Sandbox Overload (The Biggest Threat)
Currently, when a student hits "Submit", the Node.js backend immediately forwards the request to the Piston Docker container.
* **The Bottleneck**: If 100 students hit submit within the same 5-second window, Piston will try to spin up 100 isolated Java/Python environments simultaneously on the server. This will spike your server's CPU to 100% and exhaust your RAM, crashing the entire VM.
* **The Solution**: We need to implement a **Job Queue** (like `BullMQ` using Redis). Instead of executing immediately, submissions are added to a queue. The queue then processes them sequentially with a strict concurrency limit (e.g., max 5 to 10 executions at a time).

## 2. In-Memory State & Lack of Clustering
To comfortably handle 200 concurrent WebSocket/HTTP connections parsing heavy AI payloads, your Node.js backend should run in **Cluster Mode** (using `PM2` to spawn 1 process per CPU core).
* **The Bottleneck**: Currently, things like LangGraph AI conversation states are likely being held in Node.js memory. If you run multiple Node instances, they won't share this memory. User A might hit Server 1 and then Server 2, losing their interview context.
* **The Solution**: Introduce **Redis**. Redis will act as a centralized, ultra-fast shared memory store for chat history, interview state, and the BullMQ job queue.

## 3. Third-Party AI Rate Limits (429 Errors)
You are using the Groq API (`genailab-maas-gpt-4o`) for questions and evaluations.
* **The Bottleneck**: 200 students asking for hints or finishing exams at the same time will trigger a massive burst of requests to Groq. Unless your API key has an enterprise-level rate limit, Groq will block the requests with a `429 Too Many Requests` error, causing the students' exams to fail.
* **The Solution**: Implement exponential backoff (retries) and a concurrency limiter on outgoing AI requests to smooth out the spikes.

## 4. Lack of DDoS & Brute-Force Protection
* **The Bottleneck**: There is currently no rate-limiting middleware (`express-rate-limit`) on the API. A frustrated student could write a script in their browser console to spam the `/execute` or `/chat` endpoint 1,000 times a second. This would bypass your frontend entirely and instantly take down your backend server for all 200 students.
* **The Solution**: Add standard API rate limiting (e.g., max 20 requests per minute per IP for code execution).

---

### Summary of Missing Tech Stack:
To reach true production-grade stability, we need to introduce **Redis** and **BullMQ**, and write a quick **Rate Limiter** middleware.
