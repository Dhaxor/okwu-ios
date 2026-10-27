// The text filter for everything one person types that another can read:
// display names, club names and descriptions, club chat, voice-note captions
// and appeal notes. Shared code: the app runs it for instant feedback, the
// server (server/src) runs the same module and is the authority.
//
// What it stops, in order of precedence:
// 1. grooming: secrecy ("don't tell your mum"), photo/video requests, meet-ups,
//    sexualised remarks. In strict mode (a teen can read the text) also age,
//    school, home and relationship questions.
// 2. money: crypto, gift cards, transfers, bank and wallet details, the
//    Nigerian scam lexicon (aza, opay, "maga don pay", "yahoo boys"), and any
//    message that pairs an ask ("send", "need", "nye", "zie") with money.
// 3. profanity and slurs (l33t, stretched and spelled-out forms).
// 4. contact details, which are MASKED rather than rejected: phone numbers
//    (Nigerian formats, spaced digits, digit words), URLs, emails, @handles,
//    and the apps people move to (WhatsApp, Telegram, Snap, Instagram, ...).
//
// Evasion handled: zero-width and bidi characters, fullwidth and circled
// characters (NFKD), Cyrillic/Greek look-alikes, l33t digits, stretched
// letters and letters spaced or dotted apart.
//
// Igbo is never mangled: matching runs on a folded copy (lower case, marks
// stripped), and the text that comes back is the input in NFC with only the
// masked spans replaced. Igbo and Pidgin terms are limited to ones we are
// confident about; deliberately NOT listed because they are everyday Igbo
// words: ewu (goat), ike (strength), otu (one; our clubs), ego (money, only
// flagged next to an ask), uba (wealth), aza. More terms come from native
// moderators through the server's admin-managed list (`ExtraTerms`).
//
// Pure TypeScript (no React Native import), tested by bun (filter.test.ts).
import { graphemeCount, nfc } from "../igbo/text";
import type { FilterReason, FilterResult, TextFilter } from "./types";

export interface FilterOptions {
  /**
   * A teen can read this text (for example a caption in a Family Circle with
   * a teen member). Also rejects age, school, home and relationship questions.
   */
  strict?: boolean;
}

/** Extra terms from native moderators (server admin list). Matched as whole words or phrases. */
export interface ExtraTerms {
  profanity?: readonly string[];
  money?: readonly string[];
  grooming?: readonly string[];
  contact?: readonly string[];
}

export interface Scan {
  grooming: "strong" | "soft" | null;
  money: boolean;
  profanity: boolean;
  /** Contact details found, as [start, end) UTF-16 ranges of the cleaned text. */
  contact: [number, number][];
}

export interface OkwuTextFilter extends TextFilter {
  chat(text: string, maxGraphemes: number, opts?: FilterOptions): FilterResult;
  name(text: string, opts?: FilterOptions & { maxGraphemes?: number }): FilterResult;
  /** What the filter sees in a text (for moderation signals). */
  scan(text: string, opts?: FilterOptions): Scan;
}

export const NAME_MIN = 2;
export const NAME_MAX = 20;
export const MASK = "***";

// ---------------------------------------------------------------------------
// Cleaning and folding
// ---------------------------------------------------------------------------

// Zero-width, bidi, soft hyphen, variation selectors, keycap, tag characters.
// Combining marks U+0300–036F stay: they carry Igbo tone.
const INVISIBLE = new RegExp(
  "[\\u0000-\\u0008\\u000E-\\u001F\\u007F-\\u009F\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\u3164\\uFE00-\\uFE0F\\uFEFF\\uFFA0\\u20E3]|\\uDB40[\\uDC00-\\uDCFF]",
  "g"
);

