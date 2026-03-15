/**
 * Load testing script for click tracking endpoint
 * Story 6.6: Click Tracking Performance
 * 
 * This script simulates 100 concurrent requests to the /track/click endpoint
 * and measures response times to verify performance requirements (NFR3)
 */

import { v } from "convex/values";
import { action } from "../convex/_generated/server";

interface TestResult {
  url: string;
  responseTime: number;
  status: number;
  success: boolean;
  error?: string;
}

interface LoadTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsWithin3Seconds: number;
  requestsExceeding3Seconds: number;
}

/**
 * Simulate a single click tracking request
 */
async function simulateClickRequest(
  baseUrl: string,
  code: string,
  tenantId: string,
  requestId: number
): Promise<TestResult> {
  const url = `${baseUrl}/track/click?code=${code}&t=${tenantId}&_=${requestId}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual", // Don't follow redirects automatically
    });

    const responseTime = Date.now() - startTime;

    return {
      url,
      responseTime,
      status: response.status,
      success: response.status === 302, // Click tracking should return 302 redirect
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      url,
      responseTime,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run load test with concurrent requests
 */
async function runLoadTest(
  baseUrl: string,
  code: string,
  tenantId: string,
  concurrency: number = 100
): Promise<LoadTestResults> {
  console.log(`🚀 Starting load test with ${concurrency} concurrent requests`);
  console.log(`   Target: ${baseUrl}/track/click?code=${code}&t=${tenantId}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log("");

  const startTime = Date.now();

  // Create promises for all concurrent requests
  const promises = Array.from({ length: concurrency }, (_, i) =>
    simulateClickRequest(baseUrl, code, tenantId, i)
  );

  // Wait for all requests to complete
  const results = await Promise.all(promises);

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Calculate statistics
  const responseTimes = results.map((r) => r.responseTime).sort((a, b) => a - b);
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = results.filter((r) => !r.success).length;

  const calculatePercentile = (percentile: number): number => {
    const index = Math.floor((percentile / 100) * responseTimes.length);
    return responseTimes[Math.min(index, responseTimes.length - 1)];
  };

  const resultsWithin3Seconds = results.filter((r) => r.responseTime <= 3000).length;
  const resultsExceeding3Seconds = results.filter((r) => r.responseTime > 3000).length;

  const loadTestResults: LoadTestResults = {
    totalRequests: concurrency,
    successfulRequests,
    failedRequests,
    averageResponseTime:
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
    p50ResponseTime: calculatePercentile(50),
    p95ResponseTime: calculatePercentile(95),
    p99ResponseTime: calculatePercentile(99),
    minResponseTime: responseTimes[0],
    maxResponseTime: responseTimes[responseTimes.length - 1],
    requestsWithin3Seconds: resultsWithin3Seconds,
    requestsExceeding3Seconds: resultsExceeding3Seconds,
  };

  // Print results
  console.log("📊 Load Test Results");
  console.log("====================");
  console.log(`Total Requests: ${loadTestResults.totalRequests}`);
  console.log(`Successful: ${loadTestResults.successfulRequests} (${((loadTestResults.successfulRequests / loadTestResults.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${loadTestResults.failedRequests}`);
  console.log("");
  console.log("Response Time Statistics:");
  console.log(`  Average: ${loadTestResults.averageResponseTime.toFixed(0)}ms`);
  console.log(`  P50: ${loadTestResults.p50ResponseTime.toFixed(0)}ms`);
  console.log(`  P95: ${loadTestResults.p95ResponseTime.toFixed(0)}ms`);
  console.log(`  P99: ${loadTestResults.p99ResponseTime.toFixed(0)}ms`);
  console.log(`  Min: ${loadTestResults.minResponseTime.toFixed(0)}ms`);
  console.log(`  Max: ${loadTestResults.maxResponseTime.toFixed(0)}ms`);
  console.log("");
  console.log("Performance Requirements (NFR3):");
  console.log(`  Requests within 3 seconds: ${loadTestResults.requestsWithin3Seconds} (${((loadTestResults.requestsWithin3Seconds / loadTestResults.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Requests exceeding 3 seconds: ${loadTestResults.requestsExceeding3Seconds}`);
  console.log("");
  console.log(`Total test time: ${totalTime}ms`);
  console.log("");

  // Determine if test passed
  const allWithin3Seconds = resultsExceeding3Seconds === 0;
  if (allWithin3Seconds) {
    console.log("✅ PASS: All requests completed within 3 seconds (NFR3 met)");
  } else {
    console.log("❌ FAIL: Some requests exceeded 3 seconds");
  }

  return loadTestResults;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { baseUrl: string; code: string; tenantId: string; concurrency: number } {
  const args = process.argv.slice(2);
  
  const config: { baseUrl?: string; code?: string; tenantId?: string; concurrency?: number } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    
    if (arg === "--baseUrl" && value) {
      config.baseUrl = value;
      i++;
    } else if (arg === "--code" && value) {
      config.code = value;
      i++;
    } else if (arg === "--tenantId" && value) {
      config.tenantId = value;
      i++;
    } else if (arg === "--concurrency" && value) {
      config.concurrency = parseInt(value, 10);
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }
  
  return {
    baseUrl: config.baseUrl || process.env.CONVEX_URL || "https://your-convex-app.convex.cloud",
    code: config.code || process.env.CLICK_CODE || "TEST-123",
    tenantId: config.tenantId || process.env.TENANT_ID || "test-tenant-id",
    concurrency: config.concurrency || parseInt(process.env.CONCURRENCY || "100", 10),
  };
}

function printUsage() {
  console.log(`
Usage: npx tsx scripts/load-test-click-tracking.ts [options]

Options:
  --baseUrl <url>      Convex app base URL (default: CONVEX_URL env or "https://your-convex-app.convex.cloud")
  --code <code>        Affiliate referral code (default: TEST-123 or CLICK_CODE env)
  --tenantId <id>      Tenant ID (default: test-tenant-id or TENANT_ID env)
  --concurrency <num>  Number of concurrent requests (default: 100 or CONCURRENCY env)
  --help, -h           Show this help message

Environment Variables (alternative to CLI args):
  CONVEX_URL           Convex app base URL
  CLICK_CODE           Affiliate referral code
  TENANT_ID            Tenant ID
  CONCURRENCY          Number of concurrent requests

Examples:
  npx tsx scripts/load-test-click-tracking.ts --code MY-AFF-123 --tenantId tenant-abc
  npx tsx scripts/load-test-click-tracking.ts --concurrency 50 --baseUrl https://my-app.convex.cloud
  CONVEX_URL=https://my-app.convex.cloud TENANT_ID=tenant-abc CLICK_CODE=REF-001 npx tsx scripts/load-test-click-tracking.ts
  `);
}

/**
 * Main entry point - can be run via npx tsx scripts/load-test-click-tracking.ts
 */
async function main() {
  const config = parseArgs();

  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║         Click Tracking Performance Load Test                   ║");
  console.log("║         Story 6.6: Click Tracking Performance                  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Configuration:");
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Affiliate Code: ${config.code}`);
  console.log(`  Tenant ID: ${config.tenantId}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log("");

  try {
    const results = await runLoadTest(config.baseUrl, config.code, config.tenantId, config.concurrency);

    // Export results for further processing if needed
    if (typeof module !== "undefined" && module.exports) {
      module.exports = { runLoadTest, results };
    }
  } catch (error) {
    console.error("Load test failed:", error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

// Export for use in tests
export { runLoadTest, simulateClickRequest };
