import type { NextPage } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "../components/WalletProvider";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import {
  createNodeRewardBatchWithMetaMask,
  fetchNodeRewardBatches,
  fetchNodeRewardClaims,
  type NodeRewardBatch,
  type NodeRewardBatchesResponse,
  type NodeRewardClaim,
} from "../lib/havnai";
import {
  claimNodeRewardOnSepolia,
  fundAndPublishNodeRewardBatch,
  type NodeRewardClaimProgress,
  type NodeRewardPublishProgress,
  verifyPendingNodeRewardBatch,
  verifyPendingNodeRewardClaim,
} from "../lib/node-reward-claims";
import { getConnectButtonLabel } from "../lib/wallet";

type Notice = { tone: "success" | "error" | "info"; text: string };

const PUBLISH_PROGRESS: Record<NodeRewardPublishProgress, string> = {
  connecting: "Connecting treasury wallet",
  switching_network: "Switching to Sepolia",
  checking_funding: "Checking contract reserves",
  awaiting_funding: "Awaiting HAI funding approval",
  confirming_funding: "Confirming contract funding",
  awaiting_publish: "Awaiting reward root approval",
  confirming_publish: "Confirming reward root",
  registering: "Verifying publication with coordinator",
};

const CLAIM_PROGRESS: Record<NodeRewardClaimProgress, string> = {
  connecting: "Connecting operator wallet",
  switching_network: "Switching to Sepolia",
  awaiting_claim: "Awaiting claim approval",
  confirming_claim: "Confirming HAI claim",
  registering: "Verifying claim with coordinator",
};

