import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import resend from "@convex-dev/resend/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(resend);
app.use(aggregate);
app.use(aggregate, { name: "affiliateByStatus" });
app.use(aggregate, { name: "commissionByStatus" });
app.use(aggregate, { name: "leadByStatus" });
app.use(aggregate, { name: "payoutByStatus" });
app.use(aggregate, { name: "apiCalls" });
app.use(aggregate, { name: "degradation" });
app.use(aggregate, { name: "affiliates" });
app.use(aggregate, { name: "referralLinks" });
app.use(aggregate, { name: "clicks" });
app.use(aggregate, { name: "conversions" });
app.use(aggregate, { name: "commissions" });
app.use(aggregate, { name: "payouts" });
app.use(aggregate, { name: "cronExecutionsByStatus" });

export default app;
