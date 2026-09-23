const { executeJava } = require("./javaExecutor");

const PISTON_URL = process.env.PISTON_URL || "http://127.0.0.1:2000/api/v2/execute";

const LANGUAGE_MAP = {
  java: { language: "java", version: "15.0.2" },
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  cpp: { language: "c++", version: "10.2.0" }
};

/**
 * Execute code using Piston API or local executor for Java.
 *
 * @param {string} code - The source code
 * @param {Array<{input: string, expectedOutput: string, isHidden: boolean}>} testCases - Test cases to run
 * @param {string} lang - The language string (e.g., "java", "python")
 * @returns {Promise<{status: string, results: Array, executionTime: string, compileError?: string}>}
 */
async function executeCode(code, testCases, lang = "java") {
  const normalizedLang = String(lang).toLowerCase();

  // If Java, use native host javaExecutor
  if (normalizedLang === "java") {
    try {
      return await executeJava(code, testCases);
    } catch (err) {
      console.error("[codeExecutor] executeJava failed:", err);
      return {
        status: "System Error",
        results: [],
        executionTime: "0ms",
        compileError: `Java execution error: ${err.message}`,
      };
    }
  }

  const langConfig = LANGUAGE_MAP[normalizedLang] || LANGUAGE_MAP.python;

  let overallStatus = "Accepted";
  const results = [];
  let totalTime = 0;
  let compileError = "";

  for (const tc of testCases) {
    const payload = {
      language: langConfig.language,
      version: langConfig.version,
      files: [
        {
          name: normalizedLang === "java" ? "Solution.java" : `main.${getExt(normalizedLang)}`,
          content: code,
        },
      ],
      stdin: tc.input || "",
      compile_timeout: 10000,
      run_timeout: 10000,
    };

    const startTime = Date.now();
    let res;
    try {
      res = await fetch(PISTON_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return {
        status: "System Error",
        results: [],
        executionTime: "0ms",
        compileError: `Could not connect to Piston code execution engine at ${PISTON_URL}. Make sure Docker is running. Error: ${err.message}`,
      };
    }

    const elapsed = Date.now() - startTime;
    totalTime += elapsed;

    if (!res.ok) {
      const errorText = await res.text();
      return {
        status: "System Error",
        results: [],
        executionTime: `${totalTime}ms`,
        compileError: `Piston API returned ${res.status}: ${errorText}`,
      };
    }

    const data = await res.json();

    if (data.compile && data.compile.code !== 0) {
      return {
        status: "Compilation Error",
        results: [],
        executionTime: "0ms",
        compileError: data.compile.stderr || data.compile.stdout,
      };
    }

    if (data.run.signal === "SIGKILL" || (data.run.code === null && data.run.signal === null)) {
      overallStatus = "Time Limit Exceeded";
      results.push({
        passed: false,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: "Time Limit Exceeded",
      });
      continue;
    }

    if (data.run.code !== 0) {
      overallStatus = "Runtime Error";
      results.push({
        passed: false,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: data.run.stderr || data.run.stdout || "Runtime Error",
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

    const actualOutput = normalizeOutput(data.run.stdout);
    const expectedOutput = normalizeOutput(tc.expectedOutput);
    const passed = actualOutput === expectedOutput;

    if (!passed && overallStatus === "Accepted") {
      overallStatus = "Wrong Answer";
    }

    results.push({
      passed,
      input: tc.input,
      expected: tc.expectedOutput,
      actual: data.run.stdout || "",
    });
  }

  return {
    status: overallStatus,
    results,
    executionTime: `${totalTime}ms`,
    compileError,
  };
}

function getExt(lang) {
  if (lang === "python") return "py";
  if (lang === "javascript") return "js";
  if (lang === "cpp" || lang === "c++") return "cpp";
  return "txt";
}

module.exports = { executeCode };
