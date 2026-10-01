# Not in the SDK yet: call the route directly.
import os

import requests

response = requests.post(
    "https://parmana-api-real.vercel.app/external-connectors/changes",
    headers={"Authorization": f"Bearer {os.environ['PARMANA_API_KEY']}"},
    json={
        "action": "register",
        "capability": "erp:create-invoice",
        "endpointUrl": "https://erp.example.com/parmana/release",
        "policy": "erp-invoice",
        "allowedParameters": ["amount", "currency"],
        "timeoutMs": 10000,
        "reason": "Finance creates invoices in the ERP through Parmana.",
    },
    timeout=30,
)

print(response.status_code, response.json())
