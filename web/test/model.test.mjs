// node --test test/   (Node 24 runs the TypeScript engine directly)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIXTURE, params, run, INPUTS } from "../src/lib/syrup-model.ts";
import { actualsCsv } from "../src/lib/model-csv.ts";

const AS = JSON.parse(readFileSync(new URL("../config/syrup-model-assumptions.json", import.meta.url)));
const I = 6; // 2030E column
const usd = (got, want, label) => assert.ok(Math.abs(got - want) <= 1, `${label}: ${got} vs ${want}`);
const px = (got, want, label) => assert.ok(Math.abs(got - want) <= 0.00005, `${label}: ${got} vs ${want}`);

// handoff section 6: expected table, Base
const TABLE = {
  4: [203763644082, 304427076510, 292360000000, 472820136273, 764669863405, 1236664759266, 2000000000000],
  6: [null, 12564442805, 12187601374, 19710436936, 31876766582, 51552801749, 83373931961],
  8: [26441000000, 36676000000, 31896805070, 51585209057, 83426342783, 134921517182, 218202251129],
  13: [82449654, 2007349041, 1487230186, 2645750503, 4278848384, 6919981105, 11191361367],
  14: [187305215, 2105353779, 1867844184, 3301453380, 5339285938, 8634977100, 13964944072],
  15: [179002669, 2032578122, 1834055440, 3241731073, 5242699848, 8478772940, 13712322401],
  17: [254731700, 2463865676, 2557673858, 4520741652, 7311183760, 11824035100, 19122458226],
  18: [442036915, 4569219455, 4425518042, 7822195032, 12650469698, 20459012199, 33087402299],
  32: [259790, 6172929, 11251412, 18693353, 31246874, 50534105, 81726442],
  33: [1665927, 7895605, 12270772, 20386941, 34077791, 55112415, 89130728],
  34: [1153122, 7373785, 4495595, 7469084, 12484948, 20191321, 32654478],
  35: [2819049, 15269390, 16766367, 27856025, 46562738, 75303736, 121785206],
  38: [0, 1272449, 1676637, 2321335, 3880228, 6275311, 10148767],
  40: [0, 2413622, 1119517, 5571205, 9312548, 15060747, 24357041],
  43: [187096325, 397221254, 158002759, 261846634, 437689739, 707855118, 1144780932],
  46: [1154915586, 1216231641, 1166933227, 1166933227, 1166933227, 1166933227, 1166933227],
};
const PCT = { 5: [null, 0.4940, -0.0396, 0.6173], 7: [null, 0.0413, 0.0417, 0.0417], 9: [0.1298, 0.1205, 0.1091, 0.1091], 12: [null, 0.1598, 0.1220, 0.1342],
  16: [0.9557, 0.9654, 0.9819, 0.9819], 19: [0.0071, 0.0574, 0.0586, 0.0640], 36: [0.0157, 0.0075, 0.0110, 0.0110], 39: [0, 0.1581, 0.0668, 0.20] };
const PRICE = [0.15, 0.32, 0.1354, 0.2244, 0.3751, 0.6066, 0.9810];

test("Base matches the sheet (section 6)", () => {
  const cols = run(FIXTURE, params(FIXTURE, AS, "base"));
  px(cols[I][48], 0.9810, "2030 price");
  usd(cols[I][35], 121785206, "2030 revenue"); usd(cols[I][40], 24357041, "2030 buybacks"); usd(cols[I][43], 1144780932, "2030 market cap");
  for (const [r, xs] of Object.entries(TABLE)) xs.forEach((want, i) => {
    if (want == null) return;
    // the sheet's table is rounded to whole dollars; buybacks 2025 is 2,413,622.21
    assert.ok(Math.abs(cols[i][r] - want) <= 1.5, `row ${r} col ${i}: ${cols[i][r]} vs ${want}`);
  });
  for (const [r, xs] of Object.entries(PCT)) xs.forEach((want, i) => { if (want != null) assert.ok(Math.abs(cols[i][r] - want) < 0.00006, `row ${r} col ${i}: ${cols[i][r]} vs ${want}`); });
  PRICE.forEach((want, i) => px(Math.round(cols[i][48] * 1e4) / 1e4, want, `price col ${i}`));
  assert.ok(Math.abs(cols[2][47] - 9.4238) < 0.0001, "E47");
});

test("Bear and Bull (section 7)", () => {
  const bear = run(FIXTURE, params(FIXTURE, AS, "bear"))[I], bull = run(FIXTURE, params(FIXTURE, AS, "bull"))[I];
  px(Math.round(bear[48] * 1e4) / 1e4, 0.5061, "bear price"); assert.ok(Math.abs(bear[35] - 111.43e6) < 0.01e6, "bear revenue");
  assert.ok(Math.abs(bear[40] - 22.29e6) < 0.01e6, "bear buybacks"); assert.ok(Math.abs(bear[43] - 590.6e6) < 0.1e6, "bear mcap");
  px(Math.round(bull[48] * 1e4) / 1e4, 3.1004, "bull price"); assert.ok(Math.abs(bull[35] - 258.43e6) < 0.01e6, "bull revenue");
  assert.ok(Math.abs(bull[40] - 51.69e6) < 0.01e6, "bull buybacks"); assert.ok(Math.abs(bull[43] - 3618e6) < 1e6, "bull mcap");
});

test("changing an assumption moves the price", () => {
  const p = run(FIXTURE, params(FIXTURE, { ...AS, stablecoins_2030: 3e12 }, "base"))[I][48];
  assert.ok(p > 1.2, `3T price ${p}`);
});

test("/api/actuals.csv: every input row, VLOOKUP by row number", () => {
  const csv = actualsCsv(FIXTURE);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "row,key,label,value,as_of,unit,source");
  const split = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => m[1].replace(/^"|"$/g, "").replace(/""/g, '"'));
  const byRow = new Map(lines.slice(1).map((l) => { const f = split(l); return [Number(f[0]), f]; }));
  assert.equal(byRow.size, INPUTS.length);
  for (const { row } of INPUTS) assert.ok(byRow.has(row), `row ${row}`);
  for (const r of [5, 7, 9, 12, 16, 18, 19, 35, 36, 38, 39, 41, 47]) assert.ok(!byRow.has(r), `formula row ${r} must not be emitted`);
  assert.equal(Number(byRow.get(48)[3]), 0.1354); assert.equal(Number(byRow.get(4)[3]), 292360000000);
  assert.equal(byRow.get(4)[4], "2026-10-31");
  for (const f of byRow.values()) assert.equal(f.length, 7, `no stray commas: ${f.join(",")}`);
});