/** Strip invisible characters, collapse whitespace, NFC. What gets stored. */
export function cleanText(raw: unknown): string {
  return nfc(String(raw ?? ""))
    .replace(/[\t\n\v\f\r\u0085\u2028\u2029]/g, " ")
    .replace(INVISIBLE, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Look-alikes from other scripts that NFKD leaves alone.
const CONFUSABLE: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", ѕ: "s", і: "i", ї: "i", ј: "j", һ: "h", ԁ: "d", ԛ: "q", ԝ: "w", ѵ: "v",
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", μ: "u", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ω: "w",
  ı: "i", ł: "l", ø: "o", đ: "d", ħ: "h", ŋ: "n", ß: "ss", æ: "ae", œ: "oe", ɡ: "g", ℓ: "l", "։": ":", "․": ".", "｡": ".", "。": ".",
};

function foldChar(ch: string): string {
  let s = ch.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  if (s.length === 1 || /^[\x20-\x7e]*$/.test(s)) return CONFUSABLE[s] ?? s;
  return Array.from(s, (c) => CONFUSABLE[c] ?? c).join("");
}

interface Folded {
  /** Lower case, marks stripped, look-alikes mapped. */
  f: string;
  /** For each UTF-16 unit of f: where its source code point starts / ends in the cleaned text. */
  start: number[];
  end: number[];
}

function fold(t: string): Folded {
  let f = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const ch of t) {
    const out = foldChar(ch);
    const e = i + ch.length;
    if (!out && end.length) end[end.length - 1] = e; // a combining mark belongs to its base
    for (let k = 0; k < out.length; k++) {
      start.push(i);
      end.push(e);
    }
    f += out;
    i = e;
  }
  return { f, start, end };
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", $: "s", "!": "i", "|": "l", "€": "e", "+": "t" };

/** Tokens of the folded text, l33t undone in tokens that are mostly letters. */
function tokens(folded: string): { raw: string[]; leet: string[] } {
  const f = folded.replace(/(\d)[,.](?=\d{3}(?!\d))/g, "$1"); // "5,000" → "5000"
  const raw = f.split(/[^a-z0-9$£€₦@!|+]+/).filter(Boolean);
  const leet = raw.map((w) => {
    const letters = (w.match(/[a-z]/g) ?? []).length;
    const other = w.length - letters;
    if (!letters || letters <= other) return w.replace(/[@!|+]/g, "");
    return Array.from(w, (c) => LEET[c] ?? c).join("").replace(/[^a-z$£€₦]/g, "");
  });
  return { raw: raw.map((w) => w.replace(/[@!|+]/g, "")).filter(Boolean), leet: leet.filter(Boolean) };
}

/** Joins runs of one-letter tokens ("s e n d" → "send") so spaced-out words match. */
function joinSingles(words: string[]): string[] {
  const out: string[] = [];
  let run = "";
  for (const w of words) {
    if (w.length === 1 && /[a-z]/.test(w)) run += w;
    else {
      if (run) out.push(run);
      run = "";
      out.push(w);
    }
  }
  if (run) out.push(run);
  return out;
}

const squash = (s: string) => s.replace(/(.)\1+/g, "$1"); // "fuuuck" → "fuck"
const shrink = (s: string) => s.replace(/(.)\1{2,}/g, "$1$1"); // "boooobs" → "boobs"
const hasDouble = (s: string) => /(.)\1/.test(s);

// ---------------------------------------------------------------------------
// Profanity and slurs
// ---------------------------------------------------------------------------

// Matched anywhere inside a word: strong terms that don't occur inside
// innocent words. (From Ludo Royale's list; "rapist" moved to WHOLE because
// it is inside "therapist".)
const PROFANITY_ANYWHERE = [
  "fuck", "fuk", "shit", "bitch", "biatch", "cunt", "asshole", "arsehole", "whore", "slut", "wanker", "twat", "motherf",
  "nigger", "nigga", "faggot", "fagot", "porn", "dildo", "blowjob", "handjob", "pussy", "towelhead", "raghead",
  "pendejo", "mierda", "chinga", "caralho", "buceta", "fodase", "putain", "salope", "connard", "connasse",
  "chutiya", "madarchod", "behenchod", "bhenchod", "bhosdike", "sharmouta", "sharmuta", "kosomak", "orospu", "siktir", "ngentot", "kontol",
  "gilipollas", "malparido", "hijueputa", "hijodeputa", "maricon", "arrombado", "jancok", "bajingan",
  // Nigerian: "prostitute" insults, and the ethnic slur for Igbo people.
  "ashawo", "olosho", "nyamiri", "nyamili",
];

// Matched only as a whole word (they appear inside innocent words and names:
// "Dickens", "Essex", "therapist", "raccoon").
const PROFANITY_WHOLE = [
  "dick", "cock", "fck", "fag", "puta", "puto", "paki", "randi", "lauda", "retard", "retarded", "tranny", "dyke", "kike", "chink", "coon", "spic", "gook", "wetback", "sambo", "kaffir", "jigaboo",
  "nude", "nudes", "boobs", "tits", "penis", "vagina", "horny", "sexy", "sex", "rapist", "rape", "bastard", "wank", "spastic", "oloshi", "werey",
  "cabron", "viado", "merda", "porra", "foder", "verga", "gandu", "harami", "kamina", "anjing", "bangsat", "memek", "pute", "merde", "culero",
];

// Phrases (folded words joined by single spaces).
const PROFANITY_PHRASES = ["omo ale", "son of a bitch", "porch monkey", "go kill yourself", "kill yourself", "kys"];

function makeWordMatcher(anywhere: readonly string[], whole: readonly string[]) {
  const any = anywhere.map((w) => w.toLowerCase());
  const wh = whole.map((w) => w.toLowerCase());
  return (word: string): boolean => {
    if (!word) return false;
    const sq = squash(word);
    const sh = shrink(word);
    for (const e of any) if (hasDouble(e) ? sh.includes(e) : sq.includes(e)) return true;
    for (const e of wh) {
      const w = hasDouble(e) ? sh : sq;
      if (w === e || (w.endsWith("s") && w.slice(0, -1) === e)) return true;
    }
    return false;
  };
}

// ---------------------------------------------------------------------------
// Money and scams (rejected)
// ---------------------------------------------------------------------------

const MONEY_TERMS = [
  "bitcoin", "btc", "crypto", "cryptocurrency", "cryptocurrencies", "usdt", "tether", "ethereum", "binance", "coinbase", "bybit", "kucoin", "luno", "metamask",
  "trust wallet", "wallet address", "seed phrase", "forex", "fx trading", "binary options?", "trading signals?", "investment", "investments", "invest", "investing", "investor",
  "roi", "double your money", "make money", "earn money", "passive income", "giftcards?", "gift ?cards?", "itunes cards?", "apple cards?", "steam cards?", "amazon cards?",
  "google play cards?", "razer gold", "vanilla cards?", "western union", "money ?gram", "paypal", "cash ?app", "venmo", "zelle", "skrill", "payoneer",
  "bank account", "bank details", "account number", "acct no", "acc no", "account details", "routing number", "sort code", "iban", "bvn",
  "opay", "palmpay", "moniepoint", "kuda bank", "gtbank", "gtb", "zenith bank", "first bank", "access bank", "fidelity bank", "ecobank", "stanbic", "wema bank", "union bank", "sterling bank",
  "recharge cards?", "airtime", "mobile money", "sugar daddy", "sugar mummy", "sugar mommy", "sugar baby", "yahoo boys?", "yahoo yahoo", "yahoo plus", "maga don pay",
  "processing fee", "clearance fee", "customs fee", "registration fee", "send me money", "send money", "wire transfer", "bank transfer", "credit alert", "debit alert",
  "(?:drop|send|give me) (?:your|ur|ya|me|my) aza", "my aza", "aza (?:number|no|details)",
  // Igbo: "give me money", "send me money".
  "nye m ego", "zitere m ego", "ziere m ego", "zie m ego",
];

// Asks, not reports: "I paid 500 naira for yam" is a market story, "send 500 naira" is not.
const MONEY_ASK = /\b(?:send|sending|pay|paying|transfer|wire|give me|gimme|lend|loan|borrow|need|needs|deposit|invest|earn|earning|win|credit|dash me|help me with)\b/;
const MONEY_THING = /\b(?:money|cash|funds|naira|dollars?|usd|pounds|euros?|cedis|bucks|alert)\b|[$£€₦]\s?\d|\d\s?(?:[$£€₦]|k\b|usd\b|naira\b|dollars?\b)|\bn\s?\d{3,}\b/;
const IGBO_ASK_MONEY = /\b(?:nye|zie|zitere|ziere|kwuo)\b.*\bego\b/;

// ---------------------------------------------------------------------------
// Grooming (rejected)
// ---------------------------------------------------------------------------

const YOU = "(?:you|u|yu|ya|yuh)";
const YOUR = "(?:your|ur|yr|youre|ya)";
const KIN = "(?:parents?|mum|mom|mommy|mummy|mother|dad|daddy|father|family|teacher|anyone|anybody|nobody|no one|mama|papa|people|guardian|sister|brother)";

const GROOMING_STRONG = [
  `(?:dont|don t|do not|never|no) tell (?:${YOUR} )?${KIN}`,
  `make ${YOU} no tell`,
  `our (?:little )?secret`,
  `keep (?:this|it|that) (?:a )?secret`,
  `keep (?:this|it|that) between us`,
  `between (?:you and me|me and you|us two)`,
  `delete (?:this|the|our|these|all|my) (?:chat|chats|message|messages|convo|conversation|texts?)`,
  `send (?:me )?(?:a |some |your |ur |more |me )?(?:pic|pics|picture|pictures|photo|photos|selfie|selfies|nude|nudes|naked|video|videos|vid|snap)`,
  `snap (?:me )?(?:your|ur) (?:pic|picture|body|self)`,
  `(?:show|let me see) (?:me )?${YOUR} (?:body|boobs|breasts?|chest|legs|butt|ass|privates?|nakedness)`,
  `(?:video|cam|webcam) (?:call|chat)`,
  `facetime`,
  `turn on (?:${YOUR} )?(?:cam|camera|video)`,
  `what (?:are|r) ${YOU} wearing`,
  `meet (?:me|up|in person|irl|offline)`,
  `(?:lets|let s|let us|make we|wanna|want to|we should|can we|shall we) meet`,
  `come (?:over )?(?:to )?my (?:house|place|home|hotel|room|flat|apartment)`,
  `pick ${YOU} up`,
  `home alone`,
  `(?:are|r) ${YOU} alone`,
  `send (?:me )?${YOUR} (?:address|location|house address)`,
  `what(?: is| s|s)? ${YOUR} (?:address|location)`,
  `mature for ${YOUR} age`,
  `(?:are|r) ${YOU} (?:a )?virgin`,
  `something sexy`,
];

const GROOMING_SOFT = [
  `how old (?:are|r) ${YOU}`,
  `how old ${YOU} (?:be|dey)`,
  `what(?: is| s|s)? ${YOUR} age`,
  `wetin be ${YOUR} age`,
  `asl`,
  `(?:are|r) ${YOU} (?:1[0-7]|under 18|underage)`,
  `what (?:grade|year|class|form) (?:are|r) ${YOU} in`,
  // Igbo: "how old are you?" (two word orders).
  `afo ole ka i di`,
  `i di afo ole`,
  `where (?:do|d) ${YOU} (?:live|stay)`,
  `where ${YOU} dey (?:stay|live)`,
  `(?:what|which) school (?:do |d )?${YOU} (?:dey )?(?:go|attend)`,
  // Igbo: "where do you live?"
  `ebee ka i bi`,
  `where (?:is|s) ${YOUR} (?:house|home|school)`,
  `do ${YOU} have (?:a )?(?:boyfriend|girlfriend|bf|gf)`,
  `(?:are|r) ${YOU} single`,
  `be my (?:girlfriend|boyfriend|gf|bf|wife|husband|baby|babe)`,
];

// ---------------------------------------------------------------------------
// Contact details (masked)
// ---------------------------------------------------------------------------

const TLD =
  "com|net|org|io|me|gg|ly|app|xyz|co|link|site|info|biz|ru|tk|to|ng|uk|us|ca|dev|page|online|store|shop|live|tv|cc|ws|la|bio|club|top|vip|fun|life|world|email|chat|social|ai|ee|gl|lnk";
const DOT = "(?:\\s*\\.\\s*|\\s*\\(dot\\)\\s*|\\s*\\[dot\\]\\s*|\\s+dot\\s+)";

// Regexes on the folded text. Each has a leading boundary group whose length
// is skipped when computing the span (no lookbehind: Hermes-safe).
const CONTACT_RES: RegExp[] = [
  /()(?:https?:\/\/|www\.)\S+/g,
  new RegExp(`(^|[^a-z0-9])[a-z0-9][a-z0-9-]*(?:${DOT}[a-z0-9-]+)*${DOT}(?:${TLD})(?![a-z0-9])(?:\\/\\S*)?`, "g"),
  /(^|[^a-z0-9._%+-])[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g,
  /(^|[^a-z0-9_])@[a-z0-9_.]{2,}/g,
  /(^|[^a-z0-9])(?:gmail|ymail|yahoomail|hotmail|outlook|icloud|protonmail|proton\s*mail)(?![a-z0-9])/g,
];

const SEP = "[\\s._\\-*~/\\\\]*";
const LEET_CLASS: Record<string, string> = { a: "[a4@]", e: "[e3]", i: "[i1!l|]", o: "[o0]", s: "[s5$]", t: "[t7+]", g: "[g9]", b: "[b8]", l: "[l1|i]" };
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SEP_TIGHT = "[._\\-*~]*";

/**
 * "whatsapp" → a regex that also matches "whaaatsapp", "wh4tsapp", "whats.app"
 * and, for names of 7+ letters, "w h a t s a p p". Short names don't allow
 * spaces between letters ("wasap" would otherwise catch "was app").
 */
function evasive(word: string): string {
  return Array.from(word, (ch) => `${LEET_CLASS[ch] ?? escapeRe(ch)}+`).join(word.length >= 7 ? SEP : SEP_TIGHT);
}

// App names that are unambiguous on their own ("messenger", "signal", "line"
// and "hangouts" are everyday English, so they only count in phrases).
const APPS = ["whatsapp", "whatsap", "watsapp", "watsap", "wasap", "telegram", "snapchat", "instagram", "kik", "discord", "wickr", "skype", "viber", "wechat", "tiktok", "facebook", "zangi", "threema", "onlyfans", "linktree"];

// Phrases that move a conversation elsewhere ("w" = words separated by anything).
const CONTACT_PHRASES = [
  "(?:dm|pm|inbox|hmu|msg|message|text|whatsapp|flash|beep) me",
  "hit me up",
  "(?:call|ring|reach|contact|find|add|follow|chat) me (?:up )?(?:on|at|via|through)",
  "chat me up",
  "my (?:number|digits|line|phone|contact|contacts|handle|username|user name|ig|insta|snap|whatsapp|telegram|tg|email|e mail|addy)",
  `(?:what s|whats|what is|send|drop|give me) ${YOUR} (?:number|digits|line|phone|contact|handle|username|ig|insta|snap|whatsapp|telegram|email)`,
  "phone (?:number|no)",
  "(?:on|add me on|my) (?:snap|ig|insta|tg|signal)",
  "(?:fb|facebook) messenger",
  "signal me",
  // Igbo: "my number".
  "nomba m",
];

const CONTACT_PHRASE_RES = [
  // "snap: ada_22", "ig @ada", "tg id ada"
  /(^|[^a-z0-9])(?:snap|ig|insta|tg|sc|fb|kik|discord)\s*[:@]\s*[a-z0-9_.]*/g,
  /(^|[^a-z0-9])(?:snap|ig|insta|tg|fb)\s+(?:id|handle|name|username)\b[\s:]*[a-z0-9_.]*/g,
  // "my ig is ada_22", "my snap na ada"
  /(^|[^a-z0-9])my\s+(?:ig|insta|instagram|snap|snapchat|tg|telegram|discord|kik|tiktok|handle|username)\s+(?:is|na|be)\s*:?\s*@?[a-z0-9_.]+/g,
  ...APPS.map((a) => new RegExp(`(^|[^a-z0-9])${evasive(a)}(?![a-z0-9])`, "g")),
  ...CONTACT_PHRASES.map((p) => new RegExp(`(^|[^a-z0-9])${p.replace(/ /g, "[^a-z0-9]+")}(?![a-z0-9])`, "g")),
];

const DIGIT_WORDS: Record<string, number> = { zero: 1, oh: 1, nought: 1, one: 1, two: 1, three: 1, four: 1, five: 1, six: 1, seven: 1, eight: 1, nine: 1, ten: 2 };
const PHONE_GAP = /^[\s.\-()/+_,*#:~]*$/;
// Dates and times are long digit runs too: "23/10/2026", "2026-10-23", "10:30-11:45".
const NOT_A_PHONE = [/^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/, /^\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}$/, /^\d{1,2}:\d{2}(?:\s*(?:-|to)\s*\d{1,2}:\d{2})?$/];

/** Runs of digits / digit words (with only separators between) holding 7+ digits. */
function phoneSpans(f: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /[a-z0-9]+/g;
  type Tok = { s: number; e: number; digits: number; real: boolean };
  let run: Tok[] = [];
  const flush = () => {
    const digits = run.reduce((n, t) => n + t.digits, 0);
    const real = run.filter((t) => t.real).length;
    // 7+ digits, and either a real digit token or 7+ spelled digits.
    const s = run[0]?.s ?? 0;
    const e = run[run.length - 1]?.e ?? 0;
    if (digits >= 7 && (real > 0 || run.length >= 7) && !NOT_A_PHONE.some((re) => re.test(f.slice(s, e)))) out.push([s, e]);
    run = [];
  };
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = re.exec(f))) {
    const w = m[0];
    // Digits with o / l / i standing in for 0 / 1 ("08O3"), when mostly digits.
    const asDigits = /^[0-9oli]+$/.test(w) && /[0-9]/.test(w) && (w.match(/[0-9]/g)?.length ?? 0) * 2 >= w.length;
    const word = DIGIT_WORDS[w];
    const tok: Tok | null = asDigits ? { s: m.index, e: m.index + w.length, digits: w.length, real: true } : word ? { s: m.index, e: m.index + w.length, digits: word, real: false } : null;
    if (tok && run.length && !PHONE_GAP.test(f.slice(lastEnd, m.index))) flush();
    if (tok) run.push(tok);
    else if (run.length) flush();
    lastEnd = m.index + w.length;
  }
  if (run.length) flush();
  // "+234 ..." keeps its plus sign.
  return out.map(([s, e]) => [s > 0 && f[s - 1] === "+" ? s - 1 : s, e]);
}

