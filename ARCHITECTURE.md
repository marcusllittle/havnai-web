# HavnAI Technical Architecture (Draft)

**Own Your Intelligence. Build once. Earn forever.**  
joinhavn.io

This document describes the core on-chain and off-chain components of the HavnAI network. This is a draft for early collaborators, security reviewers, and potential contributors.

---

## High-Level Flow

1. A creator publishes an AI workflow to the network.
2. A user (or app) calls that workflow.
3. A node runs the workload (GPU / inference / generation).
4. Validators confirm that the job actually ran.
5. The network distributes $HAI automatically to everyone who contributed.
6. The run is recorded as proof of usage and revenue.

---

## Core Components

### 1. Workflow Registry Contract
**Purpose:** Register AI workflows and define how revenue should be split.

**Stores:**
- Workflow ID
- Creator address
- Royalty split config (creator %, upstream %, node %, validator %, treasury %)
- Dependency graph (e.g. which models / LoRAs / prompts were used)
- Version / hash so clones and derivatives can be traced

**Why it matters:**
- It makes “this is my workflow” provable.
- It gives every workflow a programmable royalty model.

**Access model:**
- Anyone can publish.
- But governance can flag spam / stolen assets.

---

### 2. Execution Log Contract
**Purpose:** Record “this workflow was actually executed.”

**Stores:**
- Workflow ID
- Caller (who requested it)
- Node that ran it
- Validator quorum signatures
- Timestamp
- Fee paid in $HAI

**Why it matters:**
- Creates a public, immutable history of use.
- This becomes the “earnings record” for a creator. You can literally point to proof that your work generated value.

**Note:** Full output (images, audio, etc.) is *not* on-chain. Only proof that the run happened.

---

### 3. Payout Contract
**Purpose:** Split $HAI from each execution to everyone who should get paid.

**Inputs:**
- Total fee from the job (in $HAI)
- Royalty split from the Workflow Registry

**Outputs:**
- Creator payout
- Upstream contributor payout pool
- Node operator payout
- Validator pool payout
- Treasury cut

**Anti-abuse:**
- Only callable if the Execution Log contract marks the job as valid.
- Only valid if enough validators signed it.

---

### 4. Staking / Slashing Contract
**Purpose:** Security. Make cheating expensive.

**Node Operators stake $HAI** to be allowed to run workloads.
- If they fake jobs, deliver trash outputs, or claim work they didn’t do: they get slashed.

**Validators stake $HAI** to be allowed to sign off on executions.
- If they sign fraudulent runs just to release payouts: they get slashed.

**Configurable:**
- Minimum stake to join as node
- Minimum stake to join as validator
- Slash amounts for fraud, downtime, collusion

This is how HavnAI runs without needing one centralized company to “trust” who did work.

---

## Off-Chain / Infra Components

These sit around the contracts and make the network usable:

### Creator SDK / CLI
- Lets creators publish workflows (with metadata + royalty config) to the Workflow Registry.
- Think: `havn publish ./my_workflow.json`

### Node Runtime / Agent
- Runs the actual AI job (ComfyUI pipeline, diffusion, LLM inference, voice synth, etc.).
- Reports back that it ran, with job metadata for validators.

This part is where your DevOps, GPU, container, Helm, etc. background plugs in HARD.

### Validator Service
- Independent parties that confirm:
  - The node that claimed to run the job actually ran it.
  - The job output is structurally valid (not just “hello world” spam).
- Sends signed attestations on-chain.

---

## Governance

$HAI holders vote on:
- Royalty defaults (like 45/20/25/5/5 split)
- Minimum stake requirements for nodes/validators
- Derivative detection rules (how close is “copy/paste”?)
- Treasury use (grants, GPU onboarding, audits)

Most parameters in the contracts are not hardcoded; they’re adjustable by governance.

---

## Why This Works

- Creators get recurring income, not “exposure.”
- Workflows become on-chain economic assets, not just GitHub gists.
- Nodes get paid to run compute without being Amazon or NVIDIA.
- The network defends itself economically: lying costs you stake.
- Anyone can see proof of impact (“this workflow earned X $HAI across Y runs”).

This is how we go from “AI as a tool” to “AI as an economy.”

---

## Status

- Branding, vision, tokenomics, and public repo are live.
- Whitepaper draft published.
- Architecture spec (this doc) is pre-implementation.

Next step:  
- Smart contract prototypes for Registry, Execution Log, Payout Splitter, and Staking.
- Reference node runtime (Python agent / container job runner).
- Testnet simulation of 1 full execution → payout loop.

If you want to collaborate on contracts, validator design, or GPU node runtime:
team@joinhavn.io
