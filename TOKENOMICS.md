# HavnAI — $HAI Token Economics
**Own Your Intelligence. Build once. Earn forever.**  
**Domain:** https://joinhavn.io  
**Token:** $HAI

> This document describes the initial economic design for the HavnAI network. Values marked **(configurable)** are parameters
> the community can tune via governance. Nothing here is financial advice.

---

## 0) Design Goals

- **Reward actual contribution.**  
  Recurring income for creators, upstream asset authors, node operators, and validators.

- **Incentivize truth.**  
  Staking + slashing secure execution and verification. Nobody gets paid for fake work.

- **Keep it simple early.**  
  Clear splits, minimal moving parts, upgradeable through governance.

- **Make $HAI indispensable.**  
  $HAI is how you pay, secure, govern, and surface value in the network — not just a checkout token.

---

## 1) Roles & Actions

| Role                     | Earns $HAI by                                                           | Spends / Stakes $HAI for                                                |
|--------------------------|-------------------------------------------------------------------------|-------------------------------------------------------------------------|
| **Creators**             | When their workflow / model / pipeline is executed                      | (Optional) staking for visibility / reputation (configurable)          |
| **Upstream Contributors**| When assets they provided (LoRAs, tuned models, prompts, etc.) are used | (Optional) listing boosts / verification badges                         |
| **Node Operators**       | Running the actual compute / inference work                             | **Stake** to participate; collateral against bad behavior              |
| **Validators**           | Verifying that executions are real and not spoofed                      | **Stake** to join validator set; slashed on fraud                      |
| **End Users / Apps**     | —                                                                       | **Spend** to run workflows / buy AI outputs                            |
| **Treasury**             | Protocol fee on each execution                                          | Uses $HAI for grants, incentives, audits, liquidity, ecosystem growth  |

---

## 2) Value Flow (High-Level)

User pays $HAI  
↓  
Workflow executes on a node  
↓  
Validators confirm it actually ran  
↓  
Payout Split is auto-distributed in $HAI:
- Creator  
- Upstream Contributors  
- Node Operator  
- Validators  
- Treasury

**Default Payout Split** (configurable via governance):

- **Creator:** 45%  
- **Upstream Contributors (pooled):** 20%  
- **Node Operator:** 25%  
- **Validators (pool):** 5%  
- **Treasury:** 5%

If a workflow has no upstream dependencies (only the creator’s work), that 20% routes to the creator by default. **(configurable)**

---

## 3) Fee Model

Each execution of a registered workflow charges a fee in $HAI. That fee funds the royalty split.

The fee has two parts:
- `base_fee` → protocol-level minimum cost to run anything  
- `variable_fee` → depends on compute class / complexity

**Example starting defaults (configurable):**
- `base_fee = 0.5 HAI`
- `variable_fee tiers:`
  - S (light CPU / low mem): `0.25 HAI`
  - M (standard GPU / short run): `0.75 HAI`
  - L (heavier GPU / longer run): `1.5 HAI`
  - XL (multi-step / high VRAM): `3.0 HAI`

On top of that, the workflow owner can set a **creator_markup %** — that markup becomes part of the payout split.

So if someone builds a high-value workflow (example: “enterprise-grade PII redaction for hospitals”), they can price it higher, and all contributors in that stack still get paid automatically.

---

## 4) $HAI Token Utility

$HAI isn’t just a reward token. It’s the core resource of the network.

### 4.1 Earn ($HAI comes to you)
- **Creators** earn $HAI every time someone runs their registered workflow / pipeline / model.  
- **Upstream contributors** earn $HAI when their assets (LoRAs, model weights, prompt graphs) are part of that workflow.  
- **Node operators** earn $HAI for doing the compute work (GPU / inference / execution).  
- **Validators** earn $HAI for confirming that the run was legit.

This is recurring revenue. You don’t just “sell your model once.”  
You keep earning based on usage.

### 4.2 Spend ($HAI goes out from you)
- **End users / apps** spend $HAI to trigger workflows and generate outputs.  
- **Teams / companies** spend $HAI for access to high-quality, verified AI behaviors instead of rebuilding that behavior from scratch.

As usage grows, demand for $HAI grows — it’s the medium of access.

### 4.3 Stake (skin in the game)
- **Node operators** must stake $HAI to be allowed to execute jobs in the network.  
- **Validators** must stake $HAI to verify jobs.

If you cheat, lie about execution, spam, or sign off on fake work, you lose part of your stake.  
That’s how the network defends itself without relying on one central company.

### 4.4 Govern (voice in the protocol)
Holders of $HAI participate in protocol governance:
- Royalty split ratios  
- Registry rules (what qualifies as a unique workflow vs a shallow clone)  
- Minimum stake requirements  
- Treasury spend: grants, onboarding incentives, audits, liquidity bootstraps  

Holders aren’t just voting on memes. They’re voting on how intelligence is valued.

---

## 5) Staking & Slashing

### 5.1 Node Operators
- **Minimum Stake:** `min_node_stake = 5,000 HAI` **(configurable)**  
- **Earnings:** Paid from each execution’s split.  
- **Slash Triggers:**  
  - Fake execution claims  
  - Repeated non-delivery  
  - Tampering with output

