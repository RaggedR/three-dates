# LESSONS

Rules for the next instance working in this repo. Written after corrections, as rules
rather than as accounts of what happened.

## 1. Do not editorialise in favour of an edit you were told to make

Robin asked for a paragraph to be deleted from `design.tex`. I deleted it and then
wrote a paragraph explaining why the deletion improved the document, citing
`gold/voting/design.tex` as precedent. Two turns later: *"actually, don't. And put
back the thing I asked you to delete."*

**The rule: if you have a view about an edit, state it once, before, and then do what
you are told. If you have no view, just do it.** An argument produced *after* an
instruction is neither advice (too late to act on) nor obedience (decorated). The
tell that it was not a real view: I produced arguments in both directions inside four
minutes and held neither.

## 2. His prose goes out unaltered

The email to Prof. Ghani of 21 Sep 2026 was dictated verbatim, sentence fragments and
all (*"If they also choose you. It's a match."*). It went unedited and that was
correct. It is his voice, to his boss, about IP. Tidying it would be a category error
about what the document is for. **Draft what he dictates; never improve it.**

## 3. Never record an unsent email as sent

`~/paper-trail/background-ip/` is an evidentiary archive and every other file in it is
a message that actually went out. When asked to file this one before it had been sent,
the entry was marked `Status: DRAFT — NOT YET SENT` with the `pa` draft id, and updated
to `SENT` with the Gmail message id afterwards. **A paper trail that contains one false
record is not a paper trail.** The same rule governs this repo's README: no measurement
quoted that has not been run.

## 4. Write the phase list before believing the spec

`DESIGN.md` and `design.pdf` both quote §5 and §7 of the brief approvingly, and those
two sections cannot both hold — together they demand the pool graph itself become
3-regular. Neither document saw it, because a document is organised by concept and may
put the two constraints on different pages. The build order caught it in ten minutes,
because a phase list must name an actor and an order for every step and "solve it by
wishing" is a step nobody can write. See `PLAN-build.md` §1.2.

## 5. `seqC` is wrong for the narrowing loop, and it fails silently

`a ◁ (b + c)` — *ask, then decide* — is what §4 of the brief requires. `seqC` computes
`(a ◁ b) + (a ◁ c)` — *decide, then ask* — because `(P → −)` is a right adjoint and does
not preserve coproducts. For this product that inverts the central claim. Use
`seqBranchC`, copied verbatim from `/Users/robin/git/gold/stalin/branch.ts`, and keep it
at the top level: `lib/` records exactly one divergence from upstream and this is not
it.

## 6. Do not "fix" the vendored duplication

`lib/` is byte-identical across `tower`, `stalin`, `firm`, `federation`, `voting` and
`dungeon` (md5 `2237f8d621764caca85840698812f03a`). The repetition is deliberate and is
the test of whether it is a library. Do not deduplicate it, and do not rename the stray
`STALIN_INPROC` env var in `wire.ts` — a rename is the beginning of a fork.

## 7. A `@ts-expect-error` is only a test if you have seen it fail

`type-tests.ts` passing proves the *positive* direction. It proves the negative
direction only if removing a `@ts-expect-error` makes `deno check` fail — otherwise
the line is a comment above code that happens to compile, and the suite is asserting
nothing in the direction that matters. **Mutate one and watch it go red before
recording the measurement.** Phase 1 did this; the count (9 illegal-direction, 20
legal-direction) is quoted in the README only because of it.

## 8. A density knob expressed as a fraction hides the density problem

The first `fixtures.ts` gave each person a fixed *fraction* of the corpus. Because
the corpus grows one question per arrival (§3), that makes a person in a cohort of
a thousand answer two hundred and fifty questions, and the shared-question count
per pair then *rises* with the market. The measurement came back at 99% and looked
like good news.

Attention is bounded and the corpus is not. **Express per-person effort as an
absolute budget, not a share of a growing total**, and any quantity that should
degrade with scale will then actually degrade. Under a fixed budget of 40 the same
number falls 96.7% → 18.2% between n=50 and n=2000. The rule generalises: when a
fixture parameter is a ratio between two things that grow at different rates,
holding the ratio fixed is a modelling decision, and usually the flattering one.
