import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditCatalog,
  defaultBounds,
  inStock,
  matchesModel,
  printfulReader,
  supportedAreas,
  usdDtgPrice,
} from "./ci/printful-catalog-enable.mjs";

test("model matching requires the exact brand and complete model token", () => {
  const candidate = { brand: "Bella+Canvas", model: "3001" };
  assert.equal(
    matchesModel(
      { brand: "Bella + Canvas", model: "3001", name: "Tee" },
      candidate
    ),
    true
  );
  assert.equal(
    matchesModel({ brand: "Bella+Canvas", name: "Tee | 3001B" }, candidate),
    false
  );
  assert.equal(
    matchesModel({ brand: "Other", model: "3001", name: "Tee" }, candidate),
    false
  );
});

test("only usable simple DTG templates pass capability checks", () => {
  const valid = {
    dpi: 150,
    mockup_styles: [{ id: 1 }],
    placement: "front",
    print_area_height: 16,
    print_area_type: "simple",
    print_area_width: 12,
    technique: "dtg",
  };
  assert.deepEqual(
    supportedAreas([
      valid,
      { ...valid, technique: "embroidery" },
      { ...valid, dpi: null },
      { ...valid, print_area_type: "advanced" },
    ]),
    [valid]
  );
});

test("stock must explicitly confirm DTG availability in a US selling region", () => {
  const entry = {
    techniques: [
      {
        selling_regions: [{ name: "usa", availability: "in stock" }],
        technique: "dtg",
      },
    ],
  };
  assert.equal(inStock(entry), true);
  assert.equal(inStock(), false);
  assert.equal(
    inStock({
      techniques: [
        {
          selling_regions: [{ name: "usa", availability: "in stock" }],
          technique: "embroidery",
        },
      ],
    }),
    false
  );
});

test("DTG prices reject missing, zero, negative and malformed values", () => {
  for (const price of [undefined, "", "0.00", "-1.00", "1.234", "NaN"])
    {assert.equal(
      usdDtgPrice({ techniques: [{ technique_key: "dtg", price }] }),
      null
    );}
  assert.equal(
    usdDtgPrice({ techniques: [{ price: "15.45", technique_key: "dtg" }] }),
    1545
  );
  assert.deepEqual(defaultBounds(1545), { max: 5000, min: 2500 });
});

test("catalog pagination reaches matches beyond the first hundred", async () => {
  const offsets = [],
    reader = printfulReader("test", async (url) => {
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return Response.json({
        data:
          offset === 0
            ? Array.from({ length: 100 }, (_, id) => ({ id }))
            : [{ id: 100 }],
        paging: { total: 101 },
      });
    });
  assert.equal((await reader.list("/catalog-products")).length, 101);
  assert.deepEqual(offsets, [0, 100]);
});

test("incomplete and repeated pages fail instead of silently skipping products", async () => {
  const incomplete = printfulReader("test", async () =>
    Response.json({ data: [{ id: 1 }], paging: { total: 101 } })
  );
  await assert.rejects(incomplete.list("/catalog-products"), /incomplete/);
  const repeated = printfulReader("test", async () =>
    Response.json({
      data: Array.from({ length: 100 }, (_, id) => ({ id })),
      paging: { total: 200 },
    })
  );
  await assert.rejects(repeated.list("/catalog-products"), /repeated/);
});

test("ambiguous products are reported without fetching details or making changes", async () => {
  const report = await auditCatalog({
    candidates: [{ brand: "Test", model: "123" }],
    reader: {
      list: async () => [
        { brand: "Test", id: 1, model: "123" },
        { brand: "Test", id: 2, model: "123" },
      ],
      request: () => {
        throw new Error("must not fetch ambiguous products");
      },
    },
  });
  assert.equal(report.results[0].status, "ambiguous");
  assert.equal(report.ready.length, 0);
});
