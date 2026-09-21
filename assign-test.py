#!/usr/bin/env python3
"""assign-test.py — the Tutte reduction, against brute force.

A gadget that returns *a* 3-factor looks exactly like a gadget that returns the
*maximum-weight* one, and the difference is invisible in every downstream number
it feeds. So it is checked by exhaustive enumeration on graphs small enough to
enumerate: all C(|E|, 3n/2) edge subsets, filtered to the 3-regular ones.

Run: python3 assign-test.py
"""

import json
import random
import subprocess
import sys
from itertools import combinations


def run(n, edges, pinned=None):
    req = {"n": n, "edges": [{"u": u, "v": v, "w": w} for u, v, w in edges]}
    if pinned:
        req["pinned"] = list(pinned)
    r = subprocess.run(
        [sys.executable, "assign.py"],
        input=json.dumps(req),
        capture_output=True, text=True,
    )
    if r.returncode:
        raise SystemExit(r.stderr[-2000:])
    return json.loads(r.stdout)


def brute(n, edges, pinned=()):
    """Max-weight 3-factor by enumeration, optionally forced to contain `pinned`."""
    best = None
    pinned = set(pinned)
    for sub in combinations(range(len(edges)), 3 * n // 2):
        if not pinned <= set(sub):
            continue
        deg = [0] * n
        for i in sub:
            u, v, _ = edges[i]
            deg[u] += 1
            deg[v] += 1
        if all(d == 3 for d in deg):
            w = sum(edges[i][2] for i in sub)
            if best is None or w > best:
                best = w
    return best


def main():
    random.seed(7)
    failed = 0
    trials = 0
    infeasible_seen = 0

    for n in (6, 8):
        for _ in range(8 if n == 6 else 4):
            alle = [(u, v) for u, v in combinations(range(n), 2)]
            while True:
                keep = [e for e in alle if random.random() < 0.8]
                deg = [0] * n
                for u, v in keep:
                    deg[u] += 1
                    deg[v] += 1
                if min(deg) >= 3:
                    break
            E = [(u, v, round(random.random(), 4)) for u, v in keep]

            got = run(n, E)
            exp = brute(n, E)
            g = got["weight"] if got["tag"] == "Assigned" else None
            if g is None:
                infeasible_seen += 1
            ok = (exp is None and g is None) or (
                exp is not None and g is not None and abs(exp - g) < 1e-9
            )
            trials += 1
            if not ok:
                failed += 1
            print(f"  {'ok  ' if ok else 'FAIL'}  n={n} |E|={len(E):2d} "
                  f"brute={exp} gadget={g}")

    # The two preconditions are reported outcomes, not crashes.
    odd = run(5, [(u, v, 1.0) for u, v in combinations(range(5), 2)])
    ok = odd["tag"] == "Infeasible" and "odd" in odd["reason"]
    print(f"  {'ok  ' if ok else 'FAIL'}  an odd cohort is Infeasible, decodably (§1.4)")
    failed += 0 if ok else 1
    trials += 1

    thin = run(4, [(0, 1, 1.0), (1, 2, 1.0), (2, 3, 1.0), (3, 0, 1.0)])
    ok = thin["tag"] == "Infeasible" and "degree" in thin["reason"]
    print(f"  {'ok  ' if ok else 'FAIL'}  a vertex of degree 2 is Infeasible, decodably")
    failed += 0 if ok else 1
    trials += 1

    # Min degree 3 everywhere and STILL no 3-factor. This is the case that
    # matters: the precondition d(v) >= 3 is necessary and not sufficient, so
    # "everyone has enough candidates" does not mean the assignment exists.
    # Found by exhaustive search at n=6; brute force confirms it is infeasible.
    hard = [(0, 1), (0, 2), (0, 5), (1, 2), (1, 5), (2, 3),
            (2, 4), (2, 5), (3, 4), (3, 5), (4, 5)]
    E = [(u, v, 1.0) for u, v in hard]
    got = run(6, E)
    assert brute(6, E) is None, "the hard case is supposed to be infeasible"
    ok = got["tag"] == "Infeasible" and "no 3-factor" in got["reason"]
    print(f"  {'ok  ' if ok else 'FAIL'}  min degree 3 everywhere and no 3-factor: "
          f"the gate is necessary, not sufficient")
    failed += 0 if ok else 1
    trials += 1

    # Pinning. The b-factor generalisation is what makes the cost of cadence
    # measurable, and a pin that is quietly dropped would make that cost read
    # as zero — the most flattering possible bug.
    alle = [(u, v) for u, v in combinations(range(6), 2)]
    E = [(u, v, round(random.random(), 4)) for u, v in alle]
    for pin in ([0], [0, 1], [0, 14]):
        got = run(6, E, pin)
        exp = brute(6, E, pin)
        g = got["weight"] if got["tag"] == "Assigned" else None
        held = got["tag"] == "Assigned" and all(
            any(e["u"] == E[i][0] and e["v"] == E[i][1] for e in got["edges"]) for i in pin
        )
        ok = g is not None and exp is not None and abs(exp - g) < 1e-9 and held
        print(f"  {'ok  ' if ok else 'FAIL'}  pinning {pin}: forced edges are in the "
              f"result and the rest is optimal  (brute={exp} gadget={g})")
        failed += 0 if ok else 1
        trials += 1

    # Pinning four edges at one vertex is over-quota and must be REPORTED.
    over = run(6, E, [0, 1, 2, 3])
    ok = over["tag"] == "Infeasible" and "more than three" in over["reason"]
    print(f"  {'ok  ' if ok else 'FAIL'}  over-pinning one person is Infeasible, decodably")
    failed += 0 if ok else 1
    trials += 1

    print(f"\n  {trials - failed}/{trials} ok"
          f"  ({infeasible_seen} of the {trials - 3} random graphs admitted no "
          f"3-factor; the hard case below is the constructed one)")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
