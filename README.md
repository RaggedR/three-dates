# three-dates

A dating application in which you are shown **three** candidates, must meet all
three, and must choose one.

Matching is done by a language model that interviews both sides over time, not by a
similarity score over a fixed feature vector. Its central operation is: *given the
current candidate set, compose the question whose answer would most reduce
uncertainty about which candidates remain.*

Each time you submit answers you are told how many potential matches you currently
have — a hundred, then sixty-seven, then twelve. You keep answering until it reaches
three. The count is permitted to rise.

Concept stage. Nothing is built.

**[DESIGN-BRIEF.md](DESIGN-BRIEF.md)** is the entry point and is written to be read
by whoever implements it.

---

## The container reading

**[design.pdf](design.pdf)** (source: `design.tex`, built with `tectonic`) is the
formal document — the claims, with their arguments. **[DESIGN.md](DESIGN.md)**
is the first structural pass over the brief using the
container algebra of Neil Ghani's *Containers for Typed Agentic AI*
(`from-neil/`), the sixth thing built on it after `tower`, `stalin`, `firm`,
`federation`, `voting` and `dungeon`.

```
AskC  =  Question ◁ Reply            a person is a Runner<AskC>
```

Sign-up is the dependent pair `Σ (q : Question). Reply q`, so reciprocity is the
type rather than a rule. The three are the product `×` — three offered, one
reply owed — and the safety carve-out is a **summand** beside it, never a fourth
position. `Blank` is a position because a partial map is not a morphism. The
counter is a worker `ΔS ⊗ −`, and nothing in a worker's type makes the number
fall.

Where it breaks: the mutual three-assignment is a **3-factor** of the
compatibility graph, which is a global object with cycles in it, and the four
combinators build trees.
