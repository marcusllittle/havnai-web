import type { NextPage } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import {
  type AstraReceiptBatch,
  type AstraReceiptBatchesResponse,
  createAstraReceiptBatchWithMetaMask,
  fetchAstraReceiptBatches,
} from "../lib/havnai";
import {
  anchorReceiptBatchOnSepolia,
  type ReceiptAnchorProgress,
  verifyPendingReceiptBatchAnchor,
} from "../lib/receipt-anchors";

const ANCHOR_PROGRESS: Record<ReceiptAnchorProgress, string> = {
  connecting: "Connecting treasury wallet",
  switching_network: "Switching to Sepolia",
  awaiting_transaction: "Awaiting MetaMask approval",
  confirming: "Waiting for confirmations",
  registering: "Verifying with coordinator",
};

function shortHash(value?: string | null, start = 10, end = 8): string {
  if (!value) return "--";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatTimestamp(value?: number | null): string {
  if (!value) return "--";
  return new Date(value * 1000).toLocaleString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Receipt anchor operation failed.";
}

const ReceiptAnchorsPage: NextPage = () => {
  const [data, setData] = useState<AstraReceiptBatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [copiedBatch, setCopiedBatch] = useState<number | null>(null);
  const [liveTransactions, setLiveTransactions] = useState<Record<number, string>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setData(await fetchAstraReceiptBatches(100));
      if (!quiet) setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingBatches = useMemo(
    () => data?.batches.filter((batch) => batch.status === "pending" && batch.anchor_tx_hash) ?? [],
    [data]
  );

  useEffect(() => {
    if (pendingBatches.length === 0) return;
    const timer = window.setInterval(() => {
      void Promise.allSettled(pendingBatches.map(verifyPendingReceiptBatchAnchor)).then(() => load(true));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load, pendingBatches]);

  const buildBatch = async () => {
    if (!data?.treasury_wallet) {
      setNotice({ tone: "error", text: "Coordinator treasury wallet is not configured." });
      return;
    }
    setBusy("build");
    setNotice(null);
    try {
      const result = await createAstraReceiptBatchWithMetaMask(
        data.treasury_wallet,
        100,
        1,
        (step) => setNotice({ tone: "info", text: step === "awaiting_signature" ? "Awaiting treasury signature" : "Authorizing batch build" })
      );
      setNotice({
        tone: "success",
        text: result.created && result.batch
          ? `Batch ${result.batch.batch_id} built with ${result.batch.leaf_count} receipts.`
          : "No receipts are waiting for a batch.",
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const anchorBatch = async (batch: AstraReceiptBatch) => {
    setBusy(`anchor:${batch.batch_id}`);
    setNotice(null);
    try {
      const result = await anchorReceiptBatchOnSepolia(
        batch,
        data?.minimum_confirmations ?? 2,
        (step, txHash) => {
          if (txHash) {
            setLiveTransactions((current) => ({ ...current, [batch.batch_id]: txHash }));
          }
          setNotice({ tone: "info", text: ANCHOR_PROGRESS[step] });
        }
      );
      setNotice({
        tone: result.status === "anchored" ? "success" : "info",
        text: result.status === "anchored"
          ? `Batch ${batch.batch_id} is anchored on Sepolia.`
          : `Batch ${batch.batch_id} is awaiting confirmations.`,
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const verifyBatch = async (batch: AstraReceiptBatch) => {
    setBusy(`verify:${batch.batch_id}`);
    setNotice({ tone: "info", text: "Checking Sepolia confirmations" });
    try {
      const result = await verifyPendingReceiptBatchAnchor(batch);
      setNotice({
        tone: result.status === "anchored" ? "success" : "info",
        text: result.status === "anchored"
          ? `Batch ${batch.batch_id} is anchored on Sepolia.`
          : `Batch ${batch.batch_id} still needs confirmations.`,
      });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const copyRoot = async (batch: AstraReceiptBatch) => {
    await navigator.clipboard.writeText(batch.merkle_root);
    setCopiedBatch(batch.batch_id);
    window.setTimeout(() => setCopiedBatch((current) => current === batch.batch_id ? null : current), 1500);
  };

  const anchoredCount = data?.batches.filter((batch) => batch.status === "anchored").length ?? 0;

  return (
    <>
      <SeoHead
        title="Receipt Anchors"
        description="Operate and verify HavnAI artifact receipt anchors on Sepolia."
        path="/receipt-anchors"
        noindex
      />
      <SiteHeader />
      <main className="receipt-anchor-page">
        <div className="receipt-anchor-shell">
          <header className="receipt-anchor-titlebar">
            <div>
              <span className="receipt-anchor-kicker">Network Operations</span>
              <h1>Receipt Anchors</h1>
            </div>
            <div className="receipt-anchor-title-actions">
              <button type="button" className="receipt-anchor-button secondary" onClick={() => void load()} disabled={loading || Boolean(busy)}>
                Refresh
              </button>
              <button
                type="button"
                className="receipt-anchor-button primary"
                onClick={() => void buildBatch()}
                disabled={loading || Boolean(busy) || !data?.unbatched_receipt_count}
              >
                {busy === "build" ? "Authorizing..." : "Build Batch"}
              </button>
            </div>
          </header>

          <section className="receipt-anchor-metrics" aria-label="Anchor summary">
            <div><span>Network</span><strong>Sepolia</strong></div>
            <div><span>Unbatched</span><strong>{data?.unbatched_receipt_count ?? "--"}</strong></div>
            <div><span>Pending</span><strong>{pendingBatches.length}</strong></div>
            <div><span>Anchored</span><strong>{anchoredCount}</strong></div>
            <div className="receipt-anchor-treasury"><span>Treasury</span><strong title={data?.treasury_wallet || undefined}>{shortHash(data?.treasury_wallet, 8, 6)}</strong></div>
          </section>

          {notice && <div className="receipt-anchor-notice" data-tone={notice.tone}>{notice.text}</div>}

          <section className="receipt-anchor-ledger" aria-label="Receipt anchor batches">
            <header>
              <div>
                <span>Merkle Ledger</span>
                <h2>Artifact receipt batches</h2>
              </div>
              <Link href="/nodes">Back to Network</Link>
            </header>

            {loading ? (
              <div className="receipt-anchor-empty">Loading receipt ledger...</div>
            ) : !data || data.batches.length === 0 ? (
              <div className="receipt-anchor-empty">No receipt batches found.</div>
            ) : (
              <div className="receipt-anchor-list">
                {data.batches.map((batch) => {
                  const transactionHash = batch.anchor_tx_hash || liveTransactions[batch.batch_id];
                  const transactionUrl = transactionHash
                    ? `https://sepolia.etherscan.io/tx/${transactionHash}`
                    : null;
                  const isBusy = busy?.endsWith(`:${batch.batch_id}`) ?? false;
                  return (
                    <article key={batch.batch_id} className="receipt-anchor-row" data-status={batch.status}>
                      <div className="receipt-anchor-identity">
                        <span className="receipt-anchor-batch-id">Batch {batch.batch_id}</span>
                        <span className="receipt-anchor-status"><i />{batch.status}</span>
                      </div>
                      <div className="receipt-anchor-root">
                        <span>Merkle root</span>
                        <code title={batch.merkle_root}>{shortHash(batch.merkle_root, 16, 12)}</code>
                      </div>
                      <div className="receipt-anchor-meta">
                        <div><span>Receipts</span><strong>{batch.leaf_count}</strong></div>
                        <div><span>Created</span><strong>{formatTimestamp(batch.created_at)}</strong></div>
                        <div><span>Block</span><strong>{batch.anchor_block ?? "--"}</strong></div>
                      </div>
                      <div className="receipt-anchor-row-actions">
                        <button type="button" className="receipt-anchor-button secondary" onClick={() => void copyRoot(batch)}>
                          {copiedBatch === batch.batch_id ? "Copied" : "Copy Root"}
                        </button>
                        {batch.status === "ready" && (
                          <button type="button" className="receipt-anchor-button primary" disabled={isBusy || Boolean(busy)} onClick={() => void anchorBatch(batch)}>
                            {isBusy ? "Processing..." : "Anchor on Sepolia"}
                          </button>
                        )}
                        {batch.status === "pending" && (
                          <button type="button" className="receipt-anchor-button warning" disabled={isBusy || Boolean(busy)} onClick={() => void verifyBatch(batch)}>
                            {isBusy ? "Checking..." : "Verify Confirmations"}
                          </button>
                        )}
                        {batch.status === "anchored" && transactionUrl && (
                          <a className="receipt-anchor-button verified" href={transactionUrl} target="_blank" rel="noreferrer">View Transaction</a>
                        )}
                      </div>
                      {transactionUrl && batch.status !== "anchored" && (
                        <a className="receipt-anchor-tx" href={transactionUrl} target="_blank" rel="noreferrer">
                          {shortHash(transactionHash, 14, 10)}
                        </a>
                      )}
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

export default ReceiptAnchorsPage;
