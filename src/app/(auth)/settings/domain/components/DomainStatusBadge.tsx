import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, XCircle, Loader2 } from "lucide-react";

interface DomainStatusBadgeProps {
  status: string;
}

export function DomainStatusBadge({ status }: DomainStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          label: "Pending",
          variant: "secondary" as const,
          icon: Clock,
        };
      case "dns_verification":
        return {
          label: "DNS Verification",
          variant: "outline" as const,
          icon: AlertCircle,
        };
      case "ssl_provisioning":
        return {
          label: "SSL Provisioning",
          variant: "default" as const,
          icon: Loader2,
        };
      case "active":
        return {
          label: "Active",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800",
          icon: CheckCircle2,
        };
      case "failed":
        return {
          label: "Failed",
          variant: "destructive" as const,
          icon: XCircle,
        };
      default:
        return {
          label: "Unknown",
          variant: "secondary" as const,
          icon: Clock,
        };
    }
  };
  
  const config = getStatusConfig();
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