function shortHash(value?: string | null, start = 9, end = 7): string {
  if (!value) return "--";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatHai(value: string | number | undefined): string {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0 HAI";
  return `${parsed.toLocaleString(undefined, { maximumFractionDigits: 6 })} HAI`;
}

function formatTimestamp(value?: number | null): string {
  return value ? new Date(value * 1000).toLocaleString() : "--";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Node reward operation failed.";
}

function claimStatus(claim: NodeRewardClaim): "claimed" | "claimable" | "pending" | "invalid" {
  if (claim.claimed) return "claimed";
  if (!claim.valid) return "invalid";
  if (claim.batch_status === "published") return "claimable";
  return "pending";
}

const NodeRewardsPage: NextPage = () => {
  const wallet = useWallet();
  const [data, setData] = useState<NodeRewardBatchesResponse | null>(null);
  const [claims, setClaims] = useState<NodeRewardClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [liveTransactions, setLiveTransactions] = useState<Record<string, string>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [batchData, claimData] = await Promise.all([
        fetchNodeRewardBatches(100),
        wallet.activeWallet
          ? fetchNodeRewardClaims(wallet.activeWallet)
          : Promise.resolve({ wallet: "", claims: [] }),
      ]);
      setData(batchData);
      setClaims(claimData.claims);
      if (!quiet) setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [wallet.activeWallet]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingBatches = useMemo(
    () => data?.batches.filter((batch) => batch.status === "pending" && batch.publish_tx_hash) ?? [],
    [data]
  );

  useEffect(() => {
    if (pendingBatches.length === 0) return;
    const timer = window.setInterval(() => {
      void Promise.allSettled(pendingBatches.map(verifyPendingNodeRewardBatch)).then(() => load(true));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load, pendingBatches]);

  const isTreasury = Boolean(
    wallet.connectedWallet &&
    data?.treasury_wallet &&
    wallet.connectedWallet.toLowerCase() === data.treasury_wallet.toLowerCase()
  );
  const claimableTotal = claims
    .filter((claim) => claimStatus(claim) === "claimable")
    .reduce((total, claim) => total + Number(claim.amount_hai), 0);
  const claimedTotal = claims
    .filter((claim) => claim.claimed)
    .reduce((total, claim) => total + Number(claim.amount_hai), 0);

  const connect = async () => {
    setBusy("connect");
    setNotice(null);
    try {
      const connected = await wallet.connect();
      if (connected) setNotice({ tone: "success", text: `Connected ${shortHash(connected)}.` });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const buildBatch = async () => {
    if (!data?.treasury_wallet) {
      setNotice({ tone: "error", text: "Coordinator treasury wallet is not configured." });
      return;
    }
    setBusy("build");
    setNotice(null);
    try {
      const result = await createNodeRewardBatchWithMetaMask(
        data.treasury_wallet,
        500,
        1,
        (step) => setNotice({
          tone: "info",
          text: step === "awaiting_signature" ? "Awaiting treasury signature" : "Authorizing payout snapshot",
        })
      );
      setNotice({
        tone: "success",
        text: result.created && result.batch
          ? `Reward batch ${result.batch.batch_id} created for ${formatHai(result.batch.total_amount_hai)}.`
          : "No finalized payouts are waiting for a batch.",
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const publishBatch = async (batch: NodeRewardBatch) => {
    setBusy(`publish:${batch.batch_id}`);
    setNotice(null);
    try {
      const result = await fundAndPublishNodeRewardBatch(
        batch,
        data?.minimum_confirmations ?? 2,
        (step, txHash) => {
          if (txHash) setLiveTransactions((current) => ({ ...current, [`batch:${batch.batch_id}`]: txHash }));
          setNotice({ tone: "info", text: PUBLISH_PROGRESS[step] });
        }
      );
      setNotice({
        tone: result.status === "published" ? "success" : "info",
        text: result.status === "published"
          ? `Reward batch ${batch.batch_id} is funded and published.`
          : `Reward batch ${batch.batch_id} is awaiting confirmations.`,
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const verifyBatch = async (batch: NodeRewardBatch) => {
    setBusy(`verify:${batch.batch_id}`);
    setNotice({ tone: "info", text: "Checking Sepolia confirmations" });
    try {
      const result = await verifyPendingNodeRewardBatch(batch);
      setNotice({
        tone: result.status === "published" ? "success" : "info",
        text: result.status === "published"
          ? `Reward batch ${batch.batch_id} is published.`
          : `Reward batch ${batch.batch_id} still needs confirmations.`,
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const claimReward = async (claim: NodeRewardClaim) => {
    const key = `${claim.batch_id}:${claim.leaf_index}`;
    setBusy(`claim:${key}`);
    setNotice(null);
    try {
      const result = await claimNodeRewardOnSepolia(
        claim,
        claim.minimum_confirmations,
        (step, txHash) => {
          if (txHash) setLiveTransactions((current) => ({ ...current, [`claim:${key}`]: txHash }));
          setNotice({ tone: "info", text: CLAIM_PROGRESS[step] });
        }
      );
      setNotice({
        tone: result.status === "claimed" ? "success" : "info",
        text: result.status === "claimed"
          ? `${formatHai(claim.amount_hai)} claimed on Sepolia.`
          : "Claim transaction is awaiting coordinator confirmations.",
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const verifyClaim = async (claim: NodeRewardClaim, txHash: string) => {
    const key = `${claim.batch_id}:${claim.leaf_index}`;
    setBusy(`verify-claim:${key}`);
    setNotice({ tone: "info", text: "Checking Sepolia claim confirmations" });
    try {
      const result = await verifyPendingNodeRewardClaim(claim, txHash);
      setNotice({
        tone: result.status === "claimed" ? "success" : "info",
        text: result.status === "claimed" ? `${formatHai(claim.amount_hai)} claim verified.` : "Claim still needs confirmations.",
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SeoHead
        title="Node Rewards"
        description="Publish and claim HavnAI node rewards on Sepolia."
        path="/node-rewards"
        noindex
      />
      <SiteHeader />
      <main className="node-reward-page">
        <div className="node-reward-shell">
          <header className="node-reward-titlebar">
            <div>
              <span className="node-reward-kicker">Network Settlement</span>
              <h1>Node Rewards</h1>
            </div>
            <div className="node-reward-title-actions">
              {!wallet.connectedWallet && (
                <button type="button" className="node-reward-button primary" onClick={() => void connect()} disabled={busy === "connect"}>
                  {busy === "connect" ? "Connecting..." : getConnectButtonLabel(wallet)}
                </button>
              )}
              <button type="button" className="node-reward-button secondary" onClick={() => void load()} disabled={loading || Boolean(busy)}>
                Refresh
              </button>
              <button
                type="button"
                className="node-reward-button primary"
                onClick={() => void buildBatch()}
                disabled={loading || Boolean(busy) || !isTreasury || !data?.unbatched_payout_count}
              >
                {busy === "build" ? "Authorizing..." : "Build Reward Batch"}
              </button>
            </div>
          </header>

          <section className="node-reward-metrics" aria-label="Node reward summary">
            <div><span>Network</span><strong>Sepolia</strong></div>
            <div><span>Unbatched payouts</span><strong>{data?.unbatched_payout_count ?? "--"}</strong></div>
            <div><span>Claimable</span><strong>{formatHai(claimableTotal)}</strong></div>
            <div><span>Claimed</span><strong>{formatHai(claimedTotal)}</strong></div>
            <div><span>Active wallet</span><strong title={wallet.activeWallet || undefined}>{shortHash(wallet.activeWallet)}</strong></div>
          </section>

          {notice && <div className="node-reward-notice" data-tone={notice.tone}>{notice.text}</div>}

          <section className="node-reward-ledger" aria-label="Operator reward claims">
            <header>
              <div>
                <span>Operator Ledger</span>
                <h2>Your claim proofs</h2>
              </div>
              <Link href="/nodes">Back to Network</Link>
            </header>
            {loading ? (
              <div className="node-reward-empty">Loading operator rewards...</div>
            ) : !wallet.activeWallet ? (
              <div className="node-reward-empty">Connect the node operator wallet.</div>
            ) : claims.length === 0 ? (
              <div className="node-reward-empty">No reward claims found for this wallet.</div>
            ) : (
              <div className="node-reward-list">
                {claims.map((claim) => {
                  const key = `${claim.batch_id}:${claim.leaf_index}`;
                  const status = claimStatus(claim);
                  const liveTx = liveTransactions[`claim:${key}`];
                  const txHash = claim.claimed_tx_hash || liveTx;
                  const isBusy = busy?.endsWith(key) ?? false;
                  return (
                    <article className="node-reward-row claim" data-status={status} key={key}>
                      <div className="node-reward-identity">
                        <span>Batch {claim.batch_id}</span>
                        <span className="node-reward-status"><i />{status}</span>
                      </div>
                      <div className="node-reward-amount">
                        <span>Operator reward</span>
                        <strong>{formatHai(claim.amount_hai)}</strong>
                      </div>
                      <div className="node-reward-meta">
                        <div><span>Jobs</span><strong>{claim.payout_count}</strong></div>
                        <div><span>Nodes</span><strong title={claim.node_ids.join(", ")}>{claim.node_ids.length}</strong></div>
                        <div><span>Proof</span><strong>{claim.valid ? "Valid" : "Invalid"}</strong></div>
                      </div>
                      <div className="node-reward-row-actions">
                        {status === "claimable" && (
                          <button type="button" className="node-reward-button primary" disabled={Boolean(busy) || !wallet.connectedWallet} onClick={() => void claimReward(claim)}>
                            {isBusy ? "Claiming..." : "Claim HAI"}
                          </button>
                        )}
                        {!claim.claimed && liveTx && (
                          <button type="button" className="node-reward-button warning" disabled={Boolean(busy)} onClick={() => void verifyClaim(claim, liveTx)}>
                            {isBusy ? "Checking..." : "Verify Claim"}
                          </button>
                        )}
                        {txHash && (
                          <a className="node-reward-button verified" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                            View Transaction
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="node-reward-ledger treasury" aria-label="Treasury reward batches">
            <header>
              <div>
                <span>Treasury Ledger</span>
                <h2>Immutable payout roots</h2>
              </div>
              <strong title={data?.claim_contract || undefined}>{shortHash(data?.claim_contract)}</strong>
            </header>
            {loading ? (
              <div className="node-reward-empty">Loading payout roots...</div>
            ) : !data || data.batches.length === 0 ? (
              <div className="node-reward-empty">No payout batches found.</div>
            ) : (
              <div className="node-reward-list">
                {data.batches.map((batch) => {
                  const transactionHash = batch.publish_tx_hash || liveTransactions[`batch:${batch.batch_id}`];
                  const isBusy = busy?.endsWith(`:${batch.batch_id}`) ?? false;
                  return (
                    <article className="node-reward-row batch" data-status={batch.status} key={batch.batch_id}>
                      <div className="node-reward-identity">
                        <span>Batch {batch.batch_id}</span>
                        <span className="node-reward-status"><i />{batch.status}</span>
                      </div>
                      <div className="node-reward-amount">
                        <span>Committed liability</span>
                        <strong>{formatHai(batch.total_amount_hai)}</strong>
                      </div>
                      <div className="node-reward-meta">
                        <div><span>Operators</span><strong>{batch.leaf_count}</strong></div>
                        <div><span>Payouts</span><strong>{batch.payout_count}</strong></div>
                        <div><span>Created</span><strong>{formatTimestamp(batch.created_at)}</strong></div>
                      </div>
                      <div className="node-reward-row-actions">
                        {batch.status === "ready" && (
                          <button type="button" className="node-reward-button primary" disabled={Boolean(busy) || !isTreasury} onClick={() => void publishBatch(batch)}>
                            {isBusy ? "Processing..." : "Fund & Publish"}
                          </button>
                        )}
                        {batch.status === "pending" && (
                          <button type="button" className="node-reward-button warning" disabled={Boolean(busy)} onClick={() => void verifyBatch(batch)}>
                            {isBusy ? "Checking..." : "Verify Confirmations"}
                          </button>
                        )}
                        {transactionHash && (
                          <a className="node-reward-button verified" href={`https://sepolia.etherscan.io/tx/${transactionHash}`} target="_blank" rel="noreferrer">
                            View Transaction
                          </a>
                        )}
                      </div>
                      <code className="node-reward-root" title={batch.merkle_root}>{shortHash(batch.merkle_root, 15, 11)}</code>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default NodeRewardsPage;
