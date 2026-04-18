import { mutation as rawMutation, internalMutation as rawInternalMutation } from "./_generated/server";
import { DataModel } from "./_generated/dataModel";
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import {
  affiliateAggregate,
  clicksAggregate,
  conversionsAggregate,
  commissionsAggregate,
  referralLinksAggregate,
  payoutsAggregate,
  affiliateByStatusAggregate,
  commissionByStatusAggregate,
  leadByStatusAggregate,
  payoutByStatusAggregate,
  notificationsByReadAggregate,
  commissionByFlagAggregate,
  cronExecutionsByStatusAggregate,
} from "./aggregates";

const triggers = new Triggers<DataModel>();

triggers.register("affiliates", affiliateAggregate.trigger());
triggers.register("referralLinks", referralLinksAggregate.trigger());
triggers.register("clicks", clicksAggregate.trigger());
triggers.register("conversions", conversionsAggregate.trigger());
triggers.register("commissions", commissionsAggregate.trigger());
triggers.register("payouts", payoutsAggregate.trigger());
triggers.register("affiliates", affiliateByStatusAggregate.trigger());
triggers.register("commissions", commissionByStatusAggregate.trigger());
triggers.register("referralLeads", leadByStatusAggregate.trigger());
triggers.register("payouts", payoutByStatusAggregate.trigger());
triggers.register("notifications", notificationsByReadAggregate.trigger());
triggers.register("commissions", commissionByFlagAggregate.trigger());
triggers.register("cronExecutions", cronExecutionsByStatusAggregate.trigger());

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
