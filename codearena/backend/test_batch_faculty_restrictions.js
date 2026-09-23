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

async function putJson(url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function deleteJson(url, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers,
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
  console.log("=== Testing Faculty Batch Restrictions & Batch Assignment ===");

  // 1. Log in Admin
  console.log("\n1. Logging in as Admin...");
  const adminLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "admin@code.io",
    password: "admin123",
  });
  if (!adminLogin.ok) throw new Error("Admin login failed");
  const adminToken = adminLogin.data.token;
  console.log("✓ Admin logged in");

  // 2. Log in Faculty
  console.log("\n2. Logging in as Faculty (Dr. Robert Smith)...");
  const facultyLogin = await postJson(`${BASE_URL}/auth/login`, {
    email: "faculty@code.io",
    password: "faculty123",
  });
  if (!facultyLogin.ok) throw new Error("Faculty login failed");
  const facultyToken = facultyLogin.data.token;
  console.log("✓ Faculty logged in");

  // 3. Admin creates a test batch
  console.log("\n3. Admin creating a test batch...");
  const createBatchRes = await postJson(
    `${BASE_URL}/admin/batches`,
    {
      name: `Test Batch ${Date.now()}`,
      description: "Batch for testing faculty restrictions",
      candidates: [],
    },
    adminToken
  );
  if (!createBatchRes.ok) throw new Error(`Admin failed to create batch: ${JSON.stringify(createBatchRes.data)}`);
  const testBatchId = createBatchRes.data._id;
  console.log(`✓ Admin successfully created batch (ID: ${testBatchId})`);

  // 4. Faculty attempts to CREATE a batch -> Must return 403
  console.log("\n4. Faculty attempting to create a batch (POST /api/admin/batches)...");
  const facultyCreateRes = await postJson(
    `${BASE_URL}/admin/batches`,
    {
      name: "Illegal Faculty Batch",
      description: "Should fail",
      candidates: [],
    },
    facultyToken
  );
  if (facultyCreateRes.status === 403) {
    console.log(`✓ Correctly rejected with 403 Forbidden: "${facultyCreateRes.data.message}"`);
  } else {
    throw new Error(`FAIL: Faculty batch creation returned status ${facultyCreateRes.status}, expected 403.`);
  }

  // 5. Faculty attempts to UPDATE a batch -> Must return 403
  console.log("\n5. Faculty attempting to update batch (PUT /api/admin/batches/:id)...");
  const facultyUpdateRes = await putJson(
    `${BASE_URL}/admin/batches/${testBatchId}`,
    {
      name: "Modified by Faculty",
      description: "Should fail",
      candidates: [],
    },
    facultyToken
  );
  if (facultyUpdateRes.status === 403) {
    console.log(`✓ Correctly rejected with 403 Forbidden: "${facultyUpdateRes.data.message}"`);
  } else {
    throw new Error(`FAIL: Faculty batch update returned status ${facultyUpdateRes.status}, expected 403.`);
  }

  // 6. Faculty attempts to DELETE a batch -> Must return 403
  console.log("\n6. Faculty attempting to delete batch (DELETE /api/admin/batches/:id)...");
  const facultyDeleteRes = await deleteJson(
    `${BASE_URL}/admin/batches/${testBatchId}`,
    facultyToken
  );
  if (facultyDeleteRes.status === 403) {
    console.log(`✓ Correctly rejected with 403 Forbidden: "${facultyDeleteRes.data.message}"`);
  } else {
    throw new Error(`FAIL: Faculty batch deletion returned status ${facultyDeleteRes.status}, expected 403.`);
  }

  // 7. Faculty fetches batches list (GET /api/admin/batches) -> Must return 200
  console.log("\n7. Faculty fetching batches list (GET /api/admin/batches)...");
  const facultyGetBatchesRes = await getJson(`${BASE_URL}/admin/batches`, facultyToken);
  if (facultyGetBatchesRes.ok && Array.isArray(facultyGetBatchesRes.data)) {
    console.log(`✓ Successfully retrieved ${facultyGetBatchesRes.data.length} active batches for assignment dropdown.`);
  } else {
    throw new Error(`FAIL: Faculty could not fetch batches: ${JSON.stringify(facultyGetBatchesRes.data)}`);
  }

  // 8. Faculty assigns an assessment to the batch (POST /api/admin/batches/:id/assign-assessment) -> Must succeed (200/201)
  console.log("\n8. Faculty assigning an assessment to the batch...");
  // Get an assessment created by Robert
  const facultyDash = await getJson(`${BASE_URL}/admin/assessment-dashboard`, facultyToken);
  const problemId = facultyDash.data.assessments[0]._id;
  const problemTitle = facultyDash.data.assessments[0].title;
  console.log(`Using faculty's assessment: "${problemTitle}" (${problemId})`);

  const assignBatchRes = await postJson(
    `${BASE_URL}/admin/batches/${testBatchId}/assign-assessment`,
    { assessmentId: problemId },
    facultyToken
  );
  if (assignBatchRes.ok) {
    console.log(`✓ Faculty successfully assigned assessment to batch: "${assignBatchRes.data.message}"`);
  } else {
    throw new Error(`FAIL: Faculty failed to assign assessment to batch: ${JSON.stringify(assignBatchRes.data)}`);
  }

  // 9. Admin clean up: delete test batch
  console.log("\n9. Admin cleaning up test batch...");
  const adminDeleteRes = await deleteJson(`${BASE_URL}/admin/batches/${testBatchId}`, adminToken);
  if (adminDeleteRes.ok) {
    console.log("✓ Admin deleted test batch successfully.");
  }

  console.log("\n========================================================");
  console.log("ALL TESTS PASSED! Faculty batch restriction verified.");
  console.log("========================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
