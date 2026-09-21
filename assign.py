#!/usr/bin/env python3
"""assign.py — maximum-weight 3-factor, by Tutte reduction to perfect matching.

This is the hardest engineering problem in the product (§7 of the brief) and it
is a solved problem in graph theory, which is why it is in Python beside the
TypeScript rather than in it. `networkx.max_weight_matching` is Edmonds' blossom
algorithm, exact, and reimplementing it would be a fortnight spent on the least
novel part of the system. Precedent: stalin/optimise.py, federation/nerve-
cohomology.py, dungeon/mkrooms.py.

THE REDUCTION, explicitly, because getting it wrong is silent.

For each vertex v of the compatibility graph G with degree d(v) and quota b(v):

  - create d(v) EXTERNAL vertices, one per incident edge;
  - create d(v) - b(v) INTERNAL vertices;
  - join every internal of v to every external of v, weight 0;
  - map each original edge {u,v} to an edge between the two corresponding
    externals, carrying the compatibility weight.

Then perfect matchings of the gadget H correspond exactly to b-factors of G, and
a MAXIMUM-WEIGHT perfect matching corresponds to a maximum-weight b-factor. The
argument in one line: in any perfect matching, the d(v) externals of v are each
matched either along their original edge or to one of the d(v)-b(v) internals;
the internals must all be matched, and only to externals of v; so exactly
d(v)-b(v) externals are used up internally and exactly b(v) go out.

The quota is b(v) = 3 everywhere in the product. It is a per-vertex parameter
here for one reason: PINNING. A person who is mid-meeting has some of their
three already fixed, and the next tick must solve around them. Pre-committing an
edge {u,v} is exactly decrementing b(u) and b(v) and deleting the edge, so the
cost of cadence — PLAN-build Phase 3, question 3 — is measurable with no second
algorithm. A vertex whose quota reaches 0 leaves the problem entirely.

Preconditions, all checked and all REPORTED rather than raised:

  - sum of b(v) even. For the uniform case this is 3n = 2|E| and so n even (see
    PLAN-build §1.4); pinning makes the general statement the operative one.
  - d(v) >= b(v) for every v. A vertex with two neighbours cannot have three.

Neither is sufficient: assign-test.py carries a 6-vertex graph with minimum
degree 3 and no 3-factor at all.

Weights are shifted positive before matching. networkx's max_weight_matching
with maxcardinality=True maximises cardinality first and weight second, so a
negative weight cannot buy a smaller matching — but a shift makes the objective
read the way the docstring claims it does, and costs one subtraction to undo.

I/O is a file, in and out, because assign.ts validates what comes back exactly
as a leaf validates an oracle — which is what it is.
"""

import json
import sys
from itertools import combinations

import networkx as nx


def build_gadget(n, edges, quota):
    """G on vertices 0..n-1 with weighted `edges` -> (H, ext, incident).

    `edges` is a list of (u, v, w); `quota` maps vertex -> b(v). Returns the
    gadget and a dict mapping each original edge to the pair of gadget vertices
    representing it, so a matching can be read back without re-deriving the
    naming scheme.
    """
    incident = {v: [] for v in range(n)}
    for i, (u, v, _) in enumerate(edges):
        incident[u].append(i)
        incident[v].append(i)

    H = nx.Graph()
    ext = {}  # (vertex, edge index) -> gadget node
    for v in range(n):
        b = quota[v]
        if b == 0:
            continue  # fully pinned: out of the problem
        d = len(incident[v])
        if d < b:
            raise ValueError(
                f"vertex {v} has degree {d} < quota {b}; no b-factor exists"
            )
        for i in incident[v]:
            ext[(v, i)] = ("e", v, i)
            H.add_node(("e", v, i))
        for k in range(d - b):
            H.add_node(("i", v, k))
        # Every internal joined to every external, weight 0. These are the
        # d(v)-b(v) edges that get "used up" and are what forces degree b(v).
        for k in range(d - b):
            for i in incident[v]:
                H.add_edge(("i", v, k), ("e", v, i), weight=0.0)

    return H, ext, incident


