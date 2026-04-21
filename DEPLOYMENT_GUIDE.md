# salig-affiliate Deployment Guide: Next.js + Convex on Coolify

This guide walks you through deploying the salig-affiliate application (Next.js frontend + Convex backend) to Coolify, with Convex self-hosted as a Coolify service.

## Overview

- **Frontend**: Next.js 16 (App Router) deployed as a Coolify Application
- **Backend**: Convex (self-hosted) deployed as a Coolify Service
- **Database**: Convex's built-in database (managed by the Convex service)
- **Authentication**: Better Auth via Convex component

## Prerequisites

1. A Coolify server (self-hosted or Coolify Cloud)
2. Access to the Coolify dashboard
3. The salig-affiliate codebase (this repository) accessible via Git
4. `pnpm` installed on your local machine (for initial setup/seeding if needed)
5. Basic familiarity with Coolify concepts (Applications, Services, Environment Variables)

---

## Step 1: Deploy Convex Service

1. In your Coolify dashboard, navigate to **Resources** → **Add New Resource** → **Service**
2. Search for and select **Convex** from the service list
3. Configure the service:
   - Give it a name (e.g., `salig-affiliate-convex`)
   - Choose appropriate resources (CPU, RAM) based on expected load
   - Leave environment variables at defaults unless you have specific needs
4. Click **Create** and wait for the service to provision and start

> **Note**: Coolify will pull the official Convex Docker image and run it as a container.

## Step 2: Generate Convex Admin Key

After the Convex service is running:

1. Go to your Convex service resource → **Terminal**
2. In the terminal, execute:
   ```bash
   ./generate_admin_key.sh
   ```
