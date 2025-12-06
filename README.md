# 🧠 HavnAI  
**Own Your Intelligence. Build once. Earn forever.**  
[https://joinhavn.io](https://joinhavn.io)

![HavnAI Logo](HavnAI-logo.png)

---

## 🚀 Vision  
AI is creating wealth — but not for its creators.  
HavnAI builds a decentralized layer where every workflow, model, and dataset becomes a **revenue-earning digital asset**.  

We call it **Proof of Creation** — the foundation of an economy that rewards human and machine intelligence equally.

---

## 💡 What Is HavnAI?  
HavnAI is an open protocol for **AI workflow royalties**.  
When your model, dataset, or automation powers another system, you keep earning — automatically.  
Whether you design, deploy, or run AI, your work is tokenized, traceable, and rewarded.

---

## 🪙 The $HAI Token  
The native token of the HavnAI network — **$HAI** — powers value flow between creators, operators, and users.

| Role | Earns $HAI By | Uses $HAI For |
|------|----------------|---------------|
| **Creators** | Publishing workflows/models that others build on | Royalties, staking reputation |
| **Operators** | Running compute or validation nodes | Fees, collateral |
| **Users** | Accessing verified AI intelligence | Licensing, subscriptions |

$HAI is more than currency — it’s **ownership of intelligence**.

---

## 🧩 Architecture (Preview)  
- **Workflow Registry** — On-chain signatures for AI pipelines  
- **Royalty Engine** — Automatic revenue sharing per execution  
- **Validation Network** — Staked nodes verify usage events  
- **Creator Dashboard** — Manage assets, earnings, and staking  

---

## 🗺️ Roadmap (2025)  
1. ✅ Brand & Launch Site – [joinhavn.io](https://joinhavn.io)  
2. 🧾 Whitepaper v1 (Proof of Creation Protocol)  
3. 🧱 Smart Contracts + Workflow Registry Prototype  
4. 💰 Token Economy Simulations & Creator Incentives  
5. 🌍 Mainnet Launch + Creator Royalty Dashboard  

---

## 🤝 Join the Movement  
Website → [**joinhavn.io**](https://joinhavn.io)  
Twitter / X → Coming Soon  
Discord → Coming Soon  
Email → team@joinhavn.io  

> _HavnAI is built for economic freedom — a future where intelligence pays its creators._

---

## 🚦 Private Alpha Status

| Capability | State |
|------------|-------|
| 🧠 Core Coordinator | ✅ Operational |
| 🖥️ Creator Node Installer | ✅ Working (Private Alpha) |
| 🧩 Model Registry | ✅ Hosting verified models |
| 💰 Reward Engine | ⚙️ Testing |
| 🪄 Dashboard UI | 🧱 In Development |
| 🌍 Public Node Join | 🚧 Coming Soon |

## 🔭 Current Focus

Validating the complete Creator Node image-generation pipeline across multiple GPUs. We are focused on reliability, model verification, and reward balancing before opening public onboarding.

### 🎞️ AnimateDiff Video Engine (12 GB Edition)

The HavnAI grid now supports an **SD 1.5 + AnimateDiff** video job type designed to fit comfortably on a **12 GB RTX 3060** class GPU.

- New job type: `animatediff`
- Base models (SD 1.5 checkpoints):
  - `realisticVision_v51.safetensors`
  - `perfectDeliberate_v5.safetensors`
  - `uberrealistic_pornmerge_v23.safetensors`
- Motion controls via LoRAs: `zoom-in`, `pan-left`, `tilt-up`, etc.
- VRAM-aware execution:
  - For `<14 GB` GPUs: force 512×512, ≤24 frames, DDIM/Euler schedulers, and AnimateDiff Lightning–style settings.
- Outputs are MP4 files stored under `static/outputs/videos/<job_id>.mp4`.

Submit an AnimateDiff job via the coordinator:

```bash
curl -X POST "$SERVER_URL/submit-job" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xYOUR_WALLET_ADDRESS",
    "model": "animatediff",
    "prompt": "a cinematic tracking shot through a neon-lit alley, ultra realistic",
    "negative_prompt": "lowres, blurry, watermark, text, bad anatomy",
    "frames": 24,
    "fps": 8,
    "motion": "zoom-in",
    "base_model": "realisticVision",
    "width": 512,
    "height": 512,
    "scheduler": "DDIM"
  }'
```

Then fetch the result metadata (including MP4 URL) with:

```bash
curl "$SERVER_URL/result/<job_id>"
```

## 🛠️ For Developers

- [havnai-core](https://github.com/marcusllittle/havnai-core)
- [havnai-node](https://github.com/marcusllittle/havnai-node)
- [havnai-web](https://github.com/marcusllittle/havnai-web)

> Network status: **Private Alpha** — GPU grid operational internally.
