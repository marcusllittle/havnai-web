## Mission
The HavnAI Aurora Testnet validates the complete intelligence flywheel: workflow registration, decentralized execution, validator attestation, and automated $HAI payouts. The objective is to harden the economic and technical assumptions before mainnet activation.

## Phase Timeline
| Phase | Duration | Focus | Exit Criteria |
|-------|----------|-------|---------------|
| Constellation | Week 0-1 | Genesis setup, faucet, stake onboarding | 50 nodes staked, 20 workflows registered |
| Pulse | Week 2-3 | Execution throughput and validator latency | Sustained 100 jobs/hour with <3% failure |
| Resonance | Week 4-5 | Stress scenarios, slashing drills, payout reconciliation | Successful double-spend prevention tests |
| Prism | Week 6 | Community governance dry-run | First treasury proposal executed on testnet |

## Execution Loop Blueprint
1. Creator publishes manifest and royalty topology using testnet CLI.
2. Node stakes mock $HAI, advertises compute class, and subscribes to job queue.
3. User submits workflow invocation through web console or API.
4. Node executes job, signs receipt, pushes to validator mesh.
5. Validators reach quorum and commit to ExecutionLog contract.
6. PayoutRouter distributes simulated $HAI to all parties; analytics dashboard updates.

### Workflow Onboarding
- Curated starter pack: diffusion pipeline, LLM agent, audio synthesizer.
- Derivative tracking verified by comparing manifest hashes with canonical library.
- Faucet-delivered mock $HAI covers publishing costs and initial staking.

### Node Operations
- Requirement: minimum of 8 GB VRAM with GPU metrics reporting enabled.
- SLA monitor tracks queue time, job completion, and error codes.
- Weekly chaos simulations inject latency spikes and forced restarts to test resilience.

### Validator Cadence
- Validator quorum of 5 with rotating lead aggregator.
- Attestation protocol includes random re-execution of 10% of jobs.
- Slash rehearsal once per phase to validate bond confiscation flow.

### Payout Simulation
```python
def testnet_payout(job_id):
    record = execution_log.fetch(job_id)
    assert record.quorum_met
    simulated_fee = pricing.oracle(job_id)
    distribute(simulated_fee, record.workflow_id, record.dependencies)
    update_dashboard(record, simulated_fee)
```

- Treasury maintains ledger mirroring expected mainnet accounting rules.
- Manual reconciliation at end of each phase ensures deterministic payouts.

## Success Metrics
- 95%+ validator attestation accuracy across all phases
- <1% occurrence of stuck payouts or orphaned receipts
- Creator retention >80% from registration to phase completion
- Comprehensive incident post-mortems published within 48 hours

## Risk Mitigation
- Emergency pause switch guarded by multi-sig of Testnet Council.
- Dedicated bug bounty for workflow registry and payout anomalies.
- Red-team exercises target validator consensus and stake manipulation.

## Iteration Path
- Incorporate feedback loops from analytics to adjust fee multipliers.
- Expand supported compute classes based on observed demand.
- Prepare migration scripts for mainnet genesis snapshot once metrics satisfied.
