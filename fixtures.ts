// fixtures.ts — synthetic cohorts, at a chosen size and density.
//
// Everything downstream is measured against these, so what is in them decides
// what the measurements mean. Three commitments:
//
// 1. DETERMINISTIC. A seeded generator, no Date, no crypto. A curve that moves
//    between runs is not a curve. `--seed` is the only source of variation and
//    every reported number names the seed it came from.
//
// 2. THERE IS REAL STRUCTURE TO FIND. Each person carries a hidden trait vector
//    and each question a hidden direction; a reply is the projection plus noise.
//    If replies were uniform noise, every matcher would score the same and
//    Phase 6's comparison against a random baseline would be a tautology
//    reporting no gap. The traits are never exposed to any matcher — they exist
//    so that a ceiling exists.
//
// 3. THE SPARSITY IS THE POINT, NOT AN ARTEFACT. Which questions a person is
//    shown is skewed: questions have popularity, people have appetite. That is
//    what makes Phase 2's shared-pair number small, and it is small in reality
//    for the same reason. A fixture that let everyone answer everything would
//    make the density problem of §9 invisible, which is the one thing these
//    fixtures must not do.
//
// Blank is generated deliberately and NOT at random (Principle 3): a person
// declines questions whose direction is far from their traits — the questions
// they are not oriented toward. Blanking uniformly at random would make
// "blank is data" false in the fixtures and then true in production, which is
// the worst way round.

import { type Answer, type Kind, type Question, type Reply, Corpus } from "./questions.ts";
import { Cohort, type Person, person } from "./people.ts";

// ── A seeded generator. mulberry32; short, fast, good enough for fixtures ──
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number): number => {
  // Box-Muller. One of the pair is discarded; fixtures are not hot.
  const u = Math.max(r(), 1e-12), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export interface CohortSpec {
  readonly n: number;
  /** Questions authored per person. §3 requires at least one. */
  readonly authoredEach: number;
  /** Mean fraction of the corpus a person engages with at all. This is the
   *  density knob, and it is the parameter Phase 3's curve is swept over. */
  readonly density: number;
  /** Expected questions a person engages with, ABSOLUTE. When set it overrides
   *  `density`, and it is the honest knob of the two.
   *
   *  Under `density` the corpus grows with the cohort — one question authored
   *  per arrival — so a fixed fraction means a person in a cohort of a thousand
   *  answers two hundred and fifty questions. Nobody does that. Attention is
   *  bounded and the corpus is not, so the shared-question count per pair goes
   *  as budget^2 / |corpus| and FALLS as the market grows. That is the density
   *  problem of §9 stated as an asymptotic, and the first run of this file
   *  missed it entirely by holding the fraction fixed. */
  readonly budget?: number;
  /** Hidden trait dimensions. More dimensions, thinner market: two people agree
   *  on everything measured far less often in a high-dimensional space, which
   *  is the abstract form of the §9 risk. */
  readonly dims: number;
  /** Reply noise, in trait units. 0 is a world where compatibility is knowable
   *  exactly; Joel et al. 2020 says the real one is nearer 1. */
  readonly noise: number;
  readonly seed: number;
}

export const DEFAULT: CohortSpec = {
  n: 200,
  authoredEach: 1,
  density: 0.25,
  dims: 6,
  noise: 0.6,
  seed: 20260921,
};

export interface Fixture {
  readonly cohort: Cohort;
  readonly corpus: Corpus;
  readonly spec: CohortSpec;
  /** The hidden truth. For scoring the ceiling in Phase 3 and 6 ONLY. No
   *  matcher, stub or model, may read this. */
  readonly traits: ReadonlyMap<string, readonly number[]>;
}

// Prompts are drawn from templates rather than written out, because two hundred
// hand-written questions would be two hundred opportunities to smuggle the
// answer in. The text matters only to the model leaves of Phase 7; to every
// other phase a question is its id and its kind.
const TOPICS = [
  "children", "religion", "money", "moving cities", "family", "conflict",
  "solitude", "ambition", "illness", "politics", "monogamy", "mess",
  "silence", "risk", "parents", "debt", "pets", "faith", "grief", "work",
] as const;

const FREE_FORMS = [
  "What did you last change your mind about regarding %s?",
  "Describe a time %s cost you something.",
  "What would someone who lived with you notice about %s?",
] as const;
const SCALE_FORMS = [
  "How settled are you about %s?",
  "How much does %s come up in your week?",
] as const;
const CHOICE_FORMS = [
  "When %s is the problem, what do you do first?",
] as const;
const CHOICE_OPTIONS = ["talk it out", "go quiet", "make a plan", "wait"] as const;

export function generate(partial: Partial<CohortSpec> = {}): Fixture {
  const spec: CohortSpec = { ...DEFAULT, ...partial };
  const r = rng(spec.seed);

  const ids = Array.from({ length: spec.n }, (_, i) => `p${String(i).padStart(4, "0")}`);

  // Traits, and appetite. Appetite is lognormal-ish: most people answer a few
  // things and a handful answer everything, which is what every corpus looks
  // like and is why a mean density is a poor summary of one.
  const traits = new Map<string, number[]>();
  const appetite = new Map<string, number>();
  for (const id of ids) {
    traits.set(id, Array.from({ length: spec.dims }, () => gauss(r)));
    appetite.set(id, Math.exp(gauss(r) * 0.8));
  }

  // Questions. Each person authors `authoredEach`, so the corpus size is tied
  // to the cohort size exactly as §3 says it is: the bank grows because people
  // arrive, not because it was seeded.
  const questions: Question[] = [];
  const dir = new Map<string, number[]>();
  const popularity = new Map<string, number>();
  const authoredBy = new Map<string, string[]>();
  for (const id of ids) {
    const mine: string[] = [];
    for (let k = 0; k < spec.authoredEach; k++) {
      const qid = `${id}-q${k}`;
      const topic = pick(r, TOPICS);
      const roll = r();
      let kind: Kind, prompt: string;
      if (roll < 0.4) {
        kind = { tag: "Free" };
        prompt = pick(r, FREE_FORMS).replace("%s", topic);
      } else if (roll < 0.8) {
        kind = { tag: "Scale", lo: 1, hi: 5 };
        prompt = pick(r, SCALE_FORMS).replace("%s", topic);
      } else {
        kind = { tag: "Choice", options: CHOICE_OPTIONS };
        prompt = pick(r, CHOICE_FORMS).replace("%s", topic);
      }
      questions.push({ id: qid, kind, prompt, author: id, composed: false });
      // A question's direction is correlated with its author's traits: people
      // ask about the axes they are on. This is why the corpus is not a random
      // basis, and why some pairs share far more than chance.
      const t = traits.get(id)!;
      dir.set(qid, t.map((x) => x * 0.7 + gauss(r) * 0.7));
      popularity.set(qid, Math.exp(gauss(r) * 0.9));
      mine.push(qid);
    }
    authoredBy.set(id, mine);
  }
  const corpus = new Corpus(questions);

  const meanPop = [...popularity.values()].reduce((a, b) => a + b, 0) / questions.length;
  const meanApp = [...appetite.values()].reduce((a, b) => a + b, 0) / ids.length;

  const dot = (a: readonly number[], b: readonly number[]) =>
    a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = (a: readonly number[]) => Math.sqrt(dot(a, a)) || 1;

  const people: Person[] = [];
  let tick = 0;
  for (const id of ids) {
    const t = traits.get(id)!;
    const app = appetite.get(id)!;
    const answers: Answer[] = [];

    for (const q of questions) {
      // §3: you answer your own question, always. Everything else is chance.
      const mine = q.author === id;
      if (!mine) {
        const base = spec.budget === undefined
          ? spec.density
          : Math.min(1, spec.budget / questions.length);
        const p = base * (popularity.get(q.id)! / meanPop) * (app / meanApp);
        if (r() >= Math.min(p, 1)) continue;
      }

      const d = dir.get(q.id)!;
      const proj = dot(t, d) / norm(d);

      // Blank is orientation, not noise: a question pointing somewhere this
      // person is not is a question they decline. An author never blanks their
      // own (§3 would be void if they could).
      const oriented = Math.abs(proj) / (norm(t) || 1);
      if (!mine && oriented < 0.12 && r() < 0.5) {
        answers.push({
          question: q.id,
          reply: { tag: "Blank", why: "not something I think about" },
          at: tick++,
        });
        continue;
      }

      const signal = proj + gauss(r) * spec.noise;
      let reply: Reply;
      switch (q.kind.tag) {
        case "Free": {
          // Prose is bucketed into a small vocabulary. Free text is opaque to
          // every phase before 7, and a fixture that pretended otherwise would
          // be a fixture the stub leaves could cheat on.
          const b = Math.max(0, Math.min(4, Math.round(signal + 2)));
          reply = { tag: "Text", value: `stance-${b}` };
          break;
        }
        case "Scale": {
          const v = Math.max(1, Math.min(5, Math.round(signal + 3)));
          reply = { tag: "Rating", value: v };
          break;
        }
        case "Choice": {
          const i = Math.max(0, Math.min(3, Math.round(signal + 1.5)));
          reply = { tag: "Pick", option: CHOICE_OPTIONS[i] };
          break;
        }
      }
      answers.push({ question: q.id, reply, at: tick++ });
    }

    people.push(person(id, `+6140000${ids.indexOf(id)}`, answers, authoredBy.get(id)!, Math.floor(r() * 3)));
  }

  return { cohort: new Cohort(people), corpus, spec, traits };
}
