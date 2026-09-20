# A dictionary — TypeScript ↔ Kelvingrove, with the note's words for both

*Robin Langer and Claude Opus 5, 16 September 2026.
Markdown translation of `../kg-notes/dictionary.pdf` (source: `../kg-notes/dictionary.tex`),
made for reading by an agent rather than a person. Content is unchanged; only the typography is.*

Two implementations of Neil Ghani's containers sit in `~/git/gold`: a family of Deno/TypeScript
programs, and the Julia package Kelvingrove. **They share no identifier.** This document is the
lookup table between them, with the specification's own vocabulary as the third column.

It is a dictionary and not an argument. `container-formalisms.pdf` argues where the two diverge
and why; this one only says what is called what. Where a row has no entry on one side that is
recorded as **—** rather than approximated, because a dictionary that invents a translation is
worse than one that admits a gap.

**Every row was checked by running both sides.** See "How the rows were checked" at the end —
and read it, because three of its findings contradict what the sources suggest.

---

## 1. The three sources

The specification is three PDFs, all in `from-neil/`.

| File | Short name here | What it fixes |
|---|---|---|
| `programming-with-containers.pdf` | *the note* | containers, morphisms, the four combinators |
| `do-it-kodamai-style.pdf` | *Kodamai Style* | why a typed interface is the trustworthy one |
| `workers-state-via-tensor.pdf` | *Workers* | state, as a tensor with ΔS |

*Workers* is Note 3 in the series, from MacBeth, 15 September 2026. It is cited for §7 (State)
only, which is the one section whose left-hand column is empty throughout.

The two implementations:

| | TypeScript | Kelvingrove |
|---|---|---|
| where | `stalin/` and five siblings | `kalvingrove/` (`kodamai/substrate`) |
| the algebra | `lib/algebra.ts`, 300 lines | `src/Itf/Syntax/`, 69 files |
| checked by | `tsc`, at compile time | `@typecheck`, when a value arrives |

`lib/algebra.ts` is vendored **byte-identical** (11,520 bytes) into `tower`, `stalin`, `firm`,
`federation`, `voting` and `dungeon`. Everything in the left-hand column outside `lib/` is
`stalin`'s, and is flagged as such.

---

## 2. The object: a container

*Kodamai Style* gives the definition this dictionary is indexed on:

> A container is a pair (P : Type, R : P → Type) — a type P of prompts, together with a family R
> assigning to each prompt p : P the type R p of permitted responses.

| the note | TypeScript | Kelvingrove |
|---|---|---|
| container (P,R) | `Cont` = `Fib<unknown,unknown>` | `Itf`, `AbstractItf` |
| a single fibre | `Fib<S,P>` | — (no separate type) |
| the prompt type P | `Shape<C>` | `prompt_type(itf)` |
| the lookup R p | `PosAt<C,S>` | `itf[p]` |
| non-dependent (P,R) | any `Fib<S,P>` with `P` constant | `MonomialItf(P,R)` |
| prompt / shape | *shape* | *prompt* |
| response / position | *position* | *response* |
| (p:P) → R p | `Runner<C>.run` | `ResponderLens` |

⚠ The two encodings of the dependency differ **in kind** — this is the one place where reading
across the table is not enough.

**TypeScript presents a container as its graph.** `lib/algebra.ts` opens by observing that Σ over
an *arbitrary* index is unavailable, but over a finite one

    Σ (s : S). B s  =  ⋃_{s ∈ S} {s} × B s

and a conditional type distributes over a union. So a container is the union of its fibres, and
`PosAt<C,S>` recovers R by asking which fibre `S` lies in. Every container in these programs has a
tagged union of shapes, so the index really is finite.

**Kelvingrove reifies the universe.** `KType` is a Julia *value* standing for a type, so
R : P → Type is an ordinary function `KFunc` whose codomain is the `KType` of `KType`s
(`src/Itf/Syntax/1Cat/Itf.jl`):

```julia
@auto_hash_equals fields=(P,R) struct Itf <: AbstractItf
    P::AbstractKType
    R::AbstractKFunc        # P -> KType
end
getindex(c::Itf, p) = c.R(p)
```

No finiteness is needed, and `itf[p]` **is** the dependent lookup. The price: `p ∈ prompt_type(c)`
is a predicate evaluated when the prompt arrives.

---

## 3. The morphism, and the one row that matters most

The note writes a morphism (P,R) → (Q,T) as a pair

    u : P → Q,     f : (p : P) → T(u p) → R p

Control flows down through u; data flows back up through f.

