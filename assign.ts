// assign.ts — the parity gate, the degree gate, and the decoder.
//
// assign.py owns the mathematics. This file owns the types, the preconditions
// that can be settled without running Edmonds' algorithm, and the validation of
// what comes back.
//
// The last of those is the point. `assign.py` is an ORACLE: a process outside
// the type system that returns JSON. dungeon/leaf-claude.ts established the
// discipline for that — decode, no defaults, throw on non-decode — and the fact
// that this particular oracle is deterministic Python rather than a language
// model changes nothing about what its output is worth before it is checked.
// A wrong 3-factor and a right one differ only in numbers that no downstream
// phase re-derives.
//
// So `decode` re-verifies the reduction's guarantee: every assigned person holds
// exactly three, and holds them mutually. That check is cheap, and it is the
// only thing standing between a gadget bug and a product that tells two hundred
// people to meet the wrong strangers.

import type { Graph } from "./compat.ts";
import { starved } from "./compat.ts";
import type { PersonId } from "./people.ts";

export type Assignment =
  | {
    tag: "Assigned";
    weight: number;
    triples: ReadonlyMap<PersonId, readonly PersonId[]>;
    edges: readonly { u: PersonId; v: PersonId; w: number }[];
  }
  | { tag: "Infeasible"; reason: string; blame: readonly PersonId[] };

/** Everything that can be decided without the solver. Returning the blame list
 *  rather than a boolean is §5's obligation: the system knows the difference
 *  between "I don't know enough about you" and "there are not three such people
 *  here", and it owes the user the second sentence when it is the true one. */
export function precheck(
  g: Graph,
): { ok: true } | { ok: false; reason: string; blame: PersonId[] } {
  if (g.ids.length % 2 !== 0) {
    return {
      ok: false,
      reason: `cohort of ${g.ids.length} is odd; 3n = 2|E| forces n even (see §1.4)`,
      blame: [],
    };
  }
  const thin = starved(g);
  if (thin.length > 0) {
    return {
      ok: false,
      reason: `${thin.length} of ${g.ids.length} have fewer than three mutual candidates`,
      blame: thin,
    };
  }
  return { ok: true };
}

// ── The decoder ───────────────────────────────────────────────────────

const isObj = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);

/** Validate the oracle's reply against the graph it was asked about. Returns
 *  null on anything unexpected; the caller throws. No field is defaulted — a
 *  default turns an unchecked value into a checked-looking one. */
export function decode(u: unknown, g: Graph): Assignment | null {
  if (!isObj(u)) return null;

  if (u.tag === "Infeasible") {
    if (typeof u.reason !== "string") return null;
    return { tag: "Infeasible", reason: u.reason, blame: [] };
  }
  if (u.tag !== "Assigned") return null;
  if (typeof u.weight !== "number" || !Number.isFinite(u.weight)) return null;
  if (!Array.isArray(u.edges)) return null;

  const known = new Set<string>(g.edges.map((e) => `${e.u} ${e.v}`));
  const edges: { u: PersonId; v: PersonId; w: number }[] = [];
  for (const raw of u.edges) {
    if (!isObj(raw)) return null;
    const ui = raw.u, vi = raw.v, w = raw.w;
    if (typeof ui !== "number" || typeof vi !== "number" || typeof w !== "number") {
      return null;
    }
    const a = g.ids[ui], b = g.ids[vi];
    if (a === undefined || b === undefined) return null;
    // Every returned edge must be one we offered. A solver that invents an edge
    // has matched two people the graph said were not comparable.
    if (!known.has(`${a} ${b}`) && !known.has(`${b} ${a}`)) return null;
    edges.push({ u: a, v: b, w });
  }

  // 3n = 2|E|, restated as a count. Cheap, and it catches a truncated reply.
  if (edges.length * 2 !== g.ids.length * 3) return null;

  const triples = new Map<PersonId, PersonId[]>(g.ids.map((id) => [id, []]));
  for (const e of edges) {
    const a = triples.get(e.u), b = triples.get(e.v);
    if (a === undefined || b === undefined) return null;
    a.push(e.v);
    b.push(e.u);
  }
  for (const [id, ts] of triples) {
    // Exactly three, no duplicates, and nobody assigned to themselves.
    if (ts.length !== 3) return null;
    if (new Set(ts).size !== 3) return null;
    if (ts.includes(id)) return null;
  }
  // Mutuality (see brief §7), verified rather than assumed. It follows from the
  // edges being undirected, but the whole product rests on it and it is O(n).
  for (const [id, ts] of triples) {
    for (const t of ts) if (!triples.get(t)!.includes(id)) return null;
  }
  // The weight must be the weight of the edges returned, not a separate claim.
  const sum = edges.reduce((s, e) => s + e.w, 0);
  if (Math.abs(sum - u.weight) > 1e-6 * Math.max(1, Math.abs(sum))) return null;

  return { tag: "Assigned", weight: u.weight, triples, edges };
}

// ── Calling the oracle ────────────────────────────────────────────────

/** Run `assign.py` over the graph. The boundary is a pipe, and the reply is
 *  validated exactly as a leaf validates a model. */
export async function assign(g: Graph): Promise<Assignment> {
  const pre = precheck(g);
  if (!pre.ok) return { tag: "Infeasible", reason: pre.reason, blame: pre.blame };

  const req = JSON.stringify({
    n: g.ids.length,
    edges: g.edges.map((e) => ({ u: g.index.get(e.u), v: g.index.get(e.v), w: e.w })),
  });

  const cmd = new Deno.Command("python3", {
    args: ["assign.py"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const w = child.stdin.getWriter();
  await w.write(new TextEncoder().encode(req));
  await w.close();
  const out = await child.output();
  if (!out.success) {
    throw new Error(
      `assign.py failed: ${new TextDecoder().decode(out.stderr).slice(-600)}`,
    );
  }

  const text = new TextDecoder().decode(out.stdout);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`assign.py: reply was not JSON: ${text.slice(0, 200)}`);
  }
  const result = decode(parsed, g);
  if (result === null) {
    throw new Error(`assign.py: reply did not validate: ${text.slice(0, 400)}`);
  }
  return result;
}
