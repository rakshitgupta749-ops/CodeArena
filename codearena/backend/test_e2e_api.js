const jwt = require("jsonwebtoken");

async function run() {
  console.log("Logging in as user@code.io...");
  const loginRes = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@code.io", password: "user123" })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.token) {
    console.error("Login failed:", loginData);
    return;
  }
  
  console.log("Login successful! Token:", loginData.token.substring(0, 20) + "...");
  
  console.log("Submitting code to /api/submissions/run...");
  // We need a problem ID, but maybe runCode doesn't require it if it's just a raw run. 
  // Let's check what runCode expects. Typically { code, language, problemId, testCases }
  const runRes = await fetch("http://localhost:5001/api/submissions/run", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${loginData.token}`
    },
    body: JSON.stringify({ 
      code: "public class Main { public static void main(String[] args) { System.out.println(\"Hello CodeArena!\"); } }", 
      language: "java" 
    })
  });
  
  const runData = await runRes.json();
  console.log("Execution Result:", JSON.stringify(runData, null, 2));
}

run();