| the note | TypeScript (`stalin/morphisms.ts`) | Kelvingrove |
|---|---|---|
| morphism (u,f) | `Morph<C,D>` | `Lens`, `AbstractLens` |
| the pair, applied | `.delegate(shape, k)` | `as_kfunc(m)(p)` |
| u, the delegate leg | the `j` passed to `k` | `fwd(m)` |
| f, the amalgamate leg | the `back` passed to `k` | `bwd(m)` |
| identity | `idM` | `IdLens` |
| composition | `composeM` | `ComposeLens`, `∘` |
| hom-set | — | `poly_hom(I,J)` |
| supply an implementation | `drive(m, below)` | `evoke`, `step!` |

### The same representation, reached by two different routes

`morphisms.ts` declares

```typescript
delegate<S, Z>(
  shape: S,
  k: <SD extends Shape<D>>(j: SD, back: (reply: PosAt<D,SD>) => PosAt<C,S>) => Z,
): Z;
```

and its header says why: the pair (u s, f s) has type Σ (j : Q). (T j → P s), in which the first
component is chosen by the implementation and appears in the type of the second. That is an
existential, TypeScript has none, and an existential is Church-encodable as

    ∃j. F j  ≅  ∀Z. (∀j. F j → Z) → Z

So `j` never becomes a type; it becomes a **scope**.

Kelvingrove's ADR 0001 decides that a lens stores one thing:

    as_kfunc(m) :: prompt ↦ (prompt′, response_translator)

— the same Σ, returned directly rather than passed to a continuation. The ADR's reasons are
entirely unrelated to existentials: it argues against a split `(fwd::KFunc, bwd::IFunc)` pair whose
two entry points shared nothing but a memoisation cache, and which therefore froze effects,
serialised parallel legs, and let a type-membership check execute the program.

Both arrive at the same composition law:

| `morphisms.ts` | ADR 0001 |
|---|---|
| `m.delegate(shape, (jd, backCD) =>`<br>`  n.delegate(jd, (je, backDE) =>`<br>`    k(je, reply => backCD(backDE(reply)))))` | `as_kfunc(g ∘ f)(p) =`<br>`  let (q, back_f) = as_kfunc(f)(p),`<br>`      (c, back_g) = as_kfunc(g)(q)`<br>`  (c, back_f ∘ back_g)` |

`backCD(backDE(reply))` **is** `back_f ∘ back_g`. In both, each child runs exactly once, and the
backward map sees the forward run's intermediates by lexical scope rather than by lookup. The ADR
states the property as "runtime state attached to *runs*, not to *descriptions*"; `morphisms.ts`
gets it for free, because a continuation has no other way to work.

**Practical consequence, for porting.** A `Morph` is a value even when nothing implements its
codomain; a `Runner` cannot be, since it holds the answers. Same distinction as `poly_hom(I,J)`
versus a `ResponderLens` — and it is why a lens can be sent over a wire.

### Answering is delegating to nobody

| the note | TypeScript | Kelvingrove |
|---|---|---|
| handler into (1,1) | `Runner<C>` | `ResponderLens` (m : I → `Id`) |
| that reading, as a map | `asMorph` / `asRunner` | the `cod(m) == Id` case |
| drive it | `drive(m, idRunner)` | `evoke(m, p)` |
| leaf on a port | `leaf(label, port, decoders)` | `RemoteItf`, `ZMQ.jl` |

`asMorph` and `asRunner` are inverse, which makes `Runner<C>` = Cont(C,(1,1)) an isomorphism rather
than a reading. `evoke` requires `cod(m) == Id` and errors otherwise.

---

## 4. The four combinators

All three artefacts implement the same four, and the naming is unrelated in each.

| the note | TypeScript | Kelvingrove | prompts | responses |
|---|---|---|---|---|
| sum `+` | `SumC`, `sumC` | `BranchItf`, `branch`, `+` | disjoint union | keep own |
| product `×` | `ProductC`, `productC` | `PickItf`, `pick`, `×` | product | sum |
| tensor `⊠` | `TensorC`, `tensorC` | `ParallelItf`, `parallel`, `⊗` | product | product |
| sequencing `◁` | `SeqC`, `seqC` | `SeqItf`, `seq`, `◁` | Σ(p:P). R p → P′ | Σ(r:R p). R′(v r) |

**Two traps, both easy and both expensive.**

⚠ **`×` is not the tensor.** `pick`/`×` is the categorical product: both sides offered, exactly
*one* answered. `parallel`/`⊗` is the tensor: both prompted, *both* replies owed. `prod` is a
deprecated alias for `pick`. Kelvingrove states it in two adjacent lines:

