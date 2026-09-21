// curve.ts — Phase 3's measurement. A curve, not a boolean.
//
//     deno run --allow-read --allow-run=python3 curve.ts --q1
//     deno run --allow-read --allow-run=python3 curve.ts --q3
//     deno run --allow-read --allow-run=python3 curve.ts --prune
//
// Three questions, from PLAN-build §3 Phase 3, and this file answers each with
// a number rather than a preference.
//
//   1. At what mean pool size does a 3-factor start existing reliably?
//   2. How far above three is that?  <- the (A)-vs-(B) decision of §1.2
//   3. How much weight is lost by pinning one person's three for a tick?
//
// The knob for 1 and 2 is `minWeight`. Raising it is exactly what narrowing
// does: it discards candidates the engine has come to think worse of, and the
// pool shrinks. So sweeping it traces the path the narrowing loop of §5 walks,
// without needing the loop to exist yet — and the point at which feasibility
// fails is the floor the loop must not go below.
//
// Every row names its seed. A curve that moves between runs is not a curve.

import { generate, rng } from "./fixtures.ts";
import {
  build,
  core,
  DEFAULT_PARAMS,
  gadgetSize,
  type Graph,
  induce,
  regularity,
  topK,
} from "./compat.ts";
import { assign } from "./assign.ts";

/** How far a round of answers moves a compatibility weight. A guess until
 *  Phase 5 produces the real distribution, and labelled as one. */
const JITTER = 0.05;

const K = 8; // see compat.ts §"Sparsification"; --prune measures the price

interface Row {
  minWeight: number;
  n: number;
  kept: number;
  peeled: number;
  meanPool: number;
  medianPool: number;
  minPool: number;
  feasible: boolean;
  meanW: number | null;
  ms: number;
  reason: string;
}

async function solveAt(
  n: number,
  minWeight: number,
  seed: number,
  budget: number,
): Promise<Row> {
  const f = generate({ n, budget, seed });
  const full = build(f.cohort, f.corpus, { ...DEFAULT_PARAMS, minWeight });
  // Pool size is measured on the FULL graph, before pruning. It is the number
  // §5 shows the user — "you have sixty-seven potential matches" — and pruning
  // is an implementation detail of the solver that no user is told about, so
  // reporting the pruned degree here would be quoting an internal number as a
  // product one.
  const pools = full.ids.map((id) => full.degree.get(id) ?? 0).sort((a, b) => a - b);
  const pruned = topK(full, K);
  const c = core(pruned);
  const h = induce(pruned, c.kept);

  const t0 = performance.now();
  const a = h.ids.length === 0
    ? { tag: "Infeasible" as const, reason: "core is empty", blame: [] }
    : await assign(h);
  const ms = performance.now() - t0;

  return {
    minWeight,
    n,
    kept: c.kept.length,
    peeled: c.peeled.length,
    meanPool: pools.reduce((x, y) => x + y, 0) / pools.length,
    medianPool: pools[Math.floor(pools.length / 2)],
    minPool: pools[0],
    feasible: a.tag === "Assigned",
    meanW: a.tag === "Assigned" ? a.weight / a.edges.length : null,
    ms,
    reason: a.tag === "Infeasible" ? a.reason : "",
  };
}

function header() {
  console.log(
    "\n  minW    n   kept  peeled   meanPool  medPool  minPool   feasible   meanW     ms",
  );
  console.log("  " + "-".repeat(76));
}

function print(r: Row) {
  console.log(
    `  ${r.minWeight.toFixed(2)}  ${String(r.n).padStart(4)}  ${String(r.kept).padStart(4)}  ` +
      `${String(r.peeled).padStart(6)}   ${r.meanPool.toFixed(1).padStart(8)}  ` +
      `${String(r.medianPool).padStart(7)}  ${String(r.minPool).padStart(7)}   ` +
      `${(r.feasible ? "yes" : "NO").padStart(8)}   ` +
      `${(r.meanW === null ? "-" : r.meanW.toFixed(4)).padStart(6)}  ` +
      `${r.ms.toFixed(0).padStart(5)}` +
      (r.reason ? `   ${r.reason.slice(0, 40)}` : ""),
  );
}

// ── Question 1 and 2: where does feasibility break, and how far above 3 ──

