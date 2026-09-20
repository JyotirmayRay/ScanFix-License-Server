# ScanFix License Server (Control Plane & Authority)

A standalone software licensing server for ScanFix SaaS. Enables software vendors and resellers to issue cryptographically signed license keys, enforce domain binding, and execute remote revocations.

---

## Features

- **Asymmetric Cryptography:** Signs licenses with Ed25519 digital signatures. Instances verify authenticity using the public key.
- **Strict Domain Binding:** Locks installations to specific domains (`clientdomain.com`, `*.clientdomain.com`, with `localhost` toggle for local development).
- **Remote Kill Switch:** Instantly revoke or suspend licenses from the dashboard.
- **Reseller Multi-Tenancy:** Onboard resellers, assign license quotas (e.g. 50 keys), and allow them to manage their own customer keys.
- **Telemetry & Audit Logs:** Real-time log of every activation attempt, IP address, and heartbeat check-in.
- **Zero-Dependency Storage:** File-backed persistent storage in `data/db.json` with zero database setup required.

---

## Getting Started

### 1. Installation

```bash
pnpm install
# or npm install
```

### 2. Run Locally

```bash
pnpm dev
# Runs on http://localhost:4001
```

### 3. Build & Production

```bash
pnpm build
pnpm start
```

---

## Environment Variables (Optional for Cloud/Vercel)

```env
# Optional: Set custom private/public keypair in env if deploying to serverless platforms
LICENSE_SERVER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
LICENSE_SERVER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
```

---

## API Endpoints

- `POST /api/v1/license/activate` — Binds client domain and returns signed token
- `POST /api/v1/license/verify` — Validates heartbeat and active status
- `POST /api/v1/license/deactivate` — Releases domain for server migrations
- `GET /api/v1/license/public-key` — Returns server's Ed25519 public key
- `POST /api/v1/admin/licenses` — Generates a new license key
- `PATCH /api/v1/admin/licenses/:id` — Suspends, revokes, or extends a license
- `POST /api/v1/admin/resellers` — Onboards a new reseller partner
