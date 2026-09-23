# Piston Code Execution Engine - Docker Guide

## Overview
This project uses **Piston** as the secure, multi-language code execution sandbox for evaluating student code submissions. Piston spins up isolated, temporary environments to compile and run code (Java, Python, C++, JS, etc.) safely without risking the host server.

This replaces the old insecure `javaExecutor.js` which ran Java natively on the server.

---

## 1. Why Docker and a Custom Mirror?
* **Public API Limitations**: As of early 2026, the public Piston API (`emkc.org`) requires authorization and is strictly whitelist-only. We cannot use it for public, unauthenticated exams.
* **GHCR Restrictions**: The official Piston image is hosted on GitHub Container Registry (`ghcr.io/engineer-man/piston`). In environments where `ghcr.io` is blocked or GitHub is inaccessible, pulling the official image fails.
* **The Solution**: We use a trusted, unofficial Docker Hub mirror of Piston (e.g., `ohmygodvt95/piston` or `ks2515/piston`) which can be pulled without GitHub access.

---

## 2. Running the Piston Container
To start the code execution engine on your local machine or production server, run the following command:

```bash
sudo docker run -d --privileged -p 2000:2000 ohmygodvt95/piston
```

### Important Flags Explained:
* `-d`: Runs the container in the background (detached mode).
* `-p 2000:2000`: Binds the Piston API to port 2000 on the host machine.
* `--privileged`: **CRITICAL**. Piston uses a sandboxing tool called `isolate` internally to safely execute student code. `isolate` requires the ability to create read-only filesystems and manage process capabilities. Without `--privileged`, the container will crash with a `mkdir: cannot create directory 'isolate/': Read-only file system` error.

---

## 3. Backend Integration
Once the Docker container is running, the Node.js backend needs to know where to send the code to be executed.

### Environment Variable (`backend/.env`)
Ensure your `.env` file points to the local Docker container's API endpoint:
```env
PISTON_URL=http://127.0.0.1:2000/api/v2/execute
```

### The Code Executor (`backend/src/services/codeExecutor.js`)
The `submissionController.js` delegates code execution to `codeExecutor.js`. This file:
1. Receives the raw code and test cases.
2. Maps the frontend language selection to Piston's runtime environment (`language` and `version`).
3. Sends an HTTP POST request to the `PISTON_URL`.
4. Parses the `stdout` and `stderr` to determine if the test case Passed, Failed, had a Compilation Error, or Exceeded the Time Limit.

## 4. Troubleshooting
* **Error: fetch failed (Connection Refused)**
  * *Cause*: The Docker container is not running, or it crashed. 
  * *Fix*: Run `sudo docker ps -a` to check if it exited. Restart it using the `--privileged` command above.
* **Code keeps returning "System Error"**
  * *Cause*: The `.env` variable `PISTON_URL` is incorrect. Make sure it includes the full path `/api/v2/execute`.