def b_factor(n, edges, quota, excluded=()):
    if sum(quota.values()) % 2 != 0:
        raise ValueError(
            f"sum of quotas is {sum(quota.values())}, which is odd; "
            "no b-factor exists (see PLAN-build §1.4)"
        )

    # A vertex with quota 0 is out, and so is every edge touching it. So is
    # every PINNED edge: it is already committed, and leaving it in play lets
    # the solver select it a second time — counting its weight twice and
    # overshooting the quota. The degree assertion below does not catch that,
    # because it runs before the pinned edges are added back.
    excluded = set(excluded)
    live = [
        i for i, (u, v, _) in enumerate(edges)
        if quota[u] > 0 and quota[v] > 0 and i not in excluded
    ]
    sub = [edges[i] for i in live]

    H, ext, _ = build_gadget(n, sub, quota)

    ws = [w for (_, _, w) in sub]
    shift = 0.0 if not ws else max(0.0, -min(ws)) + 1.0
    for i, (u, v, w) in enumerate(sub):
        H.add_edge(ext[(u, i)], ext[(v, i)], weight=w + shift)

    if H.number_of_nodes() % 2 != 0:
        raise AssertionError(
            f"gadget has {H.number_of_nodes()} nodes, which is odd; "
            "sum of d(v) + (d(v)-b(v)) is even iff sum of b(v) is"
        )

    M = nx.max_weight_matching(H, maxcardinality=True)

    matched = set()
    for a, b in M:
        matched.add(a)
        matched.add(b)
    if len(matched) != H.number_of_nodes():
        return None, 0.0

    chosen = []
    total = 0.0
    for i, (u, v, w) in enumerate(sub):
        a, b = ext[(u, i)], ext[(v, i)]
        if (a, b) in M or (b, a) in M:
            chosen.append(live[i])
            total += w

    # The reduction's guarantee, verified rather than trusted. If this fires,
    # the gadget is wrong and every number downstream is wrong with it.
    deg = {v: 0 for v in range(n)}
    for i in chosen:
        u, v, _ = edges[i]
        deg[u] += 1
        deg[v] += 1
    bad = {v: (deg[v], quota[v]) for v in range(n) if deg[v] != quota[v]}
    if bad:
        raise AssertionError(f"reduction missed its quotas (got, wanted): {bad}")

    return chosen, total


def main():
    req = json.load(sys.stdin)
    n = req["n"]
    edges = [(e["u"], e["v"], float(e["w"])) for e in req["edges"]]
    # Edges pre-committed for this tick, as indices into `edges`. Each one
    # decrements the quota of both its endpoints and is removed from play; its
    # weight is still counted, because the pair really is matched.
    pinned = req.get("pinned", [])

    quota = {v: 3 for v in range(n)}
    pinned_weight = 0.0
    pinned_pairs = []
    for i in pinned:
        u, v, w = edges[i]
        quota[u] -= 1
        quota[v] -= 1
        pinned_weight += w
        pinned_pairs.append(i)
    neg = {v: q for v, q in quota.items() if q < 0}
    if neg:
        json.dump({"tag": "Infeasible",
                   "reason": f"pinning gives these people more than three: {neg}"},
                  sys.stdout)
        return

    try:
        chosen, total = b_factor(n, edges, quota, pinned_pairs)
    except ValueError as exc:
        # A precondition failure is a REPORTED outcome, decodable by assign.ts,
        # not a crash. Parity and low degree are facts about the cohort.
        json.dump({"tag": "Infeasible", "reason": str(exc)}, sys.stdout)
        return

    if chosen is None:
        json.dump(
            {"tag": "Infeasible", "reason": "no perfect matching of the gadget; "
                                            "G admits no 3-factor"},
            sys.stdout,
        )
        return

    chosen = chosen + pinned_pairs
    total += pinned_weight

    triples = {v: [] for v in range(n)}
    for i in chosen:
        u, v, _ = edges[i]
        triples[u].append(v)
        triples[v].append(u)

    json.dump(
        {
            "tag": "Assigned",
            "weight": total,
            "edges": [{"u": edges[i][0], "v": edges[i][1], "w": edges[i][2]} for i in chosen],
            "triples": {str(v): sorted(ts) for v, ts in triples.items()},
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
