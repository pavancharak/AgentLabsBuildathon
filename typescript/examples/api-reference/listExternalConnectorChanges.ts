// Not in the SDK yet: call the route directly.
const response = await fetch(
  "https://parmana-api-real.vercel.app/external-connectors/changes?status=PENDING_APPROVAL",
  {
    headers: { Authorization: `Bearer ${process.env.PARMANA_API_KEY}` },
  },
);

console.log(response.status, await response.json());