```julia
getindex(t::ParallelItf, p) = ProdKType(getindex.(t.children, p))   # answer both
getindex(pi::PickItf, p)    = BranchKType(...)                      # answer one
```

⚠ **The tensor's `Promise.all` is concurrency and only concurrency.** What defines the tensor is
that both shapes are supplied up front and both replies are owed, enforced by the shape type
`{left, right}`. You cannot make the right prompt depend on the left reply, because you had to
build it first.

### The morphism halves

| action on arrows | TypeScript | Kelvingrove |
|---|---|---|
| ⊗ on morphisms | `tensorM` (`stalin/`) | `ParallelLens`, `ParallelWrkr` |
| + on morphisms | — | `BranchLens`, `CotupleLens`, `InjLens` |
| × on morphisms | — | `PickLens`, `TupleLens`, `ProjLens` |
| ◁ on morphisms | — | `SeqLens`, `SimpleSeqLens` |

`tensorM` is the hard one: both codomain shapes must be in hand *before* either is fired, so there
is no way to split a `Runner<B ⊠ D>` into a `Runner<B>` and a `Runner<D>`. Nesting the two
continuations solves it — in the inner scope both `jb` and `jd` are bound. That is the function for
which the existential had to be reachable at all.

In Kelvingrove each combinator has three sibling files — `<Op>Itf.jl`, `<Op>Lens.jl`,
`<Op>Wrkr.jl`, plus `<Op>Morph.jl` for code generic in the statefulness flag. That is why
`src/Itf/Syntax/` has 69 files for four operations.

### Nesting, and where `seqC` is not `SeqItf`

| | TypeScript | Kelvingrove |
|---|---|---|
| arity | binary | n-ary |
| (A ⋆ B) ⋆ C vs A ⋆ B ⋆ C | — | **distinct** for `+`, `×`, `⊗` |
| ◁ | binary | flattens automatically |

The dependency in `◁` is the one place the two encodings genuinely differ **in power**. `SeqC`'s
`next: (r: PA) => SB` lands in a *single fibre*: a continuation branching between shapes of `d` has
a union return type, lies in no single fibre, and cannot be written. `lib/algebra.ts` states this
rather than hiding it. `SeqItf` has the unrestricted Σ:

```julia
E = KFunc(B, KType{AbstractKType}(), x -> d[f(x)], ...)
KTypes.SigmaKType(Itf(B, E); flatten=false)
```

`stalin/branch.ts` is the repair on the TypeScript side, and it is a distinct entry:

| what it is | TypeScript | Kelvingrove |
|---|---|---|
| a ◁ (b+c), undistributed | `SeqBranchC`, `seqBranchC` | `seq(a, branch(b,c))` directly |
| all positions, as a union | `Positions<C>` | — (not needed) |

`seqC(a, sumC(b,c))` silently computes (a ◁ b) + (a ◁ c) — *decide, then ask* — because every
combinator is a conditional type and distributing is the only thing a conditional type knows how to
do. Routing needs a ◁ (b+c): *ask, then decide.* `branch.ts` builds the second and pays for it in
the position, which widens to `Positions<B>`. In Kelvingrove no rewrite happens and nothing needs
repair; it was checked directly that `seq(a, branch(b,c)) ≠ branch(seq(a,b), seq(a,c))`.

---

## 5. The units: three interfaces that all look like "does nothing"

| pair | TypeScript | Kelvingrove | unit for |
|---|---|---|---|
| (1,1) | `IdC`, `idRunner` | `IdItf`, `Id` | ⊗ and ◁ |
| (1,0) | — | `UnitItf`, `Unit` | × |
| (0,0) | — | `ZeroItf`, `Zero` | + |

`morphisms.ts` names all three in prose and constructs only the first, with the reason: "(1,1) is
the unit for the tensor and for sequencing; (1,0) — one prompt, NO valid response — is the unit for
the product, and a morphism into that one is not an answerer but the unique map to a terminal
object." `morphism-confusion.pdf` is the long form.

⚠ **The unit laws are arrows, not equalities.** In Kelvingrove none of the four holds on the nose —
`parallel(a, Id) ≠ a` — and each is witnessed by an explicit map:

| arrow | boundary |
|---|---|
| `Id_elim(1, a)` | (a ⊗ Id) → a |
| `id_elim(1, a)` | (a ◁ Id) → a |
| `Unit_elim(1, a)` | (a × Unit) → a |
| `ZeroElimLens(branch(a, Zero))` | (a + Zero) → a |

Capitalisation is not uniform: `Id_intro`/`Id_elim` are the ⊗ pair, `id_intro`/`id_elim` the ◁
pair. In each constructor the varargs are the **codomain** children and the unit is inserted after
index `i`; so the identity-absorbing arrow on a single interface is `Id_elim(1, a)`, not
`Id_elim(a)`.

