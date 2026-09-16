import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApplication } from "../../../src/application.js";
import { createApp } from "../../../src/app.js";
import { createExecutionSystem } from "../../../src/bootstrap/createExecutionSystem.js";

async function buildApp() {
  const executionSystem = await createExecutionSystem();
  const application = createApplication(executionSystem);
  return createApp(application, { callerAuth: "disabled" });
}

describe("POST /handbook/download-leads", () => {
  it("captures a valid email and returns a download URL, with no caller credential required", async () => {
    const app = await buildApp();

    const response = await request(app)
      .post("/handbook/download-leads")
      .send({ email: "reader@example.com" });

    expect(response.status).toBe(201);
    expect(response.body.downloadUrl).toBe("/parmana-handbook.pdf");
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
