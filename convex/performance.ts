import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Internal mutation to record a performance metric
 * Story 6.6: Click Tracking Performance
 */
export const recordPerformanceMetric = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    metricType: v.string(),
    value: v.number(),
    metadata: v.optional(v.object({
      endpoint: v.optional(v.string()),
      statusCode: v.optional(v.number()),
      errorType: v.optional(v.string()),
      responseTime: v.optional(v.number()),
    })),
  },
  returns: v.id("performanceMetrics"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("performanceMetrics", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/**
 * Query to get performance statistics for a given metric type
 * Calculates p50, p95, p99 percentiles, average, min, max
 */
export const getPerformanceStats = query({
  args: {
    metricType: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    avg: v.number(),
    p50: v.number(),
    p95: v.number(),
    p99: v.number(),
    min: v.number(),
    max: v.number(),
  }),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("performanceMetrics")
      .withIndex("by_type_and_time", (q) =>
        q.eq("metricType", args.metricType)
      );

    // Apply date filters if provided
    if (args.startDate !== undefined && args.endDate !== undefined) {
      const startDate = args.startDate;
      const endDate = args.endDate;
      query = query.filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startDate),
          q.lte(q.field("timestamp"), endDate)
        )
      );
    } else if (args.startDate !== undefined) {
      const startDate = args.startDate;
      query = query.filter((q) => q.gte(q.field("timestamp"), startDate));
    } else if (args.endDate !== undefined) {
      const endDate = args.endDate;
      query = query.filter((q) => q.lte(q.field("timestamp"), endDate));
    }

    const metrics = await query.collect();

    if (metrics.length === 0) {
      return {
        count: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
      };
    }

    // Sort values to calculate percentiles
    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const count = values.length;

    // Calculate percentiles
    const getPercentile = (p: number) => {
      const index = Math.floor((p / 100) * count);
      return values[Math.min(index, count - 1)];
    };

    return {
      count,
      avg: values.reduce((a, b) => a + b, 0) / count,
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
      min: values[0],
      max: values[count - 1],
    };
  },
});

/**
 * Query to get click performance statistics
 * Optimized to use a single database query for all metric types
 */
export const getClickPerformanceStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    responseTime: v.object({
      count: v.number(),
      avg: v.number(),
      p50: v.number(),
      p95: v.number(),
      p99: v.number(),
      min: v.number(),
      max: v.number(),
    }),
    errorCount: v.number(),
    timeoutCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Combined query for all click metrics (response_time, error, timeout)
    // First, get all metrics for the date range
    let baseQuery = ctx.db.query("performanceMetrics");

    // Apply date filters if provided
    if (args.startDate !== undefined && args.endDate !== undefined) {
      const startDate = args.startDate;
      const endDate = args.endDate;
      baseQuery = baseQuery.filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startDate),
          q.lte(q.field("timestamp"), endDate)
        )
      );
    } else if (args.startDate !== undefined) {
      const startDate = args.startDate;
      baseQuery = baseQuery.filter((q) => q.gte(q.field("timestamp"), startDate));
    } else if (args.endDate !== undefined) {
      const endDate = args.endDate;
      baseQuery = baseQuery.filter((q) => q.lte(q.field("timestamp"), endDate));
    }

    // Collect all metrics once
    const allMetrics = await baseQuery.collect();

    // Separate by metric type
    const responseTimeMetrics = allMetrics.filter(m => m.metricType === "click_response_time");
    const errorMetrics = allMetrics.filter(m => m.metricType === "click_error");
    const timeoutMetrics = allMetrics.filter(m => m.metricType === "click_timeout");

    const responseTimeStats = responseTimeMetrics.length > 0
      ? (() => {
          const values = responseTimeMetrics.map((m) => m.value).sort((a, b) => a - b);
          const count = values.length;
          const getPercentile = (p: number) => {
            const index = Math.floor((p / 100) * count);
            return values[Math.min(index, count - 1)];
          };

          return {
            count,
            avg: values.reduce((a, b) => a + b, 0) / count,
            p50: getPercentile(50),
            p95: getPercentile(95),
            p99: getPercentile(99),
            min: values[0],
            max: values[count - 1],
          };
        })()
      : {
          count: 0,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          min: 0,
          max: 0,
        };

    return {
      responseTime: responseTimeStats,
      errorCount: errorMetrics.length,
      timeoutCount: timeoutMetrics.length,
    };
  },
});

/**
 * Query to get conversion performance statistics
 * Optimized to use a single database query for all metric types
 */