async function q1(sizes: number[], seeds: number[], budget: number) {
  console.log(
    `\n=== Q1/Q2: feasibility against mean pool size (budget ${budget}, K=${K}) ===`,
  );
  console.log(
    "\n  Raising minWeight is what narrowing does: candidates the engine came to\n" +
      "  think worse of are discarded and the pool shrinks. The last feasible row\n" +
      "  in each block is the floor the narrowing loop of §5 must not cross.",
  );

  const boundary: { n: number; seed: number; lastGood: Row | null; firstBad: Row | null }[] = [];

  for (const n of sizes) {
    for (const seed of seeds) {
      console.log(`\n  n = ${n}, seed = ${seed}`);
      header();
      let lastGood: Row | null = null;
      let firstBad: Row | null = null;
      for (const mw of [0.50, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90]) {
        const r = await solveAt(n, mw, seed, budget);
        print(r);
        if (r.feasible) lastGood = r;
        else if (firstBad === null) firstBad = r;
        // Once the core empties there is nothing further to learn from this row
        // block; continuing would print identical failures.
        if (r.kept === 0) break;
      }
      boundary.push({ n, seed, lastGood, firstBad });
    }
  }

  console.log("\n\n  === the answer to Q1 and Q2 ===\n");
  console.log("     n   seed   last feasible mean pool   and how far above three");
  for (const b of boundary) {
    if (b.lastGood === null) {
      console.log(`  ${String(b.n).padStart(4)}  ${b.seed}   never feasible`);
      continue;
    }
    // The honest statistic is the MINIMUM pool at the boundary, not the mean:
    // the assignment fails on the worst-served person, not the average one.
    console.log(
      `  ${String(b.n).padStart(4)}  ${b.seed}   ${b.lastGood.meanPool.toFixed(1).padStart(19)}   ` +
        `${(b.lastGood.meanPool / 3).toFixed(1)}x   (min pool ${b.lastGood.minPool}, ` +
        `${b.lastGood.peeled} waited a tick)`,
    );
  }
  console.log(
    "\n  Reading (A) of §1.2 asks the loop to drive the mean pool to exactly 3.\n" +
      "  The gap between that and the numbers above is the whole of the (A)-vs-(B)\n" +
      "  decision, and it is now arithmetic rather than taste.",
  );
}

// ── Question 3: the cost of cadence ───────────────────────────────────

