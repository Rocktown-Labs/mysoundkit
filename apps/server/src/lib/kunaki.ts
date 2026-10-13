import { env } from "@soundkit/env/server";

export interface KunakiShippingProduct {
  productId: string;
  quantity: number;
}

export interface KunakiShippingQuoteInput {
  country: string;
  items: KunakiShippingProduct[];
  postalCode: string;
  stateProvince?: string;
}

export interface KunakiShippingOption {
  deliveryTime: string;
  description: string;
  price: number;
  priceCents: number;
}

export interface KunakiOrderInput {
  address1: string;
  address2?: string;
  city: string;
  company?: string;
  country: string;
  items: KunakiShippingProduct[];
  mode?: "Live" | "Test";
  name: string;
  postalCode: string;
  shippingDescription: string;
  stateProvince?: string;
}

export interface KunakiOrderStatusResult {
  orderId: string;
  status: "APPROVED" | "DECLINED" | "PENDING" | "PROCESSING" | "SHIPPED";
  trackingId: string;
  trackingType: string;
}

const KUNAKI_ENDPOINT = "https://Kunaki.com/XMLService.ASP";

export const escapeXml = (unsafe: string): string =>
  unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const getXmlTagValue = (xml: string, tag: string): string | null => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu").exec(
    xml
  );
  return match?.[1] ? match[1].trim() : null;
};

export class KunakiClient {
  private isTestMode: boolean;
  private password: string;
  private userId: string;

  constructor(options?: {
    isTestMode?: boolean;
    password?: string;
    userId?: string;
  }) {
    const serverEnv = env as unknown as Record<string, string | undefined>;
    this.userId = options?.userId ?? serverEnv.KUNAKI_USER_ID?.trim() ?? "";
    this.password =
      options?.password ?? serverEnv.KUNAKI_PASSWORD?.trim() ?? "";
    this.isTestMode =
      options?.isTestMode ??
      serverEnv.KUNAKI_MODE?.trim().toLowerCase() !== "live";
  }

  isConfigured(): boolean {
    return this.userId.length > 0 && this.password.length > 0;
  }

  private async postXml(payload: string): Promise<string> {
    const response = await fetch(KUNAKI_ENDPOINT, {
      body: payload,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `Kunaki HTTP Error: ${response.status} ${response.statusText}`
      );
    }

    return response.text();
  }

