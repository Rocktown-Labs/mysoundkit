import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { escapeXml, getXmlTagValue, KunakiClient } from "./kunaki";

describe("Kunaki XML Client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("escapes XML special characters safely", () => {
    const raw = `Bob & Alice <test> "quotes" and 'apostrophes'`;
    expect(escapeXml(raw)).toBe(
      "Bob &amp; Alice &lt;test&gt; &quot;quotes&quot; and &apos;apostrophes&apos;"
    );
  });

  it("extracts XML tag values accurately", () => {
    const sampleXml = `<Response><ErrorCode>0</ErrorCode><ErrorText>success</ErrorText></Response>`;
    expect(getXmlTagValue(sampleXml, "ErrorCode")).toBe("0");
    expect(getXmlTagValue(sampleXml, "ErrorText")).toBe("success");
    expect(getXmlTagValue(sampleXml, "Missing")).toBe(null);
  });

  it("requests and parses live shipping quotes", async () => {
    const mockResponseXml = `<?xml version="1.0"?>
<Response>
  <ErrorCode>0</ErrorCode>
  <ErrorText>success</ErrorText>
  <Option>
    <Description>USPS First Class Mail</Description>
    <DeliveryTime>2-5 days</DeliveryTime>
    <Price>4.50</Price>
  </Option>
  <Option>
    <Description>UPS Ground</Description>
    <DeliveryTime>2-4 days</DeliveryTime>
    <Price>8.20</Price>
  </Option>
</Response>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockResponseXml),
    });

    const client = new KunakiClient({
        isTestMode: true,
        password: "test-password",
        userId: "test@mysoundkit.com",
      }),
      options = await client.quoteShipping({
        country: "United States",
        items: [{ productId: "PX00LRNY2H", quantity: 1 }],
        postalCode: "10004",
        stateProvince: "NY",
      });

    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({
      deliveryTime: "2-5 days",
      description: "USPS First Class Mail",
      price: 4.5,
      priceCents: 450,
    });
    expect(options[1]).toEqual({
      deliveryTime: "2-4 days",
      description: "UPS Ground",
      price: 8.2,
      priceCents: 820,
    });
  });

  it("handles shipping quote error responses", async () => {
    const mockErrorXml = `<?xml version="1.0"?>
<Response>
  <ErrorCode>9</ErrorCode>
  <ErrorText>ProductId element is not valid</ErrorText>
</Response>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockErrorXml),
    });

    const client = new KunakiClient({
      isTestMode: true,
      password: "test-password",
      userId: "test@mysoundkit.com",
    });

    await expect(
      client.quoteShipping({
        country: "United States",
        items: [{ productId: "INVALID_PID", quantity: 1 }],
        postalCode: "10004",
      })
    ).rejects.toThrow(
      "Kunaki Shipping Quote Failed (Code 9): ProductId element is not valid"
    );
  });

  it("submits manufacturing orders and returns OrderId", async () => {
    const mockOrderXml = `<?xml version="1.0"?>
<Response>
  <ErrorCode>0</ErrorCode>
  <ErrorText>success</ErrorText>
  <OrderId>892341</OrderId>
</Response>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockOrderXml),
    });

    const client = new KunakiClient({
        isTestMode: true,
        password: "test-password",
        userId: "test@mysoundkit.com",
      }),
      orderId = await client.createOrder({
        address1: "123 Vinyl Way",
        address2: "Apt 4B",
        city: "Brooklyn",
        country: "United States",
        items: [{ productId: "PX00LRNY2H", quantity: 1 }],
        name: "Alex Rivers",
        postalCode: "11201",
        shippingDescription: "USPS First Class Mail",
        stateProvince: "NY",
      });

    expect(orderId).toBe("892341");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("queries order status and parses tracking details", async () => {
    const mockStatusXml = `<?xml version="1.0"?>
<Response>
  <ErrorCode>0</ErrorCode>
  <ErrorText>success</ErrorText>
  <OrderId>892341</OrderId>
  <OrderStatus>SHIPPED</OrderStatus>
  <TrackingType>USPS</TrackingType>
  <TrackingId>9400100000000000000000</TrackingId>
</Response>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockStatusXml),
    });

    const client = new KunakiClient({
        isTestMode: true,
        password: "test-password",
        userId: "test@mysoundkit.com",
      }),
      status = await client.getOrderStatus("892341");

    expect(status).toEqual({
      orderId: "892341",
      status: "SHIPPED",
      trackingId: "9400100000000000000000",
      trackingType: "USPS",
    });
  });
});
