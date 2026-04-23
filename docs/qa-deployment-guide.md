# QA Deployment Guide: salig-affiliate on Coolify

> **Scope**: Deploy the `salig-affiliate` application (Next.js 16 frontend + Convex self-hosted backend) to a **QA environment** using Coolify v4.
> **Audience**: DevOps team and senior developers
> **Last Updated**: 2026-04-23

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Deploy Convex (Self-Hosted)](#phase-1-deploy-convex-self-hosted)
4. [Phase 2: Deploy Next.js Frontend](#phase-2-deploy-nextjs-frontend)
5. [Phase 3: Environment Variables](#phase-3-environment-variables)
6. [Phase 4: Domain & SSL](#phase-4-domain--ssl)
7. [Phase 5: Initial Seeding](#phase-5-initial-seeding)
8. [Phase 6: Verification](#phase-6-verification)
9. [DevOps Runbook](#devops-runbook)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                                  Internet
                                      |
                                      | HTTPS
                                      v
                    +-----------------------------------+
                    |   Coolify Server (VPS)            |
                    |   OS: Ubuntu 22.04/24.04          |
                    +-----------------------------------+
                                      |
                    +-----------------+-----------------+
                    |                                   |
            +-------v--------+                +---------v----------+
            |   Traefik      |                |   Traefik          |
            |   (Proxy)      |                |   (Proxy)          |
            +-------+--------+                +---------+----------+
                    |                                   |
       +------------v-----------+          +-----------v-------------+
       |  Next.js App           |          |  Convex Backend         |
       |  (Coolify Application) |          |  (Coolify Service)      |
       |  Port: 3000            |          |  Ports: 3210, 3211      |
       |  Build: Nixpacks/Docker|          |  Image: get-convex/...  |
       +------------+-----------+          +-----------+-------------+
                    |                                   |
                    | Internal Docker Network           |
                    +------------------+----------------+
                                       |
                         +-------------v--------------+
                         |  Convex Database (SQLite)  |
                         |  Inside Convex container   |
                         +----------------------------+
```

**Key Details**:
- **Convex exposes TWO ports** from a single container:
  - `3210` — Backend API (queries, mutations, WebSocket subscriptions)
  - `3211` — HTTP Actions (REST endpoints, webhooks)
- Next.js communicates with Convex via **internal Docker network** (not public internet)
- Both services run on the same Coolify-managed Docker network

---

## Prerequisites

### 1. Infrastructure

| Requirement | Specification | Notes |
|-------------|--------------|-------|
| **Server** | VPS with 4GB+ RAM, 2+ vCPUs | 2GB minimum, 4GB recommended for QA |
| **OS** | Ubuntu 22.04 LTS or 24.04 LTS | Coolify officially supports these |
| **Disk** | 40GB+ SSD | Convex DB grows over time; monitor usage |
| **Docker** | 24.0+ | Installed automatically by Coolify installer |
| **Coolify** | v4.0.0-beta.470+ | Latest stable beta as of April 2026 |

### 2. DNS

- A domain or subdomain for the QA environment (e.g., `qa.yourdomain.com`)
- A separate subdomain for Convex backend (e.g., `convex-qa.yourdomain.com`)
- DNS A records pointing to your Coolify server IP

### 3. Repository Access

- Git repository with the `salig-affiliate` codebase
- Coolify must have read access (GitHub/GitLab token or SSH key)

### 4. Local Tools

- `pnpm` installed locally (for seeding operations)
- `npx convex` CLI available (for deployments)

---

## Phase 1: Deploy Convex (Self-Hosted)

### Step 1.1: Add Convex Service in Coolify

1. Log in to your Coolify dashboard
2. Navigate to your **Project** (or create one: `salig-affiliate-qa`)
3. Click **Add New Resource** → **Service**
4. In the service catalog, search for **"Convex"**
5. Select the official Convex service template
6. Configure:
   - **Name**: `convex-qa`
   - **Description**: `Self-hosted Convex backend for salig-affiliate QA`
   - **Server**: Select your Coolify server
7. Click **Create**

### Step 1.2: Verify Convex Environment Variables

> **CRITICAL**: There was a known bug in Coolify's Convex template (Issue #5569) where `CONVEX_CLOUD_ORIGIN` and `CONVEX_SITE_ORIGIN` pointed to the wrong FQDN. Ensure your Coolify version is **v4.0.0-beta.419+** where this was fixed.

Navigate to your Convex service → **Environment Variables** and verify the following are auto-populated:

| Variable | Expected Value | Description |
|----------|---------------|-------------|
| `CONVEX_CLOUD_ORIGIN` | `https://convex-qa.yourdomain.com` | Public URL for backend API |
| `CONVEX_SITE_ORIGIN` | `https://convex-qa.yourdomain.com` | Public URL for HTTP actions |
| `SERVICE_FQDN_BACKEND_3210` | Auto-generated | Internal FQDN for port 3210 |
| `SERVICE_FQDN_BACKEND_3211` | Auto-generated | Internal FQDN for port 3211 |

**If these are incorrect or missing**, manually set:
```
CONVEX_CLOUD_ORIGIN=https://convex-qa.yourdomain.com
CONVEX_SITE_ORIGIN=https://convex-qa.yourdomain.com
```

### Step 1.3: Start the Service

1. Click **Start** (or **Restart** if already created)
2. Wait for the status to show **Running**
3. Check the **Logs** tab — you should see Convex backend startup messages
4. Verify both ports are listening:
   - Port `3210` — Backend API
   - Port `3211` — HTTP Actions / Site

### Step 1.4: Generate Admin Key

The admin key is required for deploying Convex functions from your local machine.

1. Go to your Convex service → **Terminal**
2. Connect to the **backend** terminal (not dashboard)
3. Execute:
   ```bash
   ./generate_admin_key.sh
   ```
4. Copy the generated key (starts with `prod:` or similar)

> **SECURITY**: Store this key in your password manager. It grants full admin access to the Convex deployment.

### Step 1.5: Configure Local Convex CLI for QA

On your local machine, create a `.env.qa` file in the project root:

```bash
# .env.qa
CONVEX_DEPLOYMENT=https://convex-qa.yourdomain.com
CONVEX_ADMIN_KEY=<your-admin-key-from-step-1-4>
```

**Test connectivity**:
```bash
npx convex status --env-file .env.qa
```

You should see deployment status information.

---

## Phase 2: Deploy Next.js Frontend

### Step 2.1: Prepare the Repository

Before deploying, ensure your repository meets Coolify's requirements:

#### 2.1.1 Next.js Standalone Output (REQUIRED)

Verify `next.config.ts` includes:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker deployments
  // ... other config
};

export default nextConfig;
```

> **Why**: The `standalone` output generates a minimal server bundle (`server.js`) that can run without `node_modules`, making Docker images smaller and startup faster.

#### 2.1.2 Ensure `pnpm-lock.yaml` is Committed

Coolify uses the lock file for reproducible installs:

```bash
git add pnpm-lock.yaml
git commit -m "chore: ensure lockfile committed for Coolify"
git push
```

#### 2.1.3 No `.env.local` in Git

Verify `.gitignore` excludes `.env.local` and `.env.qa`:
```
.env.local
.env.*.local
.env.qa
```

### Step 2.2: Add Application in Coolify

1. In Coolify, navigate to your Project → **Add New Resource** → **Application**
2. Select **Git Repository**
3. Enter your repository URL (e.g., `https://github.com/your-org/salig-affiliate`)
4. Select the branch for QA (e.g., `develop`, `qa`, or `main`)
5. Click **Continue**

### Step 2.3: Configure Build Settings

In the application configuration:

| Setting | Value | Notes |
|---------|-------|-------|
| **Build Pack** | `Nixpacks` (recommended) or `Dockerfile` | Nixpacks auto-detects Node.js/pnpm |
| **Port** | `3000` | Next.js default |
| **Install Command** | `pnpm install --frozen-lockfile` | Ensures reproducible installs |
| **Build Command** | `pnpm build` | Uses Next.js standalone output |
| **Start Command** | `pnpm start` | Runs `next start` which serves the standalone build |

**If using Dockerfile instead of Nixpacks**, Coolify auto-detects a `Dockerfile` in the repo root. You can add one:

```dockerfile
# Dockerfile (optional — Nixpacks works fine without this)
FROM node:20-slim AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM deps AS builder
COPY . .
RUN pnpm build

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### Step 2.4: Save & Initial Deploy

1. Click **Save** to store configuration
2. Click **Deploy** to trigger the first build
3. Monitor the **Deployment Logs**:
   - Look for `pnpm install` completing successfully
   - Verify `next build` completes with exit code 0
   - Confirm the container starts on port 3000
4. If successful, the status changes to **Running**

---

## Phase 3: Environment Variables

This is the most critical phase. Missing or incorrect variables cause 90% of deployment issues.

### Step 3.1: Convex Service Environment Variables

Navigate to your **Convex service** → **Environment Variables** and set:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `CONVEX_CLOUD_ORIGIN` | `https://convex-qa.yourdomain.com` | Yes | Must match your public domain |
| `CONVEX_SITE_ORIGIN` | `https://convex-qa.yourdomain.com` | Yes | Same as above |
| `BETTER_AUTH_SECRET` | `<32-char-random-string>` | Yes | Generate: `openssl rand -base64 32` |
| `SITE_URL` | `https://qa.yourdomain.com` | Yes | Public URL of Next.js app |
| `EMAIL_DOMAIN` | `yourdomain.com` | Yes | Used for email "from" addresses |
| `INTEGRATION_MODE` | `mock` | Yes | Use `mock` for QA; `real` for prod |
| `EMAIL_PROVIDER` | `postmark` | No | `postmark` or `resend` |
| `POSTMARK_SERVER_TOKEN` | `<token>` | No | Only if using Postmark |
| `RECAPTCHA_SECRET_KEY` | `<secret>` | No | For reCAPTCHA v3 (optional in QA) |
| `STRIPE_CLIENT_ID` | `<ca_...>` | No | Only if testing Stripe Connect |
| `STRIPE_SECRET_KEY` | `<sk_...>` | No | Only if testing Stripe Connect |
| `STRIPE_WEBHOOK_SECRET` | `<whsec_...>` | No | Only if testing Stripe Connect |
| `GOOGLE_CLIENT_ID` | `<id>` | No | For OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | `<secret>` | No | For OAuth (optional) |
| `GITHUB_CLIENT_ID` | `<id>` | No | For OAuth (optional) |
| `GITHUB_CLIENT_SECRET` | `<secret>` | No | For OAuth (optional) |
| `TWO_FACTOR_ENABLED` | `false` | No | Set `true` to mandate 2FA |
| `NEXT_PUBLIC_TWO_FACTOR_ENABLED` | `false` | No | Must match above |

> **Note**: `NEXT_PUBLIC_*` variables in the Convex service are **not** consumed by Next.js. They must be duplicated in the Next.js app environment. Convex uses its own env vars for server-side logic.

### Step 3.2: Next.js App Environment Variables

Navigate to your **Next.js application** → **Environment Variables** and set:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_ENV` | `production` | Yes | Forces Next.js production mode |
| `NEXT_PUBLIC_CONVEX_URL` | `https://convex-qa.yourdomain.com` | Yes | Public Convex backend URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://convex-qa.yourdomain.com` | Yes | Public Convex site/actions URL |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://qa.yourdomain.com` | Yes | Must match your public domain |
| `BETTER_AUTH_SECRET` | `<same-as-convex-service>` | Yes | **Must match** Convex service value exactly |
| `SITE_URL` | `https://qa.yourdomain.com` | Yes | Public URL |
| `EMAIL_DOMAIN` | `yourdomain.com` | Yes | Same as Convex service |
| `INTEGRATION_MODE` | `mock` | Yes | Same as Convex service |
| `EMAIL_PROVIDER` | `postmark` | No | Same as Convex service |
| `POSTMARK_SERVER_TOKEN` | `<token>` | No | Same as Convex service |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | `<site-key>` | No | For reCAPTCHA v3 |
| `RECAPTCHA_SECRET_KEY` | `<secret>` | No | For reCAPTCHA v3 |
| `GOOGLE_CLIENT_ID` | `<id>` | No | For OAuth |
| `GOOGLE_CLIENT_SECRET` | `<secret>` | No | For OAuth |
| `GITHUB_CLIENT_ID` | `<id>` | No | For OAuth |
| `GITHUB_CLIENT_SECRET` | `<secret>` | No | For OAuth |
| `NEXT_PUBLIC_TWO_FACTOR_ENABLED` | `false` | No | Must match Convex service |
| `TWO_FACTOR_ENABLED` | `false` | No | Must match Convex service |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `<pk_...>` | No | If testing Stripe frontend |

### Step 3.3: Critical Configuration Notes

#### BETTER_AUTH_SECRET Must Match
The `BETTER_AUTH_SECRET` must be **identical** in both:
- Convex service environment variables
- Next.js app environment variables

If they differ, authentication will fail with "Invalid session" errors.

#### NEXT_PUBLIC_CONVEX_URL
This is used by the Convex React client in the browser. It **must** be the **public HTTPS URL** of your Convex service, not an internal Docker address.

#### CONVEX_DEPLOYMENT (for CLI)
This is **not** set in Coolify — it's only used locally in your `.env.qa` file for CLI deployments.

---

## Phase 4: Domain & SSL

### Step 4.1: Configure Convex Domain

1. Go to your **Convex service** → **Domains**
2. Add domain: `convex-qa.yourdomain.com`
3. Enable **Let's Encrypt SSL** (toggle on)
4. Save and wait for certificate provisioning (1–3 minutes)

### Step 4.2: Configure Next.js Domain

1. Go to your **Next.js application** → **Domains**
2. Add domain: `qa.yourdomain.com`
3. Enable **Let's Encrypt SSL** (toggle on)
4. Save and wait for certificate provisioning

### Step 4.3: Verify DNS

From your local machine:
```bash
# Should resolve to your Coolify server IP
dig +short qa.yourdomain.com
dig +short convex-qa.yourdomain.com
```

### Step 4.4: Verify SSL

```bash
curl -I https://qa.yourdomain.com
curl -I https://convex-qa.yourdomain.com
```

Both should return `HTTP/2 200` or redirects without SSL errors.

---

## Phase 5: Initial Seeding (QA Platform Admins Only)

> **Important**: For QA and production environments, we **do NOT** run the full local development seed (`seedAllTestData`). That function creates hundreds of fake tenants, affiliates, campaigns, and clicks — useful for local dev, but inappropriate for QA.
>
> Instead, we seed only the **platform admin access** so you can log in and configure the environment manually.

### Step 5.1: Deploy Convex Functions

From your local machine (with `.env.qa` configured):

```bash
# Deploy all Convex functions to QA
npx convex deploy --env-file .env.qa --yes --typecheck disable
```

> **Why `--typecheck disable`**: The repo contains pre-existing TypeScript errors in test files that would block deployment if type checking is enforced.

### Step 5.2: Seed QA Platform Admins

Run the dedicated QA admin seeder:

```bash
npx convex run qaSeed:seedQaPlatformAdmins --env-file .env.qa --typecheck=disable --push
```

This creates:
1. **Better Auth user + credential account** (for sign-in)
2. **App-level user record** with `role: "admin"` (for platform admin access)

**Seeded accounts**:

| Email | Name | Role | Password |
|-------|------|------|----------|
| `ron.kristoff.e.reyes@live.com.ph` | Ron Kristoff Reyes | Platform Admin | `TestPass123!` |
| `support@microsource.com.ph` | Microsource Support | Platform Admin | `TestPass123!` |

The seeder uses a **dual strategy**:
- **Primary**: Calls the HTTP signup endpoint (`/api/auth/sign-up/email`) if `SITE_URL` is set and the Next.js app is running. This triggers the `databaseHooks.user.create.after` hook which creates the app user automatically.
- **Fallback**: Uses the Better Auth adapter to directly create the auth user + credential account, then creates the app user via mutation.

### Step 5.3: Verify Admin Access

1. Visit `https://qa.yourdomain.com/sign-in`
2. Log in with one of the seeded admin emails and password `TestPass123!`
3. You should be redirected to the platform admin dashboard
4. Verify the user appears in the admin user list

### Step 5.4: (Optional) Create Additional Admins

If you need to add more platform admins after initial seeding:

```bash
npx convex run seedAuthHelpers:createPlatformAdmin --env-file .env.qa --typecheck=disable --push -- '{"email":"new.admin@company.com","name":"New Admin"}'
```

Then ensure they have a credential account:
```bash
npx convex run seedAuthHelpers:ensureAuthAccounts --env-file .env.qa --typecheck=disable --push -- '{"users":[{"email":"new.admin@company.com","name":"New Admin","passwordHash":"b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000"}]}'
```

---

## Phase 6: Verification

### Step 6.1: Health Checks

| Check | Command/URL | Expected Result |
|-------|-------------|-----------------|
| Next.js app | `https://qa.yourdomain.com` | Landing page loads |
| Convex backend | `https://convex-qa.yourdomain.com/version` | Returns JSON with version |
| Convex dashboard | `https://convex-qa.yourdomain.com/` | Dashboard UI loads (if enabled) |

### Step 6.2: Authentication Flow

1. Visit `https://qa.yourdomain.com/sign-in`
2. Log in with a seeded platform admin account:
   - Email: `ron.kristoff.e.reyes@live.com.ph`
   - Password: `TestPass123!`
3. Verify sign-in succeeds without errors
4. Verify session persists across page refreshes
5. (Optional) Create a new SaaS owner account via sign-up to test the full registration flow

### Step 6.3: Admin Access Verification

1. Sign in with `ron.kristoff.e.reyes@live.com.ph` / `TestPass123!`
2. Verify you see the **Platform Admin Dashboard**
3. Check that tenant list, subscription stats, and admin tools load correctly
4. Sign out and test the second admin account (`support@microsource.com.ph`)
5. Check Convex logs (service → Terminal) for successful authentication queries

### Step 6.4: WebSocket Verification

1. Open browser DevTools → Network → WS (WebSocket)
2. Verify a WebSocket connection to `wss://convex-qa.yourdomain.com` is established
3. Dashboard data should update in real-time when mutations occur

---

## DevOps Runbook

### Redeploy After Code Changes

#### Option A: Automatic (Git Push)
1. Push code to the configured branch
2. Coolify auto-detects the push and rebuilds
3. Monitor deployment logs for success

#### Option B: Manual Redeploy
1. Coolify → Next.js application → **Redeploy**
2. Monitor logs for build success

#### Option C: Convex Function Update Only
```bash
npx convex deploy --env-file .env.qa --yes --typecheck disable
```

### Environment Variable Changes

1. Update variable in Coolify UI (service or app)
2. Click **Restart** (not just Save)
3. Verify the new value is active

> **Note**: `NEXT_PUBLIC_*` variables require a **rebuild** (not just restart) because they're baked into the client bundle at build time.

### Scaling

| Service | Scaling Action | Coolify Path |
|---------|---------------|--------------|
| Next.js | Increase replicas | Application → Resources → Replicas |
| Next.js | Vertical scaling | Application → Resources → CPU/RAM |
| Convex | Vertical scaling | Service → Resources → CPU/RAM |

> **Convex Horizontal Scaling**: Self-hosted Convex currently runs as a single container. For high availability, consider running multiple Coolify instances with a shared database backend (advanced setup beyond this guide).

### Backup Strategy

#### Convex Database

The Convex self-hosted container stores data in a SQLite database inside the container. **This is NOT persisted by default across container restarts unless volumes are configured.**

1. **Verify volume mount** in Coolify Convex service:
   - Service → Storage → Ensure a persistent volume is mounted to the data directory
   - Default path: `/convex/data` (verify in service logs)

2. **Manual backup** (run periodically):
   ```bash
   # From Coolify Convex service terminal
   cp /convex/data/db.sqlite /convex/data/backups/db-$(date +%Y%m%d).sqlite
   ```

3. **Automated backup** (optional):
   Set up a Coolify scheduled task or cron job to copy the SQLite file to S3/rsync.

#### Next.js App

Next.js is stateless — no data to backup. Just ensure your Git repo is safe.

### Log Access

| Service | Path | Retention |
|---------|------|-----------|
| Next.js | Application → Logs | Configurable in Coolify |
| Convex Backend | Service → Logs | Configurable in Coolify |
| Convex Terminal | Service → Terminal | Real-time only |

### Monitoring & Alerts

1. **Coolify Health Checks**:
   - Application → Healthcheck → Enable HTTP check on `/`
   - Service → Healthcheck → Enable if available

2. **Resource Monitoring**:
   - Coolify Dashboard shows CPU/RAM/disk usage per resource
   - Set alerts for >80% RAM or disk usage

3. **Uptime Monitoring** (external):
   - Use UptimeRobot or Pingdom to monitor `https://qa.yourdomain.com`
   - Alert on downtime or SSL expiry

---

## Troubleshooting

### Issue: "404 Not Found" on Convex Dashboard or API

**Cause**: Incorrect `CONVEX_CLOUD_ORIGIN` or `CONVEX_SITE_ORIGIN`

**Fix**:
1. Check Coolify Convex service → Environment Variables
2. Ensure both variables point to the **backend FQDN** (`SERVICE_FQDN_BACKEND_3210`), NOT the dashboard FQDN
3. Restart the Convex service

### Issue: "Connection Refused" from Next.js to Convex

**Cause**: Next.js cannot reach Convex

**Diagnosis**:
```bash
# From Next.js container terminal in Coolify
curl https://convex-qa.yourdomain.com/version
```

**Fix**:
1. Verify `NEXT_PUBLIC_CONVEX_URL` uses the **public HTTPS URL**, not `localhost` or internal Docker IP
2. Check that Convex service is Running
3. Verify DNS resolution works from the Next.js container

### Issue: Authentication Fails ("Invalid Credentials" / "Session Expired")

**Cause**: `BETTER_AUTH_SECRET` mismatch

**Fix**:
1. Get the exact secret from Convex service env vars
2. Paste it identically into Next.js app env vars
3. Restart BOTH services
4. Clear browser cookies and retry

### Issue: "Better Auth: syncUserCreation failed"

**Cause**: Auth hook failing during user creation

**Fix**: This is usually non-fatal (caught by try/catch). If persistent:
1. Check that `SITE_URL` is set correctly in Convex env vars
2. Verify the `users` table schema matches the expected fields

### Issue: Build Fails with "Module not found"

**Cause**: Missing lockfile or incorrect install

**Fix**:
1. Ensure `pnpm-lock.yaml` is committed and pushed
2. In Coolify, set Install Command to: `pnpm install --frozen-lockfile`
3. Clear build cache: Application → Advanced → Clear Cache → Redeploy

### Issue: "502 Bad Gateway" After Deployment

**Cause**: Next.js not listening on the expected port

**Fix**:
1. Verify Application → Port is set to `3000`
2. Check Next.js container logs for startup errors
3. Ensure `next.config.ts` has `output: "standalone"`
4. Verify the start command is `pnpm start` (runs `next start`)

### Issue: Real-Time Updates Not Working

**Cause**: WebSocket connection blocked

**Fix**:
1. Verify `wss://convex-qa.yourdomain.com` is accessible
2. Check browser console for WebSocket errors
3. Ensure Traefik is configured to proxy WebSocket connections (Coolify does this by default)
4. Verify `NEXT_PUBLIC_CONVEX_URL` uses `wss://` or `https://` (the SDK auto-upgrades)

### Issue: Seed Data Missing / Aggregates Empty

**Cause**: Forgot backfill step

**Fix**:
```bash
npx convex run aggregates:backfillAll --env-file .env.qa --typecheck=disable -- '{}'
```

### Issue: Convex Deploy Timeout

**Cause**: Large deployment or slow network

**Fix**:
1. Retry the deploy command
2. Check Convex service resources (CPU/RAM may be throttled)
3. Increase service resources temporarily during deploy

---

## Quick Reference Card

### Essential Commands

```bash
# Deploy convex functions to QA
npx convex deploy --env-file .env.qa --yes --typecheck disable

# Deploy once and exit (for CI/CD)
npx convex dev --env-file .env.qa --once --typecheck disable

# Seed QA platform admins (ONLY seeding needed for QA)
npx convex run qaSeed:seedQaPlatformAdmins --env-file .env.qa --typecheck=disable --push

# Create an additional platform admin
npx convex run seedAuthHelpers:createPlatformAdmin --env-file .env.qa --typecheck=disable --push -- '{"email":"name@company.com","name":"Full Name"}'

# Check convex status
npx convex status --env-file .env.qa

# View convex logs (from service terminal in Coolify)
tail -f /var/log/convex/*.log
```

### Environment Variable Sync Checklist

When adding a new env var, update **both**:
- [ ] Convex service (Coolify UI)
- [ ] Next.js application (Coolify UI)
- [ ] `.env.qa` (local file, for CLI access)
- [ ] `.env.example` (repo documentation)

### Port Reference

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Next.js | 3000 | HTTP | Frontend application |
| Convex Backend | 3210 | HTTP / WebSocket | Queries, mutations, subscriptions |
| Convex Site | 3211 | HTTP | HTTP actions, webhooks, file uploads |

---

## Appendix A: Coolify Version Compatibility

| Coolify Version | Status | Notes |
|-----------------|--------|-------|
| v4.0.0-beta.419+ | ✅ Recommended | Fixes Convex env var bug |
| v4.0.0-beta.470+ | ✅ Latest | Stable for production use |
| v4.0.0-beta.418 or older | ⚠️ Upgrade | Convex template has env var bug |

---

## Appendix B: Resource Requirements by Load

| Environment | Users | Convex RAM | Convex CPU | Next.js RAM | Next.js CPU |
|-------------|-------|-----------|-----------|-------------|-------------|
| QA / Dev | < 50 | 1GB | 1 vCPU | 512MB | 1 vCPU |
| QA / Load Test | 50–200 | 2GB | 2 vCPU | 1GB | 1 vCPU |
| Staging | 200–1000 | 4GB | 2 vCPU | 2GB | 2 vCPU |
| Production | 1000+ | 8GB+ | 4 vCPU+ | 4GB+ | 2 vCPU+ |

---

*Document Version: 1.0 | For salig-affiliate QA deployment on Coolify v4*
