// type-tests.ts — checked, never run. Fails in both directions.
//
// `deno check type-tests.ts` is a test, not a lint, and it is one because of
// the `@ts-expect-error` lines. A legal reply that does not typecheck is a bug;
// an illegal reply that DOES typecheck is a worse one, because it is the bug
// that ships. Each assertion below is one of those two directions. If a
// `@ts-expect-error` ever stops erroring, the check fails — so widening a type
// by accident is loud.

import type { Fib, PosAt, Shape } from "./lib/algebra.ts";
import type { Kind, Reply, ReplyFor } from "./questions.ts";

const expect = <T>(_: T) => {};

// ── 1. The reply depends on the question's kind ───────────────────────

expect<ReplyFor<{ tag: "Free" }>>({ tag: "Text", value: "in a shed, mostly" });
expect<ReplyFor<{ tag: "Scale"; lo: 1; hi: 5 }>>({ tag: "Rating", value: 4 });
expect<ReplyFor<{ tag: "Choice"; options: readonly ["yes", "no"] }>>(
  { tag: "Pick", option: "yes" },
);

// @ts-expect-error a free text question does not admit a rating.
const notFree: ReplyFor<{ tag: "Free" }> = { tag: "Rating", value: 4 };
expect<unknown>(notFree);

// @ts-expect-error a scale does not admit prose.
const notScale: ReplyFor<{ tag: "Scale"; lo: 1; hi: 5 }> = { tag: "Text", value: "4ish" };
expect<unknown>(notScale);

// @ts-expect-error a choice does not admit a rating.
const notChoice: ReplyFor<{ tag: "Choice"; options: readonly ["a"] }> = { tag: "Rating", value: 1 };
expect<unknown>(notChoice);

// ── 2. Blank is a position in EVERY fibre ─────────────────────────────
// Principle 3. This is the assertion that stops a later refactor from making
// the reply type total-looking by deleting the case it cannot handle.

expect<ReplyFor<{ tag: "Free" }>>({ tag: "Blank" });
expect<ReplyFor<{ tag: "Scale"; lo: 0; hi: 10 }>>({ tag: "Blank" });
expect<ReplyFor<{ tag: "Choice"; options: readonly ["a", "b"] }>>({ tag: "Blank", why: "none of these" });

// And `why` is optional: declining to explain a decline is itself an answer.
expect<ReplyFor<{ tag: "Scale"; lo: 0; hi: 10 }>>({ tag: "Blank", why: undefined });

// ── 3. The container. Positions depend on the shape. ──────────────────
// The shape of `AskC` carries the kind, so the fibre over a Scale question has
// ratings in it and the fibre over a Free question does not. This is the same
// trick voting/type-tests.ts plays with `visited` and `fuel`: what has to be
// checkable must be IN the prompt.

type AskC =
  | Fib<{ tag: "Ask"; id: string; kind: { tag: "Free" }; prompt: string }, ReplyFor<{ tag: "Free" }>>
  | Fib<{ tag: "Ask"; id: string; kind: { tag: "Scale"; lo: number; hi: number }; prompt: string }, ReplyFor<{ tag: "Scale"; lo: number; hi: number }>>
  | Fib<{ tag: "Disclose"; id: string }, { answered: number; blank: number; authored: number }>;

type FreeAsk = { tag: "Ask"; id: string; kind: { tag: "Free" }; prompt: string };
expect<PosAt<AskC, FreeAsk>>({ tag: "Text", value: "yes" });
expect<PosAt<AskC, FreeAsk>>({ tag: "Blank" });

// @ts-expect-error a rating is not in the fibre over a Free question.
const wrongFibre: PosAt<AskC, FreeAsk> = { tag: "Rating", value: 3 };
expect<unknown>(wrongFibre);

// @ts-expect-error a reply is not an answer to Disclose. The lookup is by
// shape, not a union over all positions.
const wrongShape: PosAt<AskC, { tag: "Disclose"; id: string }> = { tag: "Blank" };
expect<unknown>(wrongShape);

// The disclosure fibre is uniform: every person owes the same three numbers
// about themselves, and nobody owes more. See voters.ts `Disclosure` and
// design.pdf §11 — a fibre some participants lack breaks the constant family.
expect<PosAt<AskC, { tag: "Disclose"; id: string }>>({ answered: 12, blank: 3, authored: 1 });

// @ts-expect-error and nobody owes their actual answers as part of it.
const overshare: PosAt<AskC, { tag: "Disclose"; id: string }> = { answered: 12, blank: 3, authored: 1, replies: [] };
expect<unknown>(overshare);

expect<Shape<AskC>>({ tag: "Ask", id: "q1", kind: { tag: "Free" }, prompt: "why?" });

// ── 4. `legal` and `ReplyFor` must agree ──────────────────────────────
// The two halves of the dependency. Nothing checks this statically — `legal`
// takes a `Reply`, the untyped one, because that is its job — so the agreement
// is asserted at run time in check.ts. What IS checkable here is that the
// untyped `Reply` is strictly wider than every `ReplyFor`, which is the reason
// `legal` has to exist at all.
declare const r: ReplyFor<{ tag: "Scale"; lo: 1; hi: 5 }>;
expect<Reply>(r);

// @ts-expect-error ...and not the other way round. If this ever compiles, the
// run-time check has become redundant and one of the two types is wrong.
const narrowing: ReplyFor<{ tag: "Scale"; lo: 1; hi: 5 }> = r as Reply;
expect<unknown>(narrowing);

declare const k: Kind;
expect<boolean>(k.tag === "Scale");