### 5.2 Validators
- **Minimum Stake:** `min_validator_stake = 10,000 HAI` **(configurable)**  
- **Earnings:** Paid from the validators’ 5% pool (shared proportional to verified work).  
- **Quorum Rule:** `k-of-N` attestations required to prove a job actually ran. Example: 3-of-5 signatures. **(configurable)**  
- **Slash Triggers:**  
  - Signing obviously invalid runs  
  - Colluding to rubber-stamp fake work  
  - Chronic downtime

### 5.3 Slashing Amounts (initial guidelines)
- Severe fraud / deliberate abuse: up to **100%** of stake  
- False attestation / bad data: **5–25%** per incident  
- Chronic downtime or non-performance: **1–5%** per epoch

Slashing rules are on-chain, transparent, and controlled by governance.

---

## 6) Anti-Abuse / Anti-Sybil / Anti-Wash Farming

Any “run task → get paid” system can be attacked. HavnAI bakes in defenses:

- **Stake-gated participation:**  
  You can’t spin up infinite fake nodes because each one needs $HAI at risk.

- **Validator quorum:**  
  Multiple validators must attest that a workflow actually ran. It’s not enough for you alone to say “I did work, pay me.”

- **Derivative detection / registry fingerprints:**  
  Workflows are registered with a structured manifest / hash tree. If someone clones your pipeline and makes a tiny change, the registry can flag that as a derivative — and route a share of rewards back to the original instead of letting a siphon farm you.

- **Minimum fee floor:**  
  Each run has a nonzero economic cost. You can’t execute “empty” garbage 10,000 times for free just to farm emissions.

- **Reputation weighting:**  
  Long-running, high-approval creators and nodes rank higher in discovery and get first access to premium demand. Low reputation = less surface = less chance to farm.

- **Treasury fraud bounty:**  
  The treasury can issue bounties (in $HAI) for reporting abuse or exploits that try to game payouts.

---

## 7) Token Supply & Distribution

> Initial values below are sane defaults and WILL evolve after audits, early testing, and community input. Treat this as first-pass modeling.

- **Chain:** EVM-compatible (Base / Polygon / etc. to start; final chain TBD).  
- **Token Standard:** ERC-20 compatible.  
- **Ticker:** $HAI

### 7.1 Supply
- **Max Supply (hard cap):** 1,000,000,000 HAI (1B)  
- **Initial Circulating at TGE:** ~120,000,000 HAI (12%)

The rest vests over time or is emitted through rewards.

### 7.2 Allocation

| Bucket                                    | % of Max Supply | Cliff / Lock              | Vesting / Release              |
|-------------------------------------------|----------------:|---------------------------|--------------------------------|
| **Community Rewards** (creators, node ops, validators) | 35%             | No cliff                  | Emitted over ~4-6 years        |
| **Ecosystem / Treasury** (grants, audits, liquidity, incentives) | 20%             | No cliff                  | DAO-governed spending          |
| **Core Contributors / Team**              | 15%             | 12-month cliff            | Linear vesting over 36 months  |
| **Early Backers / Strategic Partners**    | 15%             | 12-month cliff            | Linear vesting over 24 months  |
| **Validator / Security Fund**            | 10%             | No public unlock          | Streams based on network growth|
| **Public Launch / Liquidity Bootstrap**   | 5%              | At TGE                    | Used to seed initial liquidity |

**Notes:**
- “Community Rewards” is the single biggest piece on purpose.  
  The network should primarily belong to the people creating and running intelligence.
- “Validator / Security Fund” guarantees there’s always enough stake to secure early phases.

All cliffs / vesting are subject to governance and legal review pre-launch.

---

## 8) The Flywheel

1. **Creator registers a workflow** (with royalty rules)  
2. **User runs it** and pays in $HAI  
3. **Node executes it** and proves work happened  
4. **Validators attest** that it’s legit  
5. **Payout auto-splits** to everyone in the chain  
6. **Creator now has visible revenue history** (“this workflow has earned X HAI across Y runs”)  
7. **More creators join** because earning is real  
8. **More usage flows through** because the network has the best verified workflows  
9. **Demand for $HAI rises** because $HAI is required to access that verified intelligence

That’s the loop.  
It’s not hype-driven, it’s usage-driven.

---

## 9) What Makes $HAI Different From Just Paying in USDC?

Good question. People will ask this.

USDC can transfer money.  
USDC cannot run the network.

$HAI is required because:
- It’s the **unit of access**: you spend $HAI to run intelligence inside the network.  
- It’s the **unit of security**: you stake $HAI to operate or validate.  
- It’s the **unit of governance**: you hold $HAI to shape royalty rules, treasury usage, and protocol direction.  
- It’s the **unit of reputation**: your on-chain earnings in $HAI become your creation record.

USDC is payment.  
$HAI is the economy.

---

## 10) What This Enables

- A workflow isn’t just “some JSON you shared.” It becomes an on-chain asset with provable income.
- A model fine-tuner isn’t invisible anymore — they’re part of the royalty chain.
- GPU providers can earn without being Amazon or NVIDIA.
- AI developers don’t have to sell out to a platform just to survive.
- Creative intelligence stops being extracted and starts being owned.

HavnAI’s mission is simple:
**If machines are going to generate wealth, that wealth should flow back to the people who made that machine intelligence possible.**

Own Your Intelligence.  
Build once. Earn forever.