  /**
   * Retrieves real-time shipping options and rates for a prospective order
   */
  async quoteShipping(
    input: KunakiShippingQuoteInput
  ): Promise<KunakiShippingOption[]> {
    if (!input.country) {
      throw new Error("Kunaki shipping quote requires a destination country.");
    }

    if (!input.postalCode) {
      throw new Error("Kunaki shipping quote requires a postal code.");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error(
        "Kunaki shipping quote requires at least one product item."
      );
    }

    const productXml = input.items
        .map(
          (item) => `
    <Product>
      <ProductId>${escapeXml(item.productId)}</ProductId>
      <Quantity>${item.quantity}</Quantity>
    </Product>`
        )
        .join(""),
      xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<ShippingOptions>
  <Country>${escapeXml(input.country)}</Country>
  <State_Province>${escapeXml(input.stateProvince ?? "")}</State_Province>
  <PostalCode>${escapeXml(input.postalCode)}</PostalCode>
  ${productXml}
</ShippingOptions>`,
      resXml = await this.postXml(xmlPayload),
      errorCode = getXmlTagValue(resXml, "ErrorCode"),
      errorText = getXmlTagValue(resXml, "ErrorText");

    if (errorCode !== "0") {
      throw new Error(
        `Kunaki Shipping Quote Failed (Code ${errorCode}): ${errorText}`
      );
    }

    const options: KunakiShippingOption[] = [],
      optionMatches = resXml.match(/<Option>([\s\S]*?)<\/Option>/giu) ?? [];

    for (const optBlock of optionMatches) {
      const description =
          getXmlTagValue(optBlock, "Description") ?? "Standard Shipping",
        deliveryTime = getXmlTagValue(optBlock, "DeliveryTime") ?? "3-7 days",
        priceStr = getXmlTagValue(optBlock, "Price") ?? "0.00",
        price = Number.parseFloat(priceStr);

      options.push({
        deliveryTime,
        description,
        price,
        priceCents: Math.round(price * 100),
      });
    }

    return options;
  }

  /**
   * Submits an automated manufacturing and dropship fulfillment order to Kunaki
   */
  async createOrder(input: KunakiOrderInput): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Kunaki API credentials are not configured.");
    }

    if (!input.name) {
      throw new Error("Recipient name is required for fulfillment.");
    }

    if (!input.address1) {
      throw new Error("Recipient address1 is required for fulfillment.");
    }

    if (!input.city) {
      throw new Error("Recipient city is required for fulfillment.");
    }

    if (!input.shippingDescription) {
      throw new Error("Shipping description is required for fulfillment.");
    }

    const mode = input.mode ?? (this.isTestMode ? "Test" : "Live"),
      productXml = input.items
        .map(
          (item) => `
    <Product>
      <ProductId>${escapeXml(item.productId)}</ProductId>
      <Quantity>${item.quantity}</Quantity>
    </Product>`
        )
        .join(""),
      xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<Order>
  <UserId>${escapeXml(this.userId)}</UserId>
  <Password>${escapeXml(this.password)}</Password>
  <Mode>${mode}</Mode>
  <Name>${escapeXml(input.name)}</Name>
  <Company>${escapeXml(input.company ?? "")}</Company>
  <Address1>${escapeXml(input.address1)}</Address1>
  <Address2>${escapeXml(input.address2 ?? "")}</Address2>
  <City>${escapeXml(input.city)}</City>
  <State_Province>${escapeXml(input.stateProvince ?? "")}</State_Province>
  <PostalCode>${escapeXml(input.postalCode)}</PostalCode>
  <Country>${escapeXml(input.country)}</Country>
  <ShippingDescription>${escapeXml(input.shippingDescription)}</ShippingDescription>
  ${productXml}
</Order>`,
      resXml = await this.postXml(xmlPayload),
      errorCode = getXmlTagValue(resXml, "ErrorCode"),
      errorText = getXmlTagValue(resXml, "ErrorText");

    if (errorCode !== "0") {
      throw new Error(
        `Kunaki Order Creation Failed (Code ${errorCode}): ${errorText}`
      );
    }

    const orderId = getXmlTagValue(resXml, "OrderId");
    if (!orderId) {
      throw new Error(
        "Kunaki Order Creation succeeded but returned no OrderId."
      );
    }

    return orderId;
  }

  /**
   * Queries production and shipping status for a placed Kunaki order
   */
  async getOrderStatus(orderId: string): Promise<KunakiOrderStatusResult> {
    if (!this.isConfigured()) {
      throw new Error("Kunaki API credentials are not configured.");
    }

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<OrderStatus>
  <UserId>${escapeXml(this.userId)}</UserId>
  <Password>${escapeXml(this.password)}</Password>
  <OrderId>${escapeXml(orderId)}</OrderId>
</OrderStatus>`,
      resXml = await this.postXml(xmlPayload),
      errorCode = getXmlTagValue(resXml, "ErrorCode"),
      errorText = getXmlTagValue(resXml, "ErrorText");

    if (errorCode !== "0") {
      throw new Error(
        `Kunaki Order Status Check Failed (Code ${errorCode}): ${errorText}`
      );
    }

    const statusStr = (
        getXmlTagValue(resXml, "OrderStatus") ?? "PENDING"
      ).toUpperCase(),
      trackingType = getXmlTagValue(resXml, "TrackingType") ?? "NA",
      trackingId = getXmlTagValue(resXml, "TrackingId") ?? "NA";

    return {
      orderId,
      status: statusStr as KunakiOrderStatusResult["status"],
      trackingId,
      trackingType,
    };
  }
}

export const createKunakiClient = (
  options?: ConstructorParameters<typeof KunakiClient>[0]
) => new KunakiClient(options);
