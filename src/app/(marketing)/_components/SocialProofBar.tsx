import React from "react";
import { Clock, Zap, Rocket } from "lucide-react";

const stats = [
  {
    id: "free-trial",
    icon: Clock,
    text: "14-day free trial · No card required",
  },
  {
    id: "saligpay-integration",
    icon: Zap,
    text: "Native SaligPay integration · Zero webhook setup",
  },
  {
    id: "quick-setup",
    icon: Rocket,
    text: "Set up in under 15 minutes · Connect · Configure · Invite",
  },
];

export function SocialProofBar(): React.JSX.Element {
  return (
    <section
      className="py-8 bg-[var(--bg-surface)] border-y border-[var(--border)]"
      aria-labelledby="social-proof-heading"
    >
      <h2 id="social-proof-heading" className="sr-only">
        Platform Benefits
      </h2>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 md:divide-x md:divide-[var(--border)]">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="flex items-center gap-2.5 text-sm text-[var(--text-body)] md:px-8"
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--brand-primary)]/[0.08]"
                  aria-hidden="true"
                >
                  <Icon className="w-4 h-4 text-[var(--brand-primary)]" />
                </span>
                <span className="font-medium">{stat.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
