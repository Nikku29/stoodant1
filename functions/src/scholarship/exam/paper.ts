import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { getStorage } from "firebase-admin/storage";

export type Level = "easy" | "medium" | "hard";
export const SUBJECTS = ["maths", "science", "reasoning", "english"] as const;
export type Subject = (typeof SUBJECTS)[number];
/** `group`: questions made from one pattern (only the numbers or letters change). A paper takes at most one of each group. */
export type BankQuestion = { id: string; class: string; subject: Subject; level: Level; text: string; options: string[]; answer: number; group?: string };
/** Each subject's 15 questions, medium to hard (a scholarship test picks the best): 7 medium, 8 hard (taken from the other levels when one runs short). */
export const BLUEPRINT: Record<Level, number> = { easy: 0, medium: 7, hard: 8 };
export const PER_SUBJECT = 15;
export const BANK_PATH = "private/exam/bank.json";

/**
 * One question as the student gets it: the bank id, the order its four options are shown in, and which shown
 * option is right. The answer key travels with each student's own paper, so marking never depends on question
 * numbers or on the bank changing later.
 */
export type PaperItem = { id: string; subject: Subject; order: number[]; answer: number };
/** A question as the browser shows it (no answer). */
export type ShownQuestion = { subject: Subject; text: string; options: string[] };

let cached: { at: number; byClass: Map<string, BankQuestion[]>; version: string } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/** The question bank (uploaded by the team in /admin) and its version, read once per server and kept for five minutes. */
export async function loadBankVersioned(): Promise<{ byClass: Map<string, BankQuestion[]>; version: string }> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached;
  const [buffer] = await getStorage().bucket().file(BANK_PATH).download();
  const version = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  cached = { at: Date.now(), byClass: indexBank(JSON.parse(buffer.toString("utf8")) as unknown[]), version };
  return cached;
}
export const loadBank = async () => (await loadBankVersioned()).byClass;
export const forgetBank = () => { cached = null; };

/**
 * Two options that differ only in spaces, slashes, brackets, × or · (10√3 m and 10/√3 m, Ω m and Ω/m) look the same
 * on a small screen. Such a question is left out. The same check is in checkBank (src/lib/firebase/scholarship.ts).
 */
export const lookAlike = (a: string, b: string) => {
  const plain = (s: string) => s.toLowerCase().replace(/²/g, "2").replace(/³/g, "3").replace(/[\s/()·×*^]/g, "");
  return a !== b && plain(a) === plain(b);
};
export const hasLookAlikeOptions = (options: string[]) => options.some((a, i) => options.some((b, j) => j > i && lookAlike(a, b)));

/** Valid questions per class, with exact repeats (same text and options) kept once. */
export function indexBank(raw: unknown[]): Map<string, BankQuestion[]> {
  const byClass = new Map<string, BankQuestion[]>();
  const seen = new Set<string>();
  for (const item of raw) {
    const q = item as BankQuestion;
    if (!q || typeof q.id !== "string" || typeof q.text !== "string" || !Array.isArray(q.options) || q.options.length !== 4) continue;
    if (!SUBJECTS.includes(q.subject) || !["easy", "medium", "hard"].includes(q.level)) continue;
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) continue;
    if (q.options.some((o) => typeof o !== "string" || !o.trim()) || new Set(q.options).size !== 4 || hasLookAlikeOptions(q.options)) continue;
    if (q.group !== undefined && typeof q.group !== "string") continue;
    const key = `${q.class}|${q.subject}|${q.text}|${[...q.options].sort().join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byClass.set(q.class, [...(byClass.get(q.class) ?? []), q]);
  }
  return byClass;
}

/** A small seeded random generator (mulberry32): the same seed always gives the same paper. */
export function seededRandom(seed: string): () => number {
  let a = createHmac("sha256", "stoodant-paper").update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * This student's paper: per subject, questions drawn by the blueprint from the class's bank, in a random order,
 * each with its options shuffled. Sections stay in SUBJECTS order. Seeded by a secret + roll number, so a
 * restart gives the same paper and nobody can work out another student's.
 */
export function makePaper(bank: BankQuestion[], seed: string): PaperItem[] {
  const random = seededRandom(seed);
  return SUBJECTS.flatMap((subject) => {
    const pool = bank.filter((q) => q.subject === subject);
    const picked: BankQuestion[] = [];
    const left: BankQuestion[] = [];
    const groups = new Set<string>();
    // Takes a question unless one from its pattern group is already in the paper.
    const take = (q: BankQuestion) => {
      if (q.group && groups.has(q.group)) return false;
      if (q.group) groups.add(q.group);
      picked.push(q);
      return true;
    };
    for (const level of ["easy", "medium", "hard"] as const) {
      let need = BLUEPRINT[level];
      for (const q of shuffle(pool.filter((x) => x.level === level), random)) {
        if (need > 0 && take(q)) need--;
        else left.push(q);
      }
    }
    for (const q of shuffle(left, random)) if (picked.length < PER_SUBJECT && !picked.includes(q)) take(q);
    return shuffle(picked, random).map((q) => {
      const order = shuffle([0, 1, 2, 3], random);
      return { id: q.id, subject, order, answer: order.indexOf(q.answer) };
    });
  });
}

/** The questions of a paper as the student sees them: options in the paper's order, no answers. */
export function showPaper(paper: PaperItem[], bank: BankQuestion[]): ShownQuestion[] {
  const byId = new Map(bank.map((q) => [q.id, q]));
  return paper.map((item) => {
    const q = byId.get(item.id)!;
    return { subject: q.subject, text: q.text, options: item.order.map((i) => q.options[i]!) };
  });
}

/** The key that unlocks one student's downloaded paper. Derived, never stored; given out only when their exam hour starts. */
export const paperKey = (pepper: string, rollNo: string) => createHmac("sha256", pepper).update(`scholarship-paper-key:${rollNo}`).digest();

/** The shown questions locked with AES-256-GCM (what WebCrypto reads: ciphertext followed by the tag), base64. */
export function lockQuestions(questions: ShownQuestion[], key: Buffer): { iv: string; data: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(questions), "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { iv: iv.toString("base64"), data: data.toString("base64") };
}

/** Marks: 1 per correct answer, nothing taken off for a wrong one. `answers` holds the shown option index per question. */
export function scorePaper(paper: PaperItem[], answers: Record<string, number>) {
  const bySubject: Record<string, { correct: number; wrong: number }> = {};
  let correct = 0;
  let wrong = 0;
  paper.forEach((item, i) => {
    const shown = answers[String(i)];
    if (shown === undefined || shown === null) return;
    const s = (bySubject[item.subject] ??= { correct: 0, wrong: 0 });
    if (shown === item.answer) { correct++; s.correct++; } else { wrong++; s.wrong++; }
  });
  return { marks: correct, correct, wrong, unanswered: paper.length - correct - wrong, bySubject };
}
