import { PayoutsClient } from "./PayoutsClient";

export default function PayoutsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-muted-foreground mt-1">
          Generate payout batches and manage affiliate payments
        </p>
      </div>

      <PayoutsClient />
    </div>
  );
}
