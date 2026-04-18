import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cron-dispatcher",
  { minutes: 5 },
  internal.cronDispatcher.runDispatcher,
  {}
);

export default crons;