async function q3(n: number, seed: number, budget: number) {
  console.log(`\n=== Q3: the cost of pinning (n=${n}, seed=${seed}, K=${K}) ===`);
  console.log(
    "\n  A person mid-meeting has their three fixed while the cohort re-solves\n" +
      "  around them. Pinning is a quota decrement, so the same solver answers it.\n" +
      "  The brief called this cost unknowable. It is one subtraction.",
  );

  const f = generate({ n, budget, seed });
  const full = build(f.cohort, f.corpus);
  const pruned = topK(full, K);
  const c = core(pruned);
  const h = induce(pruned, c.kept);

  const base = await assign(h);
  if (base.tag !== "Assigned") {
    console.log(`\n  base solve infeasible: ${base.reason}`);
    return;
  }
  console.log(
    `\n  unpinned:  weight ${base.weight.toFixed(2)} over ${base.edges.length} edges, ` +
      `mean ${(base.weight / base.edges.length).toFixed(5)}`,
  );

  // What a tick IS, modelled honestly. The first attempt at this regenerated
  // the fixture with seed+1, which produces a DIFFERENT COHORT — different
  // people with the same ids — and then reported that the re-solve was
  // infeasible. That is not the cost of cadence; it is the cost of replacing
  // everybody. A tick is the SAME people whose weights have moved because a
  // round of answers came in, so the graph is jittered rather than regenerated.
  const jitter = rng(seed + 1);
  const h2: Graph = {
    ...h,
    edges: h.edges.map((e) => ({
      ...e,
      w: Math.max(0, Math.min(1, e.w + (jitter() - 0.5) * 2 * JITTER)),
    })),
  };
  const free = await assign(h2);
  if (free.tag !== "Assigned") {
    console.log(`  re-solve infeasible unpinned: ${free.reason}`);
    return;
  }

  console.log(
    `  jittered by +/-${JITTER}: the same people, one round of answers later`,
  );

  console.log("\n  pinned%   pinned edges   weight    mean      loss vs free re-solve");
  console.log("  " + "-".repeat(70));
  console.log(
    `  ${"0".padStart(7)}   ${String(0).padStart(12)}   ${free.weight.toFixed(2).padStart(6)}   ` +
      `${(free.weight / free.edges.length).toFixed(5)}   ${"-".padStart(8)}`,
  );

  const index = new Map(h2.ids.map((id, i) => [id, i]));
  const eIndex = new Map(h2.edges.map((e, i) => [`${e.u}|${e.v}`, i]));
  const lookup = (u: string, v: string) => eIndex.get(`${u}|${v}`) ?? eIndex.get(`${v}|${u}`);

  for (const frac of [0.1, 0.25, 0.5, 1.0]) {
    // Pin whole triples, in id order, so the choice is deterministic. Pinning
    // half an edge is not a thing: both endpoints are committed or neither is.
    const pinPeople = new Set(h2.ids.slice(0, Math.round(h2.ids.length * frac)));
    const pinned = new Set<number>();
    let unavailable = 0;
    for (const e of base.edges) {
      if (!pinPeople.has(e.u) || !pinPeople.has(e.v)) continue;
      const i = lookup(e.u, e.v);
      // An edge from last tick that this tick's graph no longer contains cannot
      // be pinned. That is not an error: it is two people who stopped being
      // comparable, and it is exactly what makes cadence cost something.
      if (i === undefined) { unavailable++; continue; }
      pinned.add(i);
    }

    const req = {
      n: h2.ids.length,
      edges: h2.edges.map((e) => ({ u: index.get(e.u), v: index.get(e.v), w: e.w })),
      pinned: [...pinned],
    };
    const cmd = new Deno.Command("python3", {
      args: ["assign.py"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    const child = cmd.spawn();
    const w = child.stdin.getWriter();
    await w.write(new TextEncoder().encode(JSON.stringify(req)));
    await w.close();
    const out = await child.output();
    const res = JSON.parse(new TextDecoder().decode(out.stdout));

    if (res.tag !== "Assigned") {
      console.log(
        `  ${(100 * frac).toFixed(0).padStart(6)}%   ${String(pinned.size).padStart(12)}   ` +
          `INFEASIBLE  ${res.reason.slice(0, 40)}`,
      );
      continue;
    }
    const meanW = res.weight / res.edges.length;
    const loss = 100 * (1 - res.weight / free.weight);
    console.log(
      `  ${(100 * frac).toFixed(0).padStart(6)}%   ${String(pinned.size).padStart(12)}   ` +
        `${res.weight.toFixed(2).padStart(6)}   ${meanW.toFixed(5)}   ${loss.toFixed(2).padStart(7)}%` +
        (unavailable ? `   (${unavailable} stale edges could not be pinned)` : ""),
    );
  }
}

// ── The price of the one heuristic in the pipeline ────────────────────

async function prune(n: number, seed: number, budget: number) {
  console.log(`\n=== the price of top-K pruning (n=${n}, seed=${seed}) ===`);
  console.log(
    "\n  The Tutte gadget carries sum of d(v)(d(v)-b(v)) internal edges, so it is\n" +
      "  quadratic in the degree. Pruning is not an optimisation; without it the\n" +
      "  solve does not return. What it costs is measured, not assumed.",
  );
  const f = generate({ n, budget, seed });
  const full = build(f.cohort, f.corpus);
  console.log(
    `\n  unpruned: ${full.edges.length} edges, mean degree ` +
      `${regularity(full).meanDegree.toFixed(1)}, gadget ${gadgetSize(full).edges} edges`,
  );
  console.log("\n    K   edges   gadget edges   feasible    meanW     vs best      ms");
  console.log("  " + "-".repeat(66));
  const results: { k: number; meanW: number | null; ms: number; ge: number; ne: number }[] = [];
  for (const k of [4, 5, 6, 8, 12, 20]) {
    const p = topK(full, k);
    const c = core(p);
    const h: Graph = induce(p, c.kept);
    const ge = gadgetSize(h).edges;
    const t0 = performance.now();
    const a = h.ids.length === 0
      ? { tag: "Infeasible" as const, reason: "empty", blame: [] }
      : await assign(h);
    const ms = performance.now() - t0;
    results.push({
      k,
      meanW: a.tag === "Assigned" ? a.weight / a.edges.length : null,
      ms,
      ge,
      ne: p.edges.length,
    });
  }
  const best = Math.max(...results.map((r) => r.meanW ?? 0));
  for (const r of results) {
    console.log(
      `  ${String(r.k).padStart(3)}   ${String(r.ne).padStart(5)}   ${String(r.ge).padStart(12)}   ` +
        `${(r.meanW === null ? "NO" : "yes").padStart(8)}   ` +
        `${(r.meanW === null ? "-" : r.meanW.toFixed(5)).padStart(7)}   ` +
        `${(r.meanW === null ? "-" : (100 * (1 - r.meanW / best)).toFixed(3) + "%").padStart(8)}   ` +
        `${r.ms.toFixed(0).padStart(5)}`,
    );
  }
}

if (import.meta.main) {
  const num = (k: string, d: number) => {
    const hit = Deno.args.find((a) => a.startsWith(`--${k}=`));
    return hit === undefined ? d : Number(hit.split("=")[1]);
  };
  const budget = num("budget", 40);
  const seed = num("seed", 20260921);

  if (Deno.args.includes("--q3")) {
    await q3(num("n", 200), seed, budget);
  } else if (Deno.args.includes("--prune")) {
    await prune(num("n", 200), seed, budget);
  } else {
    const sizes = Deno.args.includes("--big") ? [50, 200, 1000] : [50, 200];
    await q1(sizes, [seed, seed + 1], budget);
  }
  console.log();
}