function regexSpans(f: string, res: readonly RegExp[]): [number, number][] {
  const out: [number, number][] = [];
  for (const re of res) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f))) {
      const lead = m[1]?.length ?? 0;
      const s = m.index + lead;
      const e = m.index + m[0].length;
      if (e > s) out.push([s, e]);
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

function mergeSpans(spans: [number, number][]): [number, number][] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The filter
// ---------------------------------------------------------------------------

const phraseRe = (list: readonly string[]) => list.map((p) => new RegExp(`(?:^| )${p}(?= |$)`));
/** The same phrases with optional spaces, for letters spaced apart ("s e n d n u d e s" → "sendnudes"). */
const looseRe = (list: readonly string[]) => list.map((p) => new RegExp(`(?:^| )${p.replace(/ /g, " ?")}(?= |$)`));

// Platform words that make a display name a handle ("snap ada22").
const NAME_PLATFORMS = new Set(["snap", "snapchat", "ig", "insta", "instagram", "tg", "telegram", "whatsapp", "wa", "kik", "discord", "tiktok", "fb", "facebook", "onlyfans", "twitter"]);

// Names people must not take (impersonation of the app or its staff).
const RESERVED_NAMES = /^(?:okwu|okwuteam|okwusupport|okwuofficial|okwuapp|admin|administrator|moderator|mod|mods|support|official|staff|system|apple|helpdesk|teamokwu)$/;
const RESERVED_PREFIX = /^(?:admin|moderator|okwuteam|okwusupport|okwuofficial|official|staff)/;

export function createTextFilter(extra: ExtraTerms = {}): OkwuTextFilter {
  const toPhrase = (s: string) => fold(cleanText(s)).f.split(/[^a-z0-9]+/).filter(Boolean).join(" ");
  const extraOf = (l?: readonly string[]) => (l ?? []).map(toPhrase).filter(Boolean).map(escapeRe);
  const badWord = makeWordMatcher(PROFANITY_ANYWHERE, PROFANITY_WHOLE);
  const profanityPhrases = phraseRe([...PROFANITY_PHRASES, ...extraOf(extra.profanity)]);
  const moneyRes = phraseRe([...MONEY_TERMS, ...extraOf(extra.money)]);
  const groomStrong = phraseRe([...GROOMING_STRONG, ...extraOf(extra.grooming)]);
  const groomSoft = phraseRe(GROOMING_SOFT);
  const moneyLoose = looseRe([...MONEY_TERMS, ...extraOf(extra.money)]);
  const groomLoose = looseRe([...GROOMING_STRONG, ...extraOf(extra.grooming)]);
  const contactExtra = extraOf(extra.contact).map((p) => new RegExp(`(^|[^a-z0-9])${p.replace(/ /g, "[^a-z0-9]+")}(?![a-z0-9])`, "g"));

  function scanFolded(t: string, opts: FilterOptions): Scan & { folded: Folded } {
    const folded = fold(t);
    const { raw, leet } = tokens(folded.f);
    const variants = [raw.join(" "), leet.join(" "), joinSingles(leet).join(" ")];
    const any = (res: readonly RegExp[]) => variants.some((v) => res.some((re) => re.test(v)));
    const spaced = variants[2] !== variants[1] ? variants[2]! : null; // only when letters were spaced apart
    const loose = (res: readonly RegExp[]) => spaced !== null && res.some((re) => re.test(spaced));

    let grooming: Scan["grooming"] = null;
    if (any(groomStrong) || loose(groomLoose)) grooming = "strong";
    else if (any(groomSoft)) grooming = "soft";

    const money =
      any(moneyRes) ||
      loose(moneyLoose) ||
      variants.some((v) => (MONEY_ASK.test(v) && MONEY_THING.test(v)) || IGBO_ASK_MONEY.test(v)) ||
      // currency amounts written with symbols survive tokenising only in the raw fold
      (MONEY_ASK.test(variants[1]!) && /[$£€₦]\s?\d|\d\s?[$£€₦]/.test(folded.f));

    const words = leet;
    let profanity = words.some(badWord) || any(profanityPhrases);
    if (!profanity) {
      // Spelled-out letters: "f u c k", "s.h.i.t".
      const short = leet.map((w) => w.replace(/[^a-z]/g, ""));
      for (let a = 0; a < short.length && !profanity; a++) {
        let joined = "";
        for (let b = a; b < short.length && short[b]!.length <= 2; b++) {
          joined += short[b];
          if (joined.length >= 3 && badWord(joined)) {
            profanity = true;
            break;
          }
        }
      }
    }

    const spansF = mergeSpans([...regexSpans(folded.f, CONTACT_RES), ...regexSpans(folded.f, CONTACT_PHRASE_RES), ...regexSpans(folded.f, contactExtra), ...phoneSpans(folded.f)]);
    const contact = spansF.map(([s, e]) => [folded.start[s] ?? 0, folded.end[e - 1] ?? t.length] as [number, number]);
    if (grooming === "soft" && !opts.strict) grooming = null;
    return { grooming, money, profanity, contact: mergeSpans(contact), folded };
  }

  function scan(text: string, opts: FilterOptions = {}): Scan {
    const { grooming, money, profanity, contact } = scanFolded(cleanText(text), opts);
    return { grooming, money, profanity, contact };
  }

  function chat(text: string, maxGraphemes: number, opts: FilterOptions = {}): FilterResult {
    const t = cleanText(text);
    if (!t) return { ok: false, reason: "empty" };
    if (graphemeCount(t) > maxGraphemes) return { ok: false, reason: "too-long" };
    const s = scanFolded(t, opts);
    const reject = rejection(s);
    if (reject) return { ok: false, reason: reject };
    if (!s.contact.length) return { ok: true, text: t, masked: false };
    // "call me on" + "0803…" and "my number" + "is" + "0803…" are one masked span, not "*** ***".
    const spans: [number, number][] = [];
    for (const [a, b] of s.contact) {
      const last = spans[spans.length - 1];
      if (last && /^[\s:,.=-]*(?:is|na|be|at|on)?[\s:,.=-]*$/i.test(t.slice(last[1], a))) last[1] = b;
      else spans.push([a, b]);
    }
    let out = "";
    let at = 0;
    for (const [a, b] of spans) {
      out += t.slice(at, a) + MASK;
      at = b;
    }
    out = cleanText(out + t.slice(at));
    if (!out.replace(/\*+/g, "").replace(/[\s\p{P}\p{S}]/gu, "")) return { ok: false, reason: "contact" };
    return { ok: true, text: out, masked: true };
  }

  function name(text: string, opts: FilterOptions & { maxGraphemes?: number } = {}): FilterResult {
    const t = cleanText(text);
    const n = graphemeCount(t);
    if (n < NAME_MIN) return { ok: false, reason: "empty" };
    if (n > (opts.maxGraphemes ?? NAME_MAX)) return { ok: false, reason: "too-long" };
    const s = scanFolded(t, {});
    const reject = rejection(s);
    if (reject) return { ok: false, reason: reject };
    if (s.contact.length || (s.folded.f.match(/[0-9]/g)?.length ?? 0) >= 5) return { ok: false, reason: "contact" };
    if (s.folded.f.split(/[^a-z0-9]+/).some((w) => NAME_PLATFORMS.has(w))) return { ok: false, reason: "contact" };
    const letters = s.folded.f.replace(/[^a-z]/g, "");
    if (RESERVED_NAMES.test(letters) || RESERVED_PREFIX.test(letters)) return { ok: false, reason: "profanity" };
    return { ok: true, text: t, masked: false };
  }

  return { chat, name, scan };
}

function rejection(s: Pick<Scan, "grooming" | "money" | "profanity">): FilterReason | null {
  if (s.grooming) return "grooming";
  if (s.money) return "money";
  if (s.profanity) return "profanity";
  return null;
}

/** Plain-English reason for the UI ("Why can't I send this?"). */
export const FILTER_MESSAGES: Record<FilterReason, string> = {
  empty: "Write something first.",
  "too-long": "That's too long.",
  profanity: "That isn't allowed here. Please keep it kind.",
  contact: "Phone numbers, links and other apps can't be shared here.",
  money: "Talk about money, payments or investments isn't allowed here.",
  grooming: "That kind of question or request isn't allowed here, for everyone's safety.",
};
