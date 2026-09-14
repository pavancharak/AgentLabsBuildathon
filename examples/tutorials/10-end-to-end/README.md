\# Tutorial 10 — End-to-End

\## Overview

This tutorial demonstrates the complete Parmana execution lifecycle from Business Transaction submission to Receipt generation.

It combines the concepts introduced throughout the previous tutorials into a single end-to-end workflow.

\---

\## Learning Objectives

After completing this tutorial you will understand:

\- Business Transaction

\- Policy Resolution

\- Policy Evaluation

\- Runtime Execution

\- Execution Trust Record

\- Verification

\- Receipt Generation

\---

\## Files

| File | Purpose |

|------|---------|

| `transaction.json` | Canonical Business Transaction |

| `run.ts` | Executes the complete Parmana workflow |

\---

\## Architecture

```

Business Transaction

&#x20;       │

&#x20;       ▼

Policy Router

&#x20;       │

&#x20;       ▼

Policy Engine

&#x20;       │

&#x20;       ▼

Runtime

&#x20;       │

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ▼

Verification

&#x20;       │

&#x20;       ▼

Receipt

```

\---

\## Run

```bash

npm run example -- 10-end-to-end

```

or

```bash

tsx run.ts

```

\---

\## Expected Output

The tutorial prints:

\- Business Transaction

\- Execution Trust Record

\- Verification Result

\- Receipt

This represents the complete Parmana execution lifecycle.

\---

\## Previous Tutorials

1\. Hello World

2\. Policy Evaluation

3\. Runtime Execution

4\. Policy Router

5\. Verification

6\. Replay

7\. Receipt Generation

8\. Human Approval

9\. REST API

Congratulations! You have completed the Parmana tutorial series.
