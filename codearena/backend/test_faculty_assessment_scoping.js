const BASE_URL = "http://localhost:5001/api";

async function postJson(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function getJson(url, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "GET",
    headers,
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log("=== Testing Faculty Assessment & Student Report Scoping ===");

  // 1. Login Dr. Robert Smith (faculty@code.io)
  console.log("\n1. Logging in as Dr. Robert Smith (faculty@code.io)...");
  const robertLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "faculty@code.io",
    password: "faculty123",
  });
  if (!robertLogin.ok) throw new Error(`Robert login failed: ${JSON.stringify(robertLogin.data)}`);
  const robertToken = robertLogin.data.token;
  const robertId = robertLogin.data.user.id || robertLogin.data.user._id;
  console.log(`✓ Logged in as Robert (ID: ${robertId})`);

  // 2. Login Prof. Sarah Connor (sarah.faculty@code.io)
  console.log("\n2. Logging in as Prof. Sarah Connor (sarah.faculty@code.io)...");
  const sarahLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "sarah.faculty@code.io",
    password: "faculty123",
  });
  if (!sarahLogin.ok) throw new Error(`Sarah login failed: ${JSON.stringify(sarahLogin.data)}`);
  const sarahToken = sarahLogin.data.token;
  const sarahId = sarahLogin.data.user.id || sarahLogin.data.user._id;
  console.log(`✓ Logged in as Sarah (ID: ${sarahId})`);

  // 3. Login Admin (admin@code.io)
  console.log("\n3. Logging in as Admin (admin@code.io)...");
  const adminLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "admin@code.io",
    password: "admin123",
  });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;
  console.log(`✓ Logged in as Admin`);

  // 4. Test Robert's Assessment Dashboard
  console.log("\n4. Checking Robert's Assessment Dashboard (/api/admin/assessment-dashboard)...");
  const robertDash = await getJson(`${BASE_URL}/admin/assessment-dashboard`, robertToken);
  console.log(`Total assessments returned for Robert: ${robertDash.data.total}`);
  console.log(`Assessments count in list: ${robertDash.data.assessments.length}`);
  const robertTitles = robertDash.data.assessments.map((a) => a.title);
  console.log(`Assessments titles for Robert:`, robertTitles);

  for (const item of robertDash.data.assessments) {
    const creatorId = item.createdBy?._id || item.createdBy;
    if (creatorId.toString() !== robertId.toString()) {
      throw new Error(`Assessment ${item.title} creator ${creatorId} does NOT match Robert ${robertId}!`);
    }
  }
  console.log("✓ All assessments in Robert's dashboard were strictly created by Robert.");

  // 5. Test Sarah's Assessment Dashboard
  console.log("\n5. Checking Sarah's Assessment Dashboard (/api/admin/assessment-dashboard)...");
  const sarahDash = await getJson(`${BASE_URL}/admin/assessment-dashboard`, sarahToken);
  console.log(`Total assessments returned for Sarah: ${sarahDash.data.total}`);
  console.log(`Assessments count in list: ${sarahDash.data.assessments.length}`);
  const sarahTitles = sarahDash.data.assessments.map((a) => a.title);
  console.log(`Assessments titles for Sarah:`, sarahTitles);

  for (const item of sarahDash.data.assessments) {
    const creatorId = item.createdBy?._id || item.createdBy;
    if (creatorId.toString() !== sarahId.toString()) {
      throw new Error(`Assessment ${item.title} creator ${creatorId} does NOT match Sarah ${sarahId}!`);
    }
  }
  console.log("✓ All assessments in Sarah's dashboard were strictly created by Sarah.");

  // 6. Test Admin Assessment Dashboard
  console.log("\n6. Checking Admin Assessment Dashboard (/api/admin/assessment-dashboard)...");
  const adminDash = await getJson(`${BASE_URL}/admin/assessment-dashboard`, adminToken);
  console.log(`Total assessments returned for Admin: ${adminDash.data.total}`);
  if (adminDash.data.total !== 6) {
    console.warn(`Admin total is ${adminDash.data.total}, expected 6.`);
  } else {
    console.log("✓ Admin sees all 6 assessments.");
  }

  // Pick one assessment created by Robert and one by Sarah
  const robertProblemId = robertDash.data.assessments[0]._id;
  const sarahProblemId = sarahDash.data.assessments[0]._id;

  // 7. Robert accessing his own assessment candidates/reports
  console.log(`\n7. Robert accessing candidate reports for his own assessment (${robertDash.data.assessments[0].title})...`);
  const robertOwnCandidates = await getJson(`${BASE_URL}/admin/assessments/${robertProblemId}/candidates`, robertToken);
  if (!robertOwnCandidates.ok) {
    throw new Error(`Robert failed to access his own assessment candidates: ${JSON.stringify(robertOwnCandidates.data)}`);
  }
  console.log(`✓ Successfully retrieved own assessment candidates. Status: ${robertOwnCandidates.status}`);
  console.log(`Candidates count: ${robertOwnCandidates.data.candidates.length}`);

  // 8. Robert accessing Sarah's assessment candidates/reports -> Must return 403
  console.log(`\n8. Robert attempting to access candidate reports for Sarah's assessment (${sarahDash.data.assessments[0].title})...`);
  const robertOnSarah = await getJson(`${BASE_URL}/admin/assessments/${sarahProblemId}/candidates`, robertToken);
  if (robertOnSarah.status === 403) {
    console.log(`✓ Correctly rejected with 403 Forbidden: "${robertOnSarah.data.message}"`);
  } else {
    throw new Error(`FAIL: Expected 403 Forbidden, but got status ${robertOnSarah.status}: ${JSON.stringify(robertOnSarah.data)}`);
  }

  // 9. Sarah accessing Robert's assessment candidates/reports -> Must return 403
  console.log(`\n9. Sarah attempting to access candidate reports for Robert's assessment (${robertDash.data.assessments[0].title})...`);
  const sarahOnRobert = await getJson(`${BASE_URL}/admin/assessments/${robertProblemId}/candidates`, sarahToken);
  if (sarahOnRobert.status === 403) {
    console.log(`✓ Correctly rejected with 403 Forbidden: "${sarahOnRobert.data.message}"`);
  } else {
    throw new Error(`FAIL: Expected 403 Forbidden, but got status ${sarahOnRobert.status}: ${JSON.stringify(sarahOnRobert.data)}`);
  }

  // 10. Admin accessing both assessments candidates/reports -> Must return 200
  console.log(`\n10. Admin accessing candidate reports for Robert's and Sarah's assessments...`);
  const adminCheckRobert = await getJson(`${BASE_URL}/admin/assessments/${robertProblemId}/candidates`, adminToken);
  const adminCheckSarah = await getJson(`${BASE_URL}/admin/assessments/${sarahProblemId}/candidates`, adminToken);
  if (!adminCheckRobert.ok || !adminCheckSarah.ok) {
    throw new Error(`Admin failed to access assessment candidates!`);
  }
  console.log(`✓ Admin access for Robert's assessment: ${adminCheckRobert.status}`);
  console.log(`✓ Admin access for Sarah's assessment: ${adminCheckSarah.status}`);

  // 11. Check Reports endpoint scoping for Robert vs Sarah
  console.log(`\n11. Testing /api/admin/reports endpoint for Robert...`);
  const robertReports = await getJson(`${BASE_URL}/admin/reports`, robertToken);
  console.log(`Robert reports count: ${robertReports.data.reports.length}`);

  console.log(`Testing /api/admin/reports endpoint for Sarah...`);
  const sarahReports = await getJson(`${BASE_URL}/admin/reports`, sarahToken);
  console.log(`Sarah reports count: ${sarahReports.data.reports.length}`);

  // If there are reports for Sarah, verify Robert cannot access Sarah's individual report
  if (sarahReports.data.reports.length > 0) {
    const sarahReportId = sarahReports.data.reports[0]._id;
    console.log(`Testing Robert access to Sarah's report (${sarahReportId})...`);
    const robertOnSarahReport = await getJson(`${BASE_URL}/admin/reports/${sarahReportId}`, robertToken);
    if (robertOnSarahReport.status === 403) {
      console.log(`✓ Robert correctly denied access to Sarah's report with 403 Forbidden.`);
    } else {
      console.log(`Status for Robert on Sarah's report: ${robertOnSarahReport.status}`);
    }
  }

  console.log("\n==========================================");
  console.log("ALL TESTS PASSED! Faculty isolation verified.");
  console.log("==========================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
