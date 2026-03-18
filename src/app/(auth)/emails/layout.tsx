import Link from "next/link";
import { Mail, Send, History } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/emails/broadcast">
            <Send className="h-4 w-4 mr-2" />
            Broadcast
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/emails/history">
            <History className="h-4 w-4 mr-2" />
            History
          </Link>
        </Button>
      </div>

      {children}
    </div>
  );
}
