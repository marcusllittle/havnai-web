## Economic Thesis
HavnAI positions $HAI as the programmable energy unit for decentralized intelligence. Demand for inference, creation, and verification converts directly into token velocity, while staking and governance turn $HAI into the coordination substrate that keeps the network truthful.

### Guiding Metrics
- Protocol revenue denominated in $HAI, not external stablecoins
- Stake coverage ratio > 3x total daily payouts
- Validator fault rate < 0.1% per epoch via aggressive slashing
- Treasury solvency runway > 36 months even under stress scenarios

## Role Flywheel
| Actor | Earns $HAI | Locks $HAI | Spends $HAI | Strategic Note |
|-------|------------|------------|-------------|----------------|
| Creators | Royalties each time their workflow graph runs | Optional staking boosts for discovery | Workflow upgrades, co-marketing | Earnings history becomes on-chain IP valuation |
| Upstream Contributors | Recursive royalty share when dependent assets activate | Reputation staking for authenticity badges | Access to premium datasets | Incentivizes remix culture without extraction |
| Node Operators | Execution fees proportional to compute class | Mandatory bond tied to hardware profile | Runtime upgrades, insurance | Collateral scales with claimed performance |
| Validators | Verification rewards per accepted batch | Mandatory bond with escalating slashing | Monitoring infra, challenge tooling | Earns higher APY for lower false-negative rate |
| DAO Treasury | Protocol skim + unclaimed royalties | Strategic escrow for audits and grants | Grants, liquidity, ecosystem accelerators | Maintains flywheel during early volatility |

### Incentive Channels
- **Usage Rewards:** Purely driven by workflow demand; no artificial farming loops.
- **Staking Yields:** Derived from execution fees, not fresh emission, keeping flywheel organic.
- **Governance Rewards:** Proposal execution subsidies encourage active stewardship.

## Supply Architecture
| Allocation Bucket | % of Max Supply | Unlock Cadence | Purpose |
|-------------------|----------------:|----------------|---------|
| Community Rewards | 35% | Continuous emission over 5 years | Workflow, node, and validator rewards |
| Ecosystem Treasury | 20% | DAO-controlled streaming | Grants, audits, liquidity, risk funds |
| Core Contributors | 15% | 12-month cliff, 36-month linear | Long-term builder retention |
| Strategic Backers | 15% | 12-month cliff, 24-month linear | Strategic capital, exchange relationships |
| Validator Security Fund | 10% | Unlocked on demand with slashing covenants | Early network security bootstrap |
| Public Bootstrap | 5% | TGE liquidity | Market access, price discovery |

### Emission Schedule
- Epoch length: 1 week
- Emission decay: 9% annual reduction until asymptotic stabilization
- Emission routing: 70% execution mining, 20% validator rewards, 10% integrity bounties
- Emergency brake: governance can pause emissions with >66% quorum if anomalies detected

## Utility Stack
### Spend
- End users and enterprises pay $HAI to execute workflows and unlock premium AI services.
- Access passes for high-demand compute queues priced dynamically in $HAI.

### Earn
- Creators and upstream contributors receive instant royalty splits after each validated execution.
- Node operators accrue compute rewards proportional to runtime profile and SLA adherence.

### Stake
- Nodes and validators collateralize $HAI to join active sets; penalties burn and redistribute to honest actors.
- Reputation staking for creators unlocks feature placement and anti-sybil guarantees.

### Govern
- $HAI is the vote weight for treasury allocations, parameter tuning, and contract upgrades.
- Delegation framework allows passive holders to empower specialized policy councils.

## Fee Topology
- Base protocol fee: dynamic, pegged to moving average of hardware costs.
- Creator markup: programmable percentage share, capped by governance to prevent abuse.
- Surge multiplier: activates when queue length crosses threshold, redirecting excess to treasury stability pool.

## Reward Algorithm
```python
TOTAL_BPS = 10_000
split = registry.get_split(workflow_id)

def distribute(job_fee, dependencies):
    payouts = {
        "creator": job_fee * split.creator_bps / TOTAL_BPS,
        "upstream_pool": job_fee * split.upstream_bps / TOTAL_BPS,
        "node": job_fee * split.node_bps / TOTAL_BPS,
        "validator_pool": job_fee * split.validator_bps / TOTAL_BPS,
        "treasury": job_fee * split.treasury_bps / TOTAL_BPS,
    }
    for asset in dependencies:
        share = payouts["upstream_pool"] * asset.weight
        send(asset.owner, share)
    send(workflow.creator, payouts["creator"])
    send(node.operator, payouts["node"])
    distribute_validator_pool(payouts["validator_pool"])
    send(treasury.address, payouts["treasury"])
```

## Treasury Mandate
- Maintain minimum 18-month operating runway in liquid $HAI and correlated assets.
- Allocate up to 20% of annual inflows to grants for workflow innovation.
- Deploy structured products (covered calls, validator insurance) only after governance stress test.

## Risk Controls
### Anti-Wash Safeguards
- Execution floor price eliminates zero-cost spam.
- Cross-check of node receipts and validator attestations prevents self-dealing.

### Liquidity Strategy
- Programmatic market making around key price bands funded by Public Bootstrap allocation.
- Treasury-owned liquidity pairs seeded to reduce slippage and stabilize demand shocks.

### Contingency Measures
- Rapid-response council empowered to trigger emission brake and stake quarantine.
- Insurance backstop covers catastrophic validator failures using Validator Security Fund.