3. Copy the generated admin key (you'll need it for the Next.js app configuration)

> **Important**: Store this key securely. It provides administrative access to your Convex deployment.

## Step 3: (Optional) Configure Convex Environment Variables

Typically, the Convex service runs with sensible defaults. However, you may want to set:

- `CONVEX_INITIALIZE`: Set to `true` to run initialization scripts on startup (if needed)
- Other Convex-specific environment variables as per [Convex documentation](https://docs.convex.dev)

To set these:
1. Go to your Convex service → **Environment Variables**
2. Add any required variables
3. Restart the service for changes to take effect

## Step 4: Deploy Next.js Frontend

### 4.1 Add the Application

1. In Coolify dashboard, go to **Applications** → **Add Application**
2. Choose **Git Repository** (assuming your code is in a Git repo)
3. Enter your repository URL (e.g., `https://github.com/yourusername/salig-affiliate-local`)
4. Select the appropriate branch (usually `main` or `master`)
5. Click **Continue**

### 4.2 Configure Build Settings

1. **Build Pack**: Select **Nixpacks** (recommended for Node.js apps) or **Dockerfile** if you have a custom one
2. **Build Command**: 
   ```
   pnpm install && pnpm build
   ```
   (Leave empty if using Nixpacks and it detects the build script automatically)
3. **Start Command**:
   ```
   pnpm start
   ```
4. **Port**: `3000` (Next.js default port)
5. Click **Continue**

### 4.3 Configure Environment Variables (Critical)

Click **Environment Variables** and add the following:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Sets Next.js to production mode |
| `CONVEX_DEPLOY_KEY` | `<<your-admin-key-from-step-2>>` | The admin key generated in Step 2 |
| `NEXT_PUBLIC_CONVEX_URL` | `http://<<convex-service-internal-host>>:<<port>>` | **MUST USE INTERNAL DOCKER NETWORK ADDRESS** |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://your-deployed-domain.com` | Your actual public domain (e.g., `https://affiliate.yourdomain.com`) |
| `BETTER_AUTH_SECRET` | `<<a-secure-random-string-32-chars-min>>` | Generate with: `openssl rand -base64 32` |
| `INTEGRATION_MODE` | `real` | Set to `real` for production, `mock` for testing/development |

#### Important Notes on `NEXT_PUBLIC_CONVEX_URL`:

- This **must** be the internal Docker network address that Coolify assigns to your Convex service.
- To find it:
  1. Go to your Convex service → **Resources** tab
  2. Look for **Network** or **Internal IP/Port** information
  3. Format: `http://[service-internal-host]:[port]` (e.g., `http://convex:3210` or `http://10.0.5.2:3210`)
- **Do NOT** use `localhost`, `127.0.0.1`, or the public URL here – the Next.js container needs to reach Convex via the internal Docker network.
- If you're unsure, you can inspect the environment variables inside the Convex container (via its terminal) to see what port it's listening on internally.

### 4.4 Configure Domain & SSL (Optional but Recommended)

1. Go to your Next.js application → **Domains**
2. Add your custom domain (e.g., `affiliate.yourdomain.com`)
3. Enable **Let's Encrypt SSL** (toggle switch)
4. Wait for certificate provisioning (automatic, may take a few minutes)

> **Important**: Ensure `NEXT_PUBLIC_BETTER_AUTH_URL` matches exactly the domain you configure here (including `https://` and no trailing slash).

### 4.5 Deploy

1. Click **Save & Deploy**
2. Coolify will:
   - Clone your repository
   - Install dependencies using `pnpm`
   - Build the Next.js application (`pnpm build`)
   - Start the production server (`pnpm start`)
3. Monitor the **Logs** tab for deployment progress and any errors

## Step 5: Initial Data Seeding (One-Time Setup)

After your Next.js app is successfully deployed and running, you need to seed initial data into Convex:

1. Go to your **Convex service** → **Terminal**
2. Run these commands **in sequence**:

   ```bash
   # 1. Seed authentication users (creates credential accounts in Better Auth tables)
   pnpm convex run seedAuthUsers:seedAuthUsers --typecheck=disable --push
   
   # 2. Seed all test data (tenants, users, affiliates, campaigns, clicks, conversions, etc.)
   pnpm convex run testData:seedAllTestData --typecheck=disable -- '{}'
   
   # 3. Backfill aggregate indexes (CRITICAL: seeding bypasses triggers, so aggregates are empty)
   pnpm convex run aggregates:backfillAll --typecheck=disable --push -- '{}'
   ```

> **Note**: The `--typecheck=disable` flag is required because the repository contains some test files with TypeScript errors that would block function push/deployment otherwise.

## Step 6: Verification & Testing

1. Visit your deployed domain (e.g., `https://affiliate.yourdomain.com`)
2. You should see the salig-affiliate landing page
3. Test the authentication flow:
   - Click **Sign Up** and create a new account
   - Verify you receive a confirmation email (if email provider configured) or can sign in directly
   - After signing in, you should see the dashboard
4. Verify data persistence:
   - Create a test affiliate, campaign, or click
   - Check that data appears in the dashboard and persists after page refresh
5. (Optional) Check Convex logs via the Convex service terminal to see mutations/queries

## Troubleshooting

### Connection Issues (Next.js ↔ Convex)
- **Symptom**: Authentication fails, dashboard shows errors, or API calls fail
- **Checks**:
  1. Verify `NEXT_PUBLIC_CONVEX_URL` uses the correct internal Docker network address (not localhost/public URL)
  2. Ensure both services are running on the same Coolify server/network
  3. Check Convex service logs for connection attempts
  4. Confirm the Convex service is healthy and listening on its internal port

### Authentication Failures
- **Symptom**: Sign-in/sign-up fails with "Invalid credentials" or "Account not found"
- **Checks**:
  1. Confirm `BETTER_AUTH_SECRET` matches **exactly** between:
     - Next.js app environment variable
     - Convex service environment variable (if set there; otherwise it's read from its own config)
  2. Ensure `NEXT_PUBLIC_BETTER_AUTH_URL` matches your actual domain (including protocol and no trailing slash)
  3. Check browser console for auth-related errors
  4. Verify you've seeded auth users (Step 5.1)

### Build/Deployment Failures
- **Symptom**: Next.js application fails to deploy or start
- **Checks**:
  1. Review deployment logs in Coolify for Node.js/pnpm errors
  2. Ensure `pnpm lock` file is committed to your repository
  3. Try clearing Coolify's build cache and redeploying
  4. Verify the repository is accessible and the correct branch is selected

### 502 Bad Gateway
- **Symptom**: Site shows 502 error after deployment
- **Checks**:
  1. Verify Next.js is listening on port 3000 (check start command in application settings)
  2. Ensure health checks pass (Coolify may need health check configured under application settings)
  3. Check Next.js application logs for startup errors

## Maintenance & Updates

### Updating the Application
1. Push new code to your Git repository
2. In Coolify, go to your Next.js application → click **Redeploy** (or enable auto-deploy on push)
3. Coolify will rebuild and restart the application

### Scaling
- **Next.js**: Increase replica count in application settings for horizontal scaling
- **Convex**: Adjust resources (CPU/RAM) in the Convex service settings for vertical scaling
- Consider enabling load balancing for Next.js replicas if running multiple instances

### Monitoring & Logs
- **Next.js**: View logs under the application's **Logs** tab in Coolify
- **Convex**: View logs under the Convex service's **Terminal** tab (or check Docker logs if needed)
- Set up health checks and monitoring as per your Coolify setup

### Security Best Practices
- Regularly rotate `CONVEX_DEPLOY_KEY` and `BETTER_AUTH_SECRET` if needed
- Keep Coolify host and container images updated
- Use HTTPS in production (via Let's Encrypt as configured above)
- Review Convex and Better Auth documentation for additional security considerations

## Architecture Summary

```
[User's Browser] 
        ↓ HTTPS
[Coolify Load Balancer / Reverse Proxy] 
        ↓ HTTP (internal)
[Next.js Application (Coolify App)] 
        ↓ HTTP (internal Docker network)
[Convex Service (Coolify Service)] 
        ↓ 
[Convex Built-in Database]
```

- All communication between Next.js and Convex happens over Coolify's internal Docker network (fast and secure)
- The public only accesses the Next.js application via HTTPS
- Convex is not exposed directly to the public internet

## Further Reading

- [Convex Documentation](https://docs.convex.dev)
- [Better Auth Documentation](https://better-auth.com)
- [Coolify Documentation](https://coolify.io/docs/)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deploy)

--- 

*This guide assumes a standard Coolify installation. Adjust resource allocations, domain configuration, and scaling based on your specific requirements and traffic expectations.*