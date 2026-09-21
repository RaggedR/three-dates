// people.ts — a person is a Runner<AskC>.
//
// The brief never describes a user as a record of attributes and this file does
// not introduce one. What a person IS, operationally, is something you may ask a
// question and receive a reply from — which is exactly a runner for
//
//     AskC  =  Question <| Reply
//
// The corpus is what they have already replied to; the runner is how you get
// the next one. A stored answer and a freshly elicited one are the same thing
// arriving at different times, and the container is what makes that literally
// true rather than merely tidy.
//
// `Disclose` is the second fibre, and it is UNIFORM: every person owes the same
// three numbers about themselves and nobody owes more. Giving some participants
// a fibre others lack would break the constant family — voting/design.pdf §11 —
// and giving the fibre a person's actual replies would turn the disclosure into
// the catalogue §1 says this product does not have.

import type { Fib, PosAt, Runner, Shape } from "./lib/algebra.ts";
import {
  type Answer,
  type Corpus,
  type Kind,
  legal,
  type PersonId,
  type QuestionId,
  type Reply,
  type ReplyFor,
} from "./questions.ts";

// ── The container ─────────────────────────────────────────────────────

/** What one person will tell you about themselves, whoever asks. Counts, not
 *  content. `authored` is in here because §2 Principle 2 makes writing a
 *  question an act, and the number of acts is public even though the acts are
 *  not. */
export interface Disclosure {
  readonly answered: number;
  readonly blank: number;
  readonly authored: number;
  /** Ticks since the person last submitted anything. Principle 4 — a person may
   *  leave at any time — makes this the difference between "no reply yet" and
   *  "gone", and the assignment needs to know which. */
  readonly idle: number;
}

/** `Question <| Reply`, presented as its graph: one fibre per kind, so the
 *  positions over an Ask actually depend on the kind in the shape. This is why
 *  `kind` is carried in the prompt rather than looked up from the corpus — a
 *  lookup happens at run time and cannot index a fibre. */
export type AskC =
  | Fib<
    { tag: "Ask"; id: QuestionId; kind: { tag: "Free" }; prompt: string },
    ReplyFor<{ tag: "Free" }>
  >
  | Fib<
    { tag: "Ask"; id: QuestionId; kind: { tag: "Scale"; lo: number; hi: number }; prompt: string },
    ReplyFor<{ tag: "Scale"; lo: number; hi: number }>
  >
  | Fib<
    { tag: "Ask"; id: QuestionId; kind: { tag: "Choice"; options: readonly string[] }; prompt: string },
    ReplyFor<{ tag: "Choice"; options: readonly string[] }>
  >
  | Fib<{ tag: "Disclose"; of: PersonId }, Disclosure>;

export type AskShape = Shape<AskC>;

/** The introduction rule. It exists so that callers get the fibre inferred from
 *  the kind they pass, rather than building an object literal that lands in the
 *  union and loses the dependency. */
export function ask<K extends Kind>(
  id: QuestionId,
  kind: K,
  prompt: string,
): { tag: "Ask"; id: QuestionId; kind: K; prompt: string } {
  return { tag: "Ask", id, kind, prompt };
}

// ── A person ──────────────────────────────────────────────────────────

/** Everything the system holds about one participant.
 *
 *  `phone` is the identity (§3) and reputation attaches to it. It is not a
 *  field the matcher may read: it is here because §3 says the cost of starting
 *  over is the loss of the history, and history needs a key. */
export interface Person {
  readonly id: PersonId;
  readonly phone: string;
  /** Question -> the latest reply. Revisions overwrite; `history` keeps the
   *  earlier ones, because a contradiction is the thing that makes the count
   *  rise and you cannot see a contradiction with only the current value. */
  readonly answers: ReadonlyMap<QuestionId, Answer>;
  readonly history: readonly Answer[];
  readonly authored: readonly QuestionId[];
  readonly idle: number;
}

export function person(
  id: PersonId,
  phone: string,
  answers: readonly Answer[],
  authored: readonly QuestionId[],
  idle = 0,
): Person {
  const latest = new Map<QuestionId, Answer>();
  for (const a of answers) {
    const prev = latest.get(a.question);
    if (prev === undefined || a.at >= prev.at) latest.set(a.question, a);
  }
  return { id, phone, answers: latest, history: [...answers], authored, idle };
}

export function disclose(p: Person): Disclosure {
  let answered = 0, blank = 0;
  for (const a of p.answers.values()) {
    if (a.reply.tag === "Blank") blank++;
    else answered++;
  }
  return { answered, blank, authored: p.authored.length, idle: p.idle };
}

/** The questions this person has engaged with at all — answered OR blanked.
 *  Both are acts (Principle 3), and for the density measurement both count:
 *  what kills a comparison is a question one of them has never been shown. */
export const engaged = (p: Person): Set<QuestionId> => new Set(p.answers.keys());

/** Answered, not blanked. This is the set `distance` can actually work over. */
export function substantive(p: Person): Set<QuestionId> {
  const out = new Set<QuestionId>();
  for (const [q, a] of p.answers) if (a.reply.tag !== "Blank") out.add(q);
  return out;
}

// ── A person, as a runner ─────────────────────────────────────────────

/** A person backed by stored answers. `run` on an `Ask` they have answered
 *  returns it; on one they have not, it returns `Blank` with a `why` saying so.
 *
 *  That `Blank` is doing real work and is not a stub. Principle 4 says a person
 *  may be asked anything at any time and may simply not be there, and the
 *  container has to be total. "Not yet asked" and "asked and declined" are
 *  distinguished by the `why`, not by one of them being a missing value. */
export function fixturePerson(p: Person, corpus: Corpus): Runner<AskC> {
  return {
    label: `person:${p.id}`,
    // deno-lint-ignore require-await
    async run<S extends AskShape>(shape: S, _depth: number): Promise<PosAt<AskC, S>> {
      if (shape.tag === "Disclose") {
        return disclose(p) as PosAt<AskC, S>;
      }
      const stored = p.answers.get(shape.id);
      if (stored === undefined) {
        return { tag: "Blank", why: "not asked" } as PosAt<AskC, S>;
      }
      // A stored reply that is illegal for its question is a corrupt fixture,
      // not a blank. Coercing it would be the "default at a leaf" mistake that
      // dungeon/leaf-claude.ts exists to refuse.
      if (!legal(shape.kind, stored.reply)) {
        throw new Error(
          `person:${p.id}/${shape.id}: stored reply ${stored.reply.tag} is illegal for kind ${shape.kind.tag}`,
        );
      }
      return stored.reply as PosAt<AskC, S>;
    },
  };
}

// ── The cohort ────────────────────────────────────────────────────────

export class Cohort {
  readonly byId: ReadonlyMap<PersonId, Person>;
  constructor(list: readonly Person[]) {
    this.byId = new Map(list.map((p) => [p.id, p]));
  }
  get(id: PersonId): Person | null {
    return this.byId.get(id) ?? null;
  }
  get ids(): PersonId[] {
    return [...this.byId.keys()];
  }
  get size(): number {
    return this.byId.size;
  }
  get people(): Person[] {
    return [...this.byId.values()];
  }
  /** §1.4 of PLAN-build: 3n = 2|E| over a 3-regular graph, so an odd cohort
   *  admits no assignment at all. This is arithmetic, not policy, and it is a
   *  gate rather than a warning. */
  get assignable(): boolean {
    return this.size % 2 === 0;
  }
}

export type { Kind, PersonId, QuestionId, Reply };