---

## 6. Coherence: laws need arrows to live in

| what | TypeScript | Kelvingrove |
|---|---|---|
| associator, ⊗ | `assocTensor` (`stalin/`) | `associator`, `LinAssocLens` |
| associator, + | — | `branch_associator`, `BranchAssocLens` |
| associator, × | — | `pick_associator`, `PickAssocLens` |
| symmetry | — | `swap`, `swap_branch`, `swap_prod`, `swap_parallel` |
| left distributor | — | `ldistrib`, `LDistribLens` |
| duoidal interchange | — | `duoidor`, `binary_duoidor` |
| ⊗ → ◁ | — | `sequensor` |
| reindexing along a `KFunc` | — | `Δ`, `DeltaItf` |

Verified boundaries for the three that appear in no version of the note:

    ldistrib(a,b,c)         : (a ⊗ (b + c)) → ((a ⊗ b) + (a ⊗ c))
    binary_duoidor(a,b,c,d) : ((a ◁ b) ⊗ (c ◁ d)) → ((a ⊗ c) ◁ (b ⊗ d))
    sequensor(a,b)          : (a ⊗ b) → (a ◁ b)

That (Cont, ⊗, ◁) is duoidal is the structural fact behind an operational one: **a parallel plan
can always be serialised, and a serial plan cannot always be parallelised.** The interchange map
goes one way only, and there is no constructor for the reverse.

There is deliberately **no** distributor for ◁ over +, because none exists. On the TypeScript side
the invalid distribution is not forbidden; it is *performed*, because a conditional type distributes
unconditionally. That is what `branch.ts` exists to repair, and it is a soundness difference rather
than an ergonomic one.

---

## 7. State

This is the section whose left-hand column is empty.

| *Workers* | TypeScript | Kelvingrove |
|---|---|---|
| stateful morphism | — | `Wrkr`, `AbstractWrkr` |
| state container ΔS = S ▷ (λ_.S) | — | `Itf(S,S)`, i.e. `MonomialItf(S,S)` |
| the domain A ⊗ X | — | `parallel(Itf(S,S), D)` |
| description vs. instance | — | `instantiate!(w)` |
| the state cell | — | `WrkrState`: `LocalState`, `FileState`, `SQLiteState` |

*Workers* derives what Kelvingrove implements. Taking A = ΔS and the tensor,

    A ⊗ X  =  (S × X₀) ▷ (λ(s,x₀). S × X₁ x₀)

so a morphism A ⊗ X → Y is exactly a pair

    fwd : S × X₀ → Y₀
    bwd : Π_{(s,x₀)} (Y₁(fwd(s,x₀)) → S × X₁ x₀)

The backward map splits, by the universal property of the product in the position, into a state
**writeback** component (S) and an ordinary input back-map (X₁). That split is why the *tensor* and
not composition is the right home for state.

⚠ The caveat, because a dictionary is exactly what gets misused to flatten it: **⊗ ≠ ◁.**
ΔS ⊗ ΔT = Δ(S × T), states multiplying, whereas ΔS ◁ ΔT is store-of-store. The clean writeback
split is specifically a tensor phenomenon.

**What the TypeScript does instead.** Its servers are stateful anyway, being processes, so
`stalin/containers.ts` grows a `Reset` fibre in every commissariat — the interface is extended with
a prompt whose job is to clear what the process is holding. Without it, `stalin new` resets only
the Plan's own ledger while the commissariats carry their weather stream and their books into the
next game, "so two games on one server are not comparable".

Kelvingrove extends the domain by ⊗ ΔS so the state was never hidden; the TypeScript extends P so
that what is hidden can at least be cleared. The two fixes fall on either side of one line, and the
second can only ever be as complete as its author's list of things to reset.

⚠ **Note for readers coming from the file names: `stalin/state.ts` is NOT a counterpart to `Wrkr`.**
It is the game's domain — grain, steel, harvest grades, the war outcome — and the reason it is
discretised into finite unions is the Σ-over-a-finite-index restriction of §4, not anything to do
with worker state.

---

## 8. Things with no counterpart in either direction

**Only in TypeScript**

| | |
|---|---|
| `lib/delegate.ts` | the delegate leg as a *process*: a CLI hop, not a function call |
| `lib/wire.ts` | `serveContainer`, the depth header, the trace |
| `Decoders<C>` | per-shape validators returning `| null` at every leaf |
| `branch.ts` | the undistributed ◁ over + |

**Only in Kelvingrove**

