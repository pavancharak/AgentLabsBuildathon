import os
from pathlib import Path

import requests

from parmana.crypto import sign_policy_change_step_up

# Not in the SDK yet: call the route directly.
step_up = sign_policy_change_step_up(
    pending_policy_change_id="ba7c5827-5844-4069-94fc-9b438ef08f78",
    action="approve",
    private_key_pem=Path("step-up.private.pem").read_text(),
    key_id="checker-step-up-1",
)

response = requests.post(
    "https://parmana-api-real.vercel.app/external-connectors/changes/ba7c5827-5844-4069-94fc-9b438ef08f78/approve",
    headers={"Authorization": f"Bearer {os.environ['PARMANA_API_KEY']}"},
    json={"stepUpAuthorization": step_up},
    timeout=30,
)

print(response.status_code, response.json())
