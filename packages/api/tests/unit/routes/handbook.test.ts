import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApplication } from "../../../src/application.js";
import { createApp } from "../../../src/app.js";
import { createExecutionSystem } from "../../../src/bootstrap/createExecutionSystem.js";

const PDF_URL = "https://parmana-api-real.vercel.app/parmana-handbook.pdf";

async function buildApp() {
  const executionSystem = await createExecutionSystem();
  const application = createApplication(executionSystem);
  return createApp(application, { callerAuth: "disabled" });
}

describe("GET /handbook/download-leads", () => {
  it("captures a valid email and redirects straight to the PDF, no client JS required", async () => {
    const app = await buildApp();

    const response = await request(app)
      .get("/handbook/download-leads")
      .query({ email: "reader@example.com" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(PDF_URL);
  });

  it("rejects a missing email with 400 instead of redirecting", async () => {
    const app = await buildApp();

    const response = await request(app).get("/handbook/download-leads");

    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });

  it("rejects a malformed email with 400 instead of redirecting", async () => {
    const app = await buildApp();

    const response = await request(app)
      .get("/handbook/download-leads")
      .query({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });
});

describe("POST /handbook/download-leads", () => {
  it("captures a valid email and returns a download URL, with no caller credential required", async () => {
    const app = await buildApp();

    const response = await request(app)
      .post("/handbook/download-leads")
      .send({ email: "reader@example.com" });

    expect(response.status).toBe(201);
    expect(response.body.downloadUrl).toBe(PDF_URL);
  });

  it("rejects a missing email with 400", async () => {
    const app = await buildApp();

    const response = await request(app)
      .post("/handbook/download-leads")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("email");
  });

  it("rejects a malformed email with 400", async () => {
    const app = await buildApp();

    const response = await request(app)
      .post("/handbook/download-leads")
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("email");
  });
});
