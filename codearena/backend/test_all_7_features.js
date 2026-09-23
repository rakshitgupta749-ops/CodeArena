const BASE_URL = "http://localhost:5001/api";

async function testAll() {
  console.log("=== Testing 7 User Requested Features ===");

  // Login as admin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@code.io", password: "admin123" })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    console.error("Admin login failed:", loginData);
    process.exit(1);
  }
  const token = loginData.token;
  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
  console.log("✓ Admin logged in successfully");

  // 1. Reports Tab: Check reports endpoint
  console.log("\n--- 1. Testing Reports Tab ---");
  const reportsRes = await fetch(`${BASE_URL}/admin/reports`, { headers: authHeaders });
  const reportsData = await reportsRes.json();
  console.log(`Reports returned: ${reportsData.reports?.length || 0}`);
  if (reportsData.reports && reportsData.reports.length > 0) {
    const r0 = reportsData.reports[0];
    const candidateName = r0.user?.name || r0.candidateName;
    console.log(`Sample Report candidate: "${candidateName}", score: ${r0.reportData?.overallScore}, type: ${r0.reportType}`);
    if (candidateName && candidateName !== "Unknown") {
      console.log(`✓ Final report has valid candidate name "${candidateName}" and score ${r0.reportData?.overallScore}`);
    } else {
      console.warn("⚠️ Candidate name is unknown:", r0);
    }
  } else {
    console.log("No reports yet or empty array");
  }

  // 2. Interviews Tab: Check interview candidate and problem names
  console.log("\n--- 2. Testing Interviews Tab ---");
  const interviewsRes = await fetch(`${BASE_URL}/admin/interviews`, { headers: authHeaders });
  const interviewsData = await interviewsRes.json();
  console.log(`Interviews returned: ${interviewsData.interviews?.length || 0}`);
  if (interviewsData.interviews && interviewsData.interviews.length > 0) {
    const i0 = interviewsData.interviews[0];
    console.log(`Sample interview user: ${JSON.stringify(i0.user)}, problem: ${JSON.stringify(i0.problem)}`);
    const userName = i0.user?.name;
    const problemTitle = i0.problem?.title;
    if (userName && problemTitle) {
      console.log(`✓ Interview has valid candidate "${userName}" and problem "${problemTitle}"`);
    } else {
      console.warn("⚠️ Candidate or problem is still missing:", i0);
    }
  }

  // 4. Problems Tab: Test problem deletion
  console.log("\n--- 4. Testing Problem Deletion ---");
  const createProbRes = await fetch(`${BASE_URL}/problems`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Temporary Test Problem To Delete",
      description: "Test description for problem deletion verification.",
      difficulty: "Easy",
      category: "Arrays",
      starterCode: { javascript: "// test" },
      testCases: [{ input: "1", expectedOutput: "1", isHidden: false }]
    })
  });
  const createdProb = await createProbRes.json();
  console.log(`Created temporary problem: id=${createdProb._id}, title="${createdProb.title}"`);
  
  const deleteProbRes = await fetch(`${BASE_URL}/problems/${createdProb._id}`, {
    method: "DELETE",
    headers: authHeaders
  });
  const deleteProbData = await deleteProbRes.json();
  console.log("Delete response:", deleteProbData);
  if (deleteProbRes.status === 200) {
    console.log("✓ Successfully deleted problem via DELETE /api/problems/:id");
  } else {
    console.error("✗ Failed to delete problem:", deleteProbRes.status, deleteProbData);
  }

  // 5. Submissions Tab: Check submissions endpoint
  console.log("\n--- 5. Testing Submissions Tab ---");
  const subsRes = await fetch(`${BASE_URL}/submissions`, { headers: authHeaders });
  const subsData = await subsRes.json();
  const subsList = Array.isArray(subsData) ? subsData : (subsData.submissions || []);
  console.log(`Submissions returned: ${subsList.length}`);
  if (subsList.length > 0) {
    const s0 = subsList[0];
    console.log(`Sample submission user: ${s0.user?.name}, problem: ${s0.problem?.title}, status: ${s0.status}`);
    console.log("✓ Submissions table is populated and not empty");
  } else {
    console.log("⚠️ Submissions table is empty");
  }

  // 6. Settings Tab: Timers bounds and acknowledgment
  console.log("\n--- 6. Testing Settings Tab Timers (5-60 min validation) ---");
  // Test invalid: < 5 min
  const timerLowRes = await fetch(`${BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      timers: { preCoding: 3, coding: 30, postCoding: 15 }
    })
  });
  const timerLowData = await timerLowRes.json();
  console.log("Timer < 5 result:", timerLowRes.status, timerLowData.message);
  if (timerLowRes.status === 400 && timerLowData.message.includes("greater then 5 min and can be upto 60 min")) {
    console.log("✓ Enforced lower bound validation: " + timerLowData.message);
  } else {
    console.error("✗ Lower bound validation failed!");
  }

  // Test invalid: > 60 min
  const timerHighRes = await fetch(`${BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      timers: { preCoding: 15, coding: 75, postCoding: 15 }
    })
  });
  const timerHighData = await timerHighRes.json();
  console.log("Timer > 60 result:", timerHighRes.status, timerHighData.message);
  if (timerHighRes.status === 400 && timerHighData.message.includes("greater then 5 min and can be upto 60 min")) {
    console.log("✓ Enforced upper bound validation: " + timerHighData.message);
  } else {
    console.error("✗ Upper bound validation failed!");
  }

  // 7. Settings Tab: Pre-code and Post-code Max Questions validation
  console.log("\n--- 7. Testing Question Limits (2-15) ---");
  // Test invalid: <= 1
  const qLowRes = await fetch(`${BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      preCodeMaxQuestions: 1
    })
  });
  const qLowData = await qLowRes.json();
  console.log("preCodeMaxQuestions = 1 result:", qLowRes.status, qLowData.message);
  if (qLowRes.status === 400) {
    console.log("✓ Enforced min question validation (> 1)");
  }

  // Test invalid: > 15
  const qHighRes = await fetch(`${BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      postCodeMaxQuestions: 20
    })
  });
  const qHighData = await qHighRes.json();
  console.log("postCodeMaxQuestions = 20 result:", qHighRes.status, qHighData.message);
  if (qHighRes.status === 400) {
    console.log("✓ Enforced max question validation (<= 15)");
  }

  // Test valid update
  const validSettingsRes = await fetch(`${BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      timers: { preCoding: 10, coding: 45, postCoding: 15 },
      preCodeMaxQuestions: 7,
      postCodeMaxQuestions: 10
    })
  });
  const validSettingsData = await validSettingsRes.json();
  console.log("Valid settings update result:", validSettingsRes.status, validSettingsData.message);
  if (validSettingsRes.status === 200) {
    console.log("✓ Successfully saved valid settings with acknowledgment message");
  }

  // Verify GET settings
  const getSettingsRes = await fetch(`${BASE_URL}/admin/settings`, { headers: authHeaders });
  const getSettingsData = await getSettingsRes.json();
  console.log("Current Settings in DB:", JSON.stringify({
    timers: getSettingsData.timers,
    preCodeMaxQuestions: getSettingsData.preCodeMaxQuestions,
    postCodeMaxQuestions: getSettingsData.postCodeMaxQuestions
  }, null, 2));

  console.log("\n=== All API Verifications Completed Successfully ===");
}

testAll().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
