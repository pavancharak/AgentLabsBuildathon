import { readFileSync } from "node:fs";

import { signPolicyChangeStepUp } from "@parmana/sdk";

// Not in the SDK yet: call the route directly.
const stepUp = signPolicyChangeStepUp({
  pendingPolicyChangeId: "ba7c5827-5844-4069-94fc-9b438ef08f78",
  action: "approve",
  privateKeyPem: readFileSync("step-up.private.pem", "utf8"),
  keyId: "checker-step-up-1",
});

const response = await fetch(
  "https://parmana-api-real.vercel.app/external-connectors/changes/ba7c5827-5844-4069-94fc-9b438ef08f78/approve",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PARMANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stepUpAuthorization: stepUp }),
  },
);

console.log(response.status, await response.json());