| | |
|---|---|
| `KType`, `KFunc` | the reified universe; `SigmaKType`, `PiKType`, `ExpKType` |
| `ext(J,X)` | Σ_j exp(J[j],X); the functor applied to an object |
| `HomItf`, `poly_hom` | the Poly hom formula, Π_i Σ_j exp(J[j],I[i]) |
| `LensKFunc` | the execution primitive of ADR 0001 |
| `Wrkr` and §7 | state |
| `ZMQ.jl` | 56 KB realising a remote step as an optic |
| `Duoidor`, `Sequensor`, `ldistrib` | the interaction between the structures |

One **shared absence** bounds what either can be asked to do. Poly's ⊗-closure [I,J] is itself a
polynomial, with directions as well as positions. `PiKType(HomItf(I,J))` recovers only its position
set, [I,J](1), and `Fib.jl` says in as many words that nothing in Kelvingrove constructs the
directions. The TypeScript does not have them either. **The note's Appendix A leans on both internal
homs, so the forward-looking half of the specification rests on the piece neither implementation has
built.**

---

## 9. Convergent discovery: a decoder at every leaf

Both implementations independently put a runtime validator at every leaf.
`leaf(label, port, decoders)` throws `"reply did not validate"`; Kelvingrove checks `KType`
membership on arrival, gated by `@typecheck`.

*Kodamai Style* raises the point only for the language model — a raw LLM has type `String -> String`,
so presenting it as (s:S) → P s is a promise made good by a typed wrapper. Both codebases found that
the caveat is **not about language models**. Type discipline stops at the edge of the process; every
leaf beyond it is an oracle, whether the far end is a transformer or a hand-written arithmetic
server.

---

## 10. How the rows were checked

Julia was installed on Robin's machine on 16 September 2026 specifically so this document would not
have to be written from the sources alone. Kelvingrove was loaded on **Julia 1.12.7** — the version
CI runs; `Project.toml`'s `julia = "1.6.7"` is *not* the number to trust — and every Kelvingrove
claim above was evaluated. The TypeScript side was checked with `deno check *.ts lib/*.ts` and
`deno test`, both clean.

Three results were **not** what reading the sources had suggested. Each would otherwise be a wrong
row, and each will bite an agent writing code here:

1. **The unit laws fail on the nose.** `parallel(a, Id) == a` is `false`, as are the other three.
   They hold only up to the intro/elim arrows of §5.

2. **`◁` is a comparison operator in Julia.** `Base.operator_precedence(:◁)` is 7 — the same as `==`
   — with associativity `none`. So `a ◁ b ◁ c` parses as a **chained comparison** and lowers to
   `(a ◁ b) && (b ◁ c)`, raising `TypeError: non-boolean (SeqItf) used in boolean context`. The
   n-ary sequencing this algebra is built around **cannot be written infix at all**; use
   `seq(a, b, c)`. The tree records this in exactly one place, a comment on
   `test/unit/itf/test_Interfaces.jl:1308`.

3. **Infix `+` and infix `⊗` do not agree about arity.** Julia parses `a + b + c` as a single
   variadic call, so it builds the flat 3-ary `BranchItf` and `(a + b + c) == branch(a,b,c)` is
   `true`. It parses `a ⊗ b ⊗ c` as left-associated binary, so `(a ⊗ b ⊗ c) == parallel(a,b,c)` is
   `false` and the flat 3-ary `ParallelItf` is unreachable through the operator. Two spellings that
   look alike on the page build different interfaces, and `Parallel/Assoc.jl` is the arrow between
   them.

Positive checks, all `true`: `prompt_type(a ◁ b) == ext(a, prompt_type(b))`; the four unit arrows'
codomains; `associator`, `ldistrib`, `binary_duoidor` and `sequensor` boundaries as printed in §6;
and `seq(a,branch(b,c)) ≠ branch(seq(a,b),seq(a,c))`.

---

*Sources: `from-neil/programming-with-containers.pdf`, `from-neil/do-it-kodamai-style.pdf`,
`from-neil/workers-state-via-tensor.pdf`; `stalin/lib/algebra.ts`, `stalin/morphisms.ts`,
`stalin/branch.ts`, `stalin/state.ts`, `stalin/containers.ts`; `kalvingrove/src/`,
`kalvingrove/docs/adr/0001-lens-kfunc-is-the-execution-primitive.md`, at `kodamai/substrate@0346a3a7`.
Companion notes: `../kg-notes/container-formalisms.pdf` (where they diverge),
`../kg-notes/first-class-morphisms.pdf` (how `morphisms.ts` was built),
`../kg-notes/morphism-confusion.pdf` (the three units).*
