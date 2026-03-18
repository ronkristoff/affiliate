export function SocialProofBar() {
  const stats = [
    "14-day free trial · No card required",
    "Native SaligPay integration · Zero webhook setup",
    "Set up in under 15 minutes · Connect · Configure · Invite",
  ];

  return (
    <section className="py-8 bg-white border-y border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 text-sm text-[var(--text-body)]"
            >
              {index > 0 && (
                <div className="hidden md:block w-1 h-1 rounded-full bg-[var(--border)]" />
              )}
              <span className="font-medium">{stat}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
