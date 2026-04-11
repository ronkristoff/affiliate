interface PendingApprovalStateProps {
  email: string;
}

export function PendingApprovalState({ email }: PendingApprovalStateProps) {
  return (
    <div className="bg-muted/50 border border-muted rounded-xl p-6">
      <h3 className="text-base font-semibold text-foreground">
        Your application is under review
      </h3>
      <p className="text-sm text-muted-foreground mt-2">
        We typically review applications within 48 hours. We&apos;ll email you at{" "}
        <span className="font-medium text-foreground">{email}</span> once you&apos;re approved.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        In the meantime, feel free to explore your dashboard.
      </p>
    </div>
  );
}
