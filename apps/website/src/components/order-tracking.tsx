import { ExternalLink, Package, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface OrderTrackingData {
  carrier: string | null;
  deliveredAt: string | null;
  estimatedDelivery: {
    calculatedAt?: string;
    fromDate?: string;
    toDate?: string;
  } | null;
  fulfillmentStatus:
    | "cancelled"
    | "delivered"
    | "failed"
    | "kunaki_processing"
    | "not_applicable"
    | "pending"
    | "printful_processing"
    | "shipped";
  shippedAt: string | null;
  trackingEvents: Array<{
    description?: string;
    triggeredAt?: string;
  }>;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

const STATUS_LABELS: Record<OrderTrackingData["fulfillmentStatus"], string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  failed: "Failed",
  kunaki_processing: "Preparing (Kunaki)",
  not_applicable: "Digital — no tracking",
  pending: "Preparing for shipment",
  printful_processing: "Printing",
  shipped: "Shipped",
},
  STATUS_VARIANTS: Record<
    OrderTrackingData["fulfillmentStatus"],
    "default" | "destructive" | "outline" | "secondary"
  > = {
    cancelled: "destructive",
    delivered: "default",
    failed: "destructive",
    kunaki_processing: "secondary",
    not_applicable: "outline",
    pending: "secondary",
    printful_processing: "secondary",
    shipped: "default",
  },
  formatDateTime = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }

    return new Date(value).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

export function OrderTracking({ tracking }: { tracking: OrderTrackingData }) {
  const isDigital = tracking.fulfillmentStatus === "not_applicable";

  if (isDigital) {
    return null;
  }

  const hasTracking =
    tracking.trackingNumber || tracking.trackingUrl || tracking.carrier;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Package className="text-primary size-4" />
            Order Tracking
          </CardTitle>
          <Badge
            variant={STATUS_VARIANTS[tracking.fulfillmentStatus]}
            className="text-[10px]"
          >
            {STATUS_LABELS[tracking.fulfillmentStatus]}
          </Badge>
        </div>
        {hasTracking ? (
          <CardDescription className="text-xs">
            {tracking.carrier ? `${tracking.carrier} · ` : ""}
            {tracking.trackingNumber
              ? `Tracking #${tracking.trackingNumber}`
              : "Awaiting tracking details"}
          </CardDescription>
        ) : (
          <CardDescription className="text-xs">
            {tracking.fulfillmentStatus === "pending" ||
            tracking.fulfillmentStatus === "printful_processing" ||
            tracking.fulfillmentStatus === "kunaki_processing"
              ? "Your items are being prepared for shipment."
              : "Tracking details will appear here once your order ships."}
          </CardDescription>
        )}
      </CardHeader>
      {hasTracking || tracking.shippedAt || tracking.deliveredAt ? (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {tracking.shippedAt ? (
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                  Shipped
                </p>
                <p className="font-semibold">{formatDateTime(tracking.shippedAt)}</p>
              </div>
            ) : null}
            {tracking.deliveredAt ? (
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                  Delivered
                </p>
                <p className="font-semibold">
                  {formatDateTime(tracking.deliveredAt)}
                </p>
              </div>
            ) : tracking.estimatedDelivery?.toDate ? (
              <div>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                  Est. delivery
                </p>
                <p className="font-semibold">
                  {tracking.estimatedDelivery.fromDate
                    ? `${formatDateTime(tracking.estimatedDelivery.fromDate)} – `
                    : ""}
                  {formatDateTime(tracking.estimatedDelivery.toDate)}
                </p>
              </div>
            ) : null}
          </div>
          {tracking.trackingUrl ? (
            <a
              className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              href={tracking.trackingUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Truck className="size-3.5" />
              Track your package
              <ExternalLink className="size-3" />
            </a>
          ) : null}
          {tracking.trackingEvents.length > 0 ? (
            <div className="space-y-1.5 border-border/30 border-t pt-3">
              {tracking.trackingEvents
                .slice(-5)
                .reverse()
                .map((event, index) => (
                  <div className="flex items-start gap-2" key={index}>
                    <div
                      className={`mt-1 size-1.5 shrink-0 rounded-full ${
                        index === 0
                          ? "bg-primary"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {event.description ?? "Tracking update"}
                      </p>
                      {event.triggeredAt ? (
                        <p className="text-muted-foreground text-[10px]">
                          {formatDateTime(event.triggeredAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
