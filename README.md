# PayGuard AI

**The transaction firewall for AI-powered commerce.**

An AI agent can understand what a user wants to buy, but it should never freely spend the user's money. PayGuard AI converts a user's natural-language spending rules into enforceable transaction policies, evaluates any proposed purchase against those policies, and only then creates a PayPal sandbox payment for human approval.

> **AI gets intelligence. The user keeps financial authority.**

---

## The problem

Agentic commerce is coming. LLM agents can now browse, compare, and recommend products. But letting an AI agent directly execute payments creates a new class of risk: the agent can be prompt-injected, hallucinate a price, ignore a stated budget, or be manipulated into overspending.

Existing "AI shopping assistants" either do not move money at all, or give the model unrestricted access to the wallet. Neither is acceptable.

## The solution

PayGuard AI separates three concerns that should never be merged:

| Layer | Responsibility | Technology |
|---|---|---|
| **Reasoning** | Understand natural language, produce a structured policy | Groq `openai/gpt-oss-120b` |
| **Enforcement** | Deterministically evaluate a purchase against the policy | `src/policy.js` (pure code, no AI) |
| **Execution** | Move the money, only after the policy allows it and the human approves | PayPal Orders API (sandbox) |

The AI can never modify the policy it generated. The user's explicit limits (max budget, required specs, forbidden attributes) are enforced by code, not by a model.

## How it works

```
User intent (natural language)
        │
        ▼
Groq LLM  ──►  Structured policy (JSON)
        │
        ▼
PayGuard Policy Engine  ──►  ALLOW / BLOCK + reasons
        │
        ▼ (if ALLOW)
PayPal Orders API  ──►  create order  ──►  user approves  ──►  capture
        │
        ▼
Audit trail (every policy, decision, order, capture)
```

## Features

- **Natural-language policy creation** — describe what you want to buy in plain English.
- **Structured, typed policies** — requirements and restrictions are returned as objects with keywords and types (`forbid` / `require`), not free-form strings.
- **Deterministic evaluation** — pure-code checks on budget, requirements, and restrictions. No LLM involvement in the financial decision.
- **Human-in-the-loop approval** — the user must approve every payment in PayPal's sandbox before capture.
- **Complete audit trail** — every policy, decision, order, and capture is timestamped and viewable at `/audit`.
- **Mobile-first** — the entire project was built and is demoed from an Android phone using Termux.

## Demo flow
Live Demo URL: https://payguard-ai-qloi.onrender.com
Simple steps below 👇 
1. Enter: *"I need a programming laptop under $800 with at least 16GB RAM. No refurbished."*
2. PayGuard generates a policy: `max_budget: 800`, requirement `16GB RAM`, restriction `forbid: refurbished`.
3. Propose a laptop at `$749`, 16GB, new → **ALLOW**
4. Change price to `$849` → **BLOCK** (exceeds budget by $49.00)
5. Change condition to `refurbished` → **BLOCK** (forbidden term matched)
6. Restore valid values → **ALLOW**, then create a PayPal sandbox order
7. Approve in PayPal, capture, and view the full receipt in `/audit`

## Tech stack

- **Node.js** (v24) + **Express** — backend server
- **Groq** `openai/gpt-oss-120b` — structured JSON intent parsing with reasoning
- **PayPal REST API** (sandbox) — Orders v2 (create, approve, capture)
- **Vanilla HTML/CSS/JS** — no framework, runs in a mobile browser
- **Termux on Android** — the development environment

## Setup

### Prerequisites

- Node.js 18+ (tested on v24)
- A free [Groq API key](https://console.groq.com) — no credit card required
- A free [PayPal Developer](https://developer.paypal.com) account with a sandbox app

### Install

```bash
git clone https://github.com/Sule-Bashir/payguard-ai.git
npm install
```

### Configure

Create a `.env` file in the project root:

```env
GROQ_API_KEY=gsk_...
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

### Run

```bash
npm start
```

Open `http://localhost:3000` in a browser.

## Project structure

```
payguard-ai/
├── public/
│   ├── index.html      # Main UI: policy → evaluation → payment
│   └── audit.html      # Audit trail view
├── src/
│   ├── ai.js           # Groq LLM policy parser
│   ├── policy.js       # Deterministic policy engine (no AI)
│   └── paypal.js       # PayPal Orders API client
├── server.js           # Express server + routes
├── .env                # Secrets (NOT committed)
├── .gitignore
├── LICENSE
└── README.md
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/analyze` | Natural language → structured policy (LLM) |
| POST | `/api/evaluate` | Policy + transaction → ALLOW/BLOCK (pure code) |
| POST | `/api/paypal/create-order` | Create a PayPal sandbox order |
| POST | `/api/paypal/capture-order` | Capture an approved order |
| GET | `/api/audit` | Audit log as JSON |
| GET | `/audit` | Audit log as an HTML page |

## Security notes

- API keys are loaded from `.env`, which is git-ignored.
- The AI model has **no access** to PayPal credentials.
- Every payment requires explicit human approval in PayPal's UI.
- All transactions use the PayPal **sandbox** environment — no real money moves.

## License

MIT — see [LICENSE](LICENSE).

## Hackathon

Built for the **PayPal AI Hackathon 2026**.