export const getConversionPerformanceStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    responseTime: v.object({
      count: v.number(),
      avg: v.number(),
      p50: v.number(),
      p95: v.number(),
      p99: v.number(),
      min: v.number(),
      max: v.number(),
    }),
    errorCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Combined query for all conversion metrics
    let baseQuery = ctx.db.query("performanceMetrics");

    // Apply date filters if provided
    if (args.startDate !== undefined && args.endDate !== undefined) {
      const startDate = args.startDate;
      const endDate = args.endDate;
      baseQuery = baseQuery.filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startDate),
          q.lte(q.field("timestamp"), endDate)
        )
      );
    } else if (args.startDate !== undefined) {
      const startDate = args.startDate;
      baseQuery = baseQuery.filter((q) => q.gte(q.field("timestamp"), startDate));
    } else if (args.endDate !== undefined) {
      const endDate = args.endDate;
      baseQuery = baseQuery.filter((q) => q.lte(q.field("timestamp"), endDate));
    }

    // Collect all metrics once
    const allMetrics = await baseQuery.collect();

    // Separate by metric type
    const responseTimeMetrics = allMetrics.filter(m => m.metricType === "conversion_response_time");
    const errorMetrics = allMetrics.filter(m => m.metricType === "conversion_error");

    const responseTimeStats = responseTimeMetrics.length > 0
      ? (() => {
          const values = responseTimeMetrics.map((m) => m.value).sort((a, b) => a - b);
          const count = values.length;
          const getPercentile = (p: number) => {
            const index = Math.floor((p / 100) * count);
            return values[Math.min(index, count - 1)];
          };

          return {
            count,
            avg: values.reduce((a, b) => a + b, 0) / count,
            p50: getPercentile(50),
            p95: getPercentile(95),
            p99: getPercentile(99),
            min: values[0],
            max: values[count - 1],
          };
        })()
      : {
          count: 0,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          min: 0,
          max: 0,
        };

    return {
      responseTime: responseTimeStats,
      errorCount: errorMetrics.length,
    };
  },
});

/**
 * Query to get system health metrics
 * Optimized to use a single database query for all metrics
 */
export const getSystemHealthMetrics = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    totalRequests: v.number(),
    errorRate: v.number(),
    averageResponseTime: v.number(),
    p95ResponseTime: v.number(),
    p99ResponseTime: v.number(),
  }),
  handler: async (ctx, args) => {
    // Combined query for all click-related metrics
    let baseQuery = ctx.db.query("performanceMetrics");

    // Apply date filters if provided
    if (args.startDate !== undefined && args.endDate !== undefined) {
      const startDate = args.startDate;
      const endDate = args.endDate;
      baseQuery = baseQuery.filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startDate),
          q.lte(q.field("timestamp"), endDate)
        )
      );
    } else if (args.startDate !== undefined) {
      const startDate = args.startDate;
      baseQuery = baseQuery.filter((q) => q.gte(q.field("timestamp"), startDate));
    } else if (args.endDate !== undefined) {
      const endDate = args.endDate;
      baseQuery = baseQuery.filter((q) => q.lte(q.field("timestamp"), endDate));
    }

    // Collect all metrics once
    const allMetrics = await baseQuery.collect();

    // Separate by metric type
    const responseTimeMetrics = allMetrics.filter(m => m.metricType === "click_response_time");
    const errorMetrics = allMetrics.filter(m => m.metricType === "click_error");

    if (responseTimeMetrics.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      };
    }

    const values = responseTimeMetrics.map((m) => m.value).sort((a, b) => a - b);
    const count = values.length;
    const getPercentile = (p: number) => {
      const index = Math.floor((p / 100) * count);
      return values[Math.min(index, count - 1)];
    };

    return {
      totalRequests: count,
      errorRate: errorMetrics.length / count,
      averageResponseTime: values.reduce((a, b) => a + b, 0) / count,
      p95ResponseTime: getPercentile(95),
      p99ResponseTime: getPercentile(99),
    };
  },
});

/**
 * Query to get performance alert configuration
 * Uses compound index by_tenant_and_alert_type for efficient queries
 */
export const getPerformanceAlertConfig = query({
  args: {
    tenantId: v.optional(v.id("tenants")),
    alertType: v.string(),
  },
  returns: v.object({
    enabled: v.boolean(),
    threshold: v.number(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  }),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("performanceAlertConfig")
      .withIndex("by_tenant_and_alert_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("alertType", args.alertType)
      )
      .first();

    if (config) {
      return {
        enabled: config.enabled,
        threshold: config.threshold,
        severity: config.severity,
      };
    }

    // Return default configuration if none exists
    const defaultConfigs: Record<string, { threshold: number; severity: "low" | "medium" | "high" }> = {
      error_rate: { threshold: 0.01, severity: "high" },
      response_time_p99: { threshold: 3000, severity: "medium" },
      timeout_rate: { threshold: 0.001, severity: "medium" },
    };

    const defaultConfig = defaultConfigs[args.alertType] || { threshold: 0.01, severity: "medium" };
    return {
      enabled: true,
      threshold: defaultConfig.threshold,
      severity: defaultConfig.severity,
    };
  },
});

/**
 * Internal mutation to update performance alert configuration
 * Uses compound index by_tenant_and_alert_type for efficient lookups
 */
export const updatePerformanceAlertConfig = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    alertType: v.string(),
    threshold: v.number(),
    enabled: v.boolean(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  returns: v.id("performanceAlertConfig"),
  handler: async (ctx, args) => {
    // Check if config already exists using compound index
    const existing = await ctx.db
      .query("performanceAlertConfig")
      .withIndex("by_tenant_and_alert_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("alertType", args.alertType)
      )
      .first();

    if (existing) {
      // Update existing config
      await ctx.db.patch(existing._id, {
        threshold: args.threshold,
        enabled: args.enabled,
        severity: args.severity,
      });
      return existing._id;
    } else {
      // Create new config
      return await ctx.db.insert("performanceAlertConfig", {
        tenantId: args.tenantId,
        alertType: args.alertType,
        threshold: args.threshold,
        enabled: args.enabled,
        severity: args.severity,
      });
    }
  },
});
