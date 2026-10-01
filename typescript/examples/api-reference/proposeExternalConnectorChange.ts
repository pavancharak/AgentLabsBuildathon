// Not in the SDK yet: call the route directly.
const response = await fetch(
  "https://parmana-api-real.vercel.app/external-connectors/changes",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PARMANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "register",
      capability: "erp:create-invoice",
      endpointUrl: "https://erp.example.com/parmana/release",
      policy: "erp-invoice",
      allowedParameters: ["amount", "currency"],
      timeoutMs: 10000,
      reason: "Finance creates invoices in the ERP through Parmana.",
    }),
  },
);

console.log(response.status, await response.json());
