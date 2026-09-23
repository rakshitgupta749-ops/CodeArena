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
  console.log("=== Testing Faculty Dashboard for Assigned Problems (Any Creator) & Created By in Problems ===");

  // 1. Log in Admin
  console.log("\n1. Logging in as Admin...");
  const adminLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "admin@code.io",
    password: "admin123",
  });
  if (!adminLogin.ok) throw new Error("Admin login failed");
  const adminToken = adminLogin.data.token;
  console.log("✓ Admin logged in");

  // 2. Verify Problems API populates createdBy
  console.log("\n2. Checking GET /api/problems for createdBy population...");
  const problemsRes = await getJson(`${BASE_URL}/problems`, adminToken);
  if (!problemsRes.ok || !Array.isArray(problemsRes.data)) {
    throw new Error("Failed to fetch problems");
  }
  console.log(`Fetched ${problemsRes.data.length} problems.`);
  const sampleProblem = problemsRes.data[0];
  console.log("Sample problem:", {
    title: sampleProblem.title,
    createdBy: sampleProblem.createdBy ? {
      name: sampleProblem.createdBy.name,
      role: sampleProblem.createdBy.role,
    } : null,
  });
  if (!sampleProblem.createdBy) {
    throw new Error("Sample problem missing createdBy!");
  }
  console.log("✓ Problems have createdBy populated with creator details.");

  // 3. Log in Faculty (Dr. Robert Smith)
  console.log("\n3. Logging in as Dr. Robert Smith (faculty@code.io)...");
  const robertLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "faculty@code.io",
    password: "faculty123",
  });
  if (!robertLogin.ok) throw new Error("Robert login failed");
  const robertToken = robertLogin.data.token;
  const robertId = robertLogin.data.user.id || robertLogin.data.user._id;
  console.log(`✓ Dr. Robert Smith logged in (ID: ${robertId})`);

  // 4. Find a problem created by someone else (e.g. Prof. Sarah Connor)
  const sarahProblem = problemsRes.data.find(
    (p) => p.createdBy && p.createdBy._id.toString() !== robertId.toString()
  );
  if (!sarahProblem) {
    throw new Error("Could not find a problem created by someone other than Robert");
  }
  console.log(`\nFound problem created by someone else: "${sarahProblem.title}" (Created by: ${sarahProblem.createdBy.name}, ID: ${sarahProblem._id})`);

  // 5. Check Robert's dashboard BEFORE assigning this problem
  const initialDash = await getJson(`${BASE_URL}/admin/assessment-dashboard`, robertToken);
  const hadBefore = initialDash.data.assessments.some((a) => a._id === sarahProblem._id);
  console.log(`Is "${sarahProblem.title}" in Robert's dashboard before assignment? ${hadBefore}`);

  // 6. Find a candidate student to assign
  const studentsRes = await getJson(`${BASE_URL}/admin/candidates?role=user`, adminToken);
  const student = studentsRes.data.candidates[0];
  console.log(`Using student: ${student.name} (${student._id})`);

  // 7. Robert assigns sarahProblem to the student
  console.log(`\n7. Dr. Robert Smith assigns "${sarahProblem.title}" to student ${student.name}...`);
  const assignRes = await postJson(
    `${BASE_URL}/admin/assignments`,
    {
      candidateId: student._id,
      assessmentId: sarahProblem._id,
    },
    robertToken
  );
  if (!assignRes.ok) {
    throw new Error(`Assignment failed: ${JSON.stringify(assignRes.data)}`);
  }
  console.log("✓ Problem successfully assigned by Robert.");

  // 8. Check Robert's dashboard AFTER assigning: sarahProblem MUST now be visible!
  console.log(`\n8. Checking Robert's dashboard after assignment...`);
  const updatedDash = await getJson(`${BASE_URL}/admin/assessment-dashboard`, robertToken);
  const foundInDash = updatedDash.data.assessments.find((a) => a._id === sarahProblem._id);
  if (!foundInDash) {
    throw new Error(`FAIL: "${sarahProblem.title}" is NOT visible in Robert's dashboard after being assigned by Robert!`);
  }
  console.log(`✓ SUCCESS! "${sarahProblem.title}" is now visible on Robert's dashboard!`);
  console.log(`  - Assessment Title: ${foundInDash.title}`);
  console.log(`  - Created By: ${foundInDash.createdBy?.name} (${foundInDash.createdBy?.role})`);
  console.log(`  - Total Candidates Taken for Robert: ${foundInDash.totalTaken}`);

  // 9. Robert views candidate reports for this assessment (/api/admin/assessments/:id/candidates)
  console.log(`\n9. Robert requesting candidate reports for "${sarahProblem.title}" (${sarahProblem._id})...`);
  const candidatesViewRes = await getJson(
    `${BASE_URL}/admin/assessments/${sarahProblem._id}/candidates`,
    robertToken
  );
  if (candidatesViewRes.status === 200) {
    console.log(`✓ SUCCESS! Robert is allowed access (200 OK).`);
    console.log(`  Candidates returned: ${candidatesViewRes.data.candidates.length}`);
    const foundStudent = candidatesViewRes.data.candidates.find(
      (c) => c.candidate._id.toString() === student._id.toString()
    );
    if (foundStudent) {
      console.log(`  ✓ Assigned student "${foundStudent.candidate.name}" is present in evaluation tracking.`);
    }
  } else {
    throw new Error(`FAIL: Robert received status ${candidatesViewRes.status}: ${JSON.stringify(candidatesViewRes.data)}`);
  }

  // 10. Clean up the test assignment
  const assignmentId = assignRes.data.assignment?._id || assignRes.data._id;
  if (assignmentId) {
    await fetch(`${BASE_URL}/admin/assignments/${assignmentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log("\n✓ Cleaned up test assignment.");
  }

  console.log("\n========================================================");
  console.log("ALL TESTS PASSED! Assigned problems visible to faculty.");
  console.log("========================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
