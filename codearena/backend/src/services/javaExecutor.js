const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Execute Java code against test cases.
 *
 * @param {string} code - The Java source code
 * @param {Array<{input: string, expectedOutput: string}>} testCases - Test cases to run
 * @returns {Promise<{status: string, results: Array, executionTime: string, compileError?: string}>}
 */
async function executeJava(code, testCases) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codearena-"));
  const sourceFile = path.join(tmpDir, "Solution.java");

  try {
    // Write source code
    fs.writeFileSync(sourceFile, code, "utf-8");

    // Compile
    const compileResult = await runProcess("javac", [sourceFile], {
      cwd: tmpDir,
      timeout: 10000,
    });

    if (compileResult.exitCode !== 0) {
      return {
        status: "Compilation Error",
        results: [],
        executionTime: "0ms",
        compileError: compileResult.stderr || compileResult.stdout,
      };
    }

    // Run each test case
    const results = [];
    let totalTime = 0;
    let overallStatus = "Accepted";

    for (const tc of testCases) {
      const startTime = Date.now();

      const runResult = await runProcess("java", ["-cp", tmpDir, "Solution"], {
        cwd: tmpDir,
        timeout: 10000,
        stdin: tc.input,
      });

      const elapsed = Date.now() - startTime;
      totalTime += elapsed;

      if (runResult.timedOut) {
        overallStatus = "Time Limit Exceeded";
        results.push({
          passed: false,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: "Time Limit Exceeded",
        });
        continue;
      }

      if (runResult.exitCode !== 0) {
        overallStatus = "Runtime Error";
        results.push({
          passed: false,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: runResult.stderr || "Runtime Error",
        });
        continue;
      }

      const normalizeOutput = (str) => {
        return (str || "")
          .replace(/\r\n/g, "\n")
          .split("\n")
          .map((line) => line.trimEnd())
          .join("\n")
          .trim();
      };

      const actualOutput = normalizeOutput(runResult.stdout);
      const expectedOutput = normalizeOutput(tc.expectedOutput);
      const passed = actualOutput === expectedOutput;

      if (!passed && overallStatus === "Accepted") {
        overallStatus = "Wrong Answer";
      }

      results.push({
        passed,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: runResult.stdout || "",
      });
    }

    return {
      status: overallStatus,
      results,
      executionTime: `${totalTime}ms`,
    };
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Spawn a child process and capture output.
 */
function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const { timeout = 10000, stdin, cwd } = options;
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Send stdin if provided
    if (stdin !== undefined && stdin !== null) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
      resolve({ stdout, stderr, exitCode: 1, timedOut: true });
    }, timeout);

    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, exitCode: 1, timedOut: false });
    });
  });
}

module.exports = { executeJava };
