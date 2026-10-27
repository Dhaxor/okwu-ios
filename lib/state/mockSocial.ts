// A development stand-in for the Okwu social server, so every Community
// screen can be built and checked on web before the Worker is deployed.
// It implements the same OkwuSocialClient the real client does, holds a
// seeded, realistic world in memory, and applies the server's real rules:
//   - the tier table (lib/social/rules: `can`, `sameSpace`, `mayBefriend`)
//   - the shared text filter (lib/social/filter) on names, captions and chat
//   - blocks and mutes hide content everywhere, live pushes included
//   - voice notes need the person's own consent, and a teen's guardian's
//   - clubs: adults only, one club each, slow mode, trust to create
//   - the weekly goals rotate as the server's do (lib/social/weekly): the
//     cohort quest, and each Family Circle's challenge (no voice-reply
//     challenge while voice notes are off)
//   - a teen is told which circle members can be their guardian
// Errors are the same SocialErrors the real client throws.
//
// Used only in development builds with EXPO_PUBLIC_OKWU_API unset
// (lib/state/SocialProvider). Never in a release build. Pure TypeScript,
// tested in mockSocial.test.ts.
//
// Codes to try in "Add a friend": ADA2345 (same tier as you, sends a
// request), MAN4567 (an adult outside your circle: a teen gets "not found",
// as from the server), OBI3456 (accepts at once).
import { LIMITS, REPORT_REASONS, can, mayBefriend, sameSpace, type SocialFeature } from "@/lib/social";
import { COHORT_GOALS, cohortGoalFor, familyChallengeFor, familyTarget, mondayOf, nextMonday, type CohortGoalKind } from "@/lib/social/weekly";
import type { Attempt, CredsStore, LobbyConnection, LobbyHandlers, OkwuSocialClient } from "@/lib/social/client";
import { SocialError, memoryCredsStore } from "@/lib/social/client";
import { createTextFilter } from "@/lib/social/filter";
import type {
  AccountId,
  AgeSignal,
  AgeTier,
  AppealView,
  CircleId,
  CircleMemberView,
  CircleView,
  ClubId,
  ClubMessage,
  ClubRole,
  ClubSummary,
  ClubViewExt,
  CohortId,
  CohortReaction,
  CohortView,
  ConsentRecord,
  Creds,
  FamilyChallengeKind,
  FamilyChallengeView,
  FriendCode,
  FriendsView,
  GuardianLink,
  MyAccountView,
  PublicProfile,
  ReactionId,
  Relation,
  ReportId,
  ReportInput,
  Sanction,
  SocialConfig,
  SocialErrorCode,
  TrustLevel,
  VoiceNoteView,
  WireError,
  AvatarId,
} from "@/lib/social";
import { REQUIRED_CONSENTS } from "@/lib/social";
import { DEFAULT_SOCIAL_CONFIG } from "./social";

export interface MockControls {
  readonly tier: AgeTier;
  /** Re-seed the world for an adult or a teen. */
  setTier(tier: AgeTier): void;
  readonly offline: boolean;
  setOffline(on: boolean): void;
  /** A guardian in the teen's circle says yes (the adult's side, simulated). */
  approveGuardian(): void;
  /** A moderator mutes this account for a day (to check the appeals flow). */
  addSanction(): void;
  /** The server's voice-notes flag (off until R2 is enabled). Off also retires a voice-reply challenge. */
  readonly voiceNotes: boolean;
  setVoiceNotes(on: boolean): void;
  /** This week's family challenge in every circle: pick a kind (null: the rotation's own). */
  readonly challengeKind: FamilyChallengeKind | null;
  setChallengeKind(kind: FamilyChallengeKind | null): void;
  /** The family finishes this week's challenge (the celebration). */
  finishChallenge(): void;
  /** The cohort's weekly goal kind (null: the rotation's own). */
  readonly cohortGoal: CohortGoalKind | null;
  setCohortGoal(kind: CohortGoalKind | null): void;
  reports(): readonly ReportInput[];
  /** Subscribe to world changes (the Community screens refresh). */
  subscribe(fn: () => void): () => void;
}

export interface MockOptions {
  creds?: CredsStore;
  tier?: AgeTier;
  now?: () => Date;
  /** Simulated network time per call (default 150 ms; tests pass 0). */
  latencyMs?: number;
  /** A playable uri for a seeded note (the app passes a bundled development clip). */
  audioUri?: (key: string) => Promise<string | null>;
  /** The live socket's first club line after connecting (ms; 0 turns it off). */
  liveLineMs?: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Person {
  id: AccountId;
  code: FriendCode;
  name: string;
  avatar: AvatarId;
  tier: AgeTier;
  online: boolean;
}

interface Member {
  id: AccountId;
  role: "keeper" | "member";
  relation?: Relation;
  joinedAt: string;
}

interface MockCircle {
  id: CircleId;
  name: string;
  keeper: AccountId;
  members: Member[];
  invite: { code: string; expiresAt: string };
  notes: VoiceNoteView[];
  guardians: GuardianLink[];
  uris: Map<string, string>;
}

/** This week's family challenge in a circle: the rest of the family's part (`others`, `helpers`) and mine. */
interface MockChallenge {
  week: string;
  kind: FamilyChallengeKind;
  target: number;
  /** What the rest of the family has done (seeded). */
  others: number;
  helpers: AccountId[];
  mine: { lessons: number; words: number; replies: string[] };
  completedAt: string | null;
}

interface MockClub {
  summary: ClubSummary;
  code: string;
  slowModeSeconds: number;
  members: { id: AccountId; role: ClubRole; joinedAt: string }[];
  messages: ClubMessage[];
}

interface World {
  me: Person & { consents: ConsentRecord[]; createdAt: string; age: AgeSignal | null; appleLinked: boolean; sanctions: Sanction[] };
  people: Map<string, Person>;
  friends: Map<string, { since: string; streak: { days: number; lastBoth: string } | null }>;
  incoming: { from: AccountId; at: string; via: "code" | "circle" }[];
  outgoing: AccountId[];
  blocked: Set<string>;
  muted: Set<string>;
  circles: MockCircle[];
  /** `share`: how far the rest of the cohort is towards whatever this week's goal is (0..1). */
  cohort: { id: CohortId; startWeek: string; tier: AgeTier; members: AccountId[]; share: number; reactions: CohortReaction[]; mine: { reviews: number; lessons: number; minutes: number } };
  challenges: Map<string, MockChallenge>;
  clubs: MockClub[];
  myClub: ClubId | null;
  lastClubPost: number;
  reports: ReportInput[];
  appeals: AppealView[];
  nextMsg: number;
  seq: number;
}

const ME = "a_me000000000000000000" as AccountId;

function person(id: string, code: string, name: string, tier: AgeTier, avatar = "default", online = false): Person {
  return { id: id as AccountId, code: code as FriendCode, name, avatar: avatar as AvatarId, tier, online };
}


function seed(tier: AgeTier, now: number): World {
  const iso = (ago: number) => new Date(now - ago).toISOString();
  const adult = tier === "adult";
  const me: World["me"] = {
    ...person(ME, "K7Q2M9P", adult ? "Ada" : "Chiamaka", tier, "default", true),
    consents: [],
    createdAt: iso(40 * DAY),
    age: { tier, source: "self-declared", at: iso(40 * DAY) },
    appleLinked: false,
    sanctions: [],
  };
  const P = {
    mama: person("a_mama0000000000000000", "MAM2345", "Mama Ngozi", "adult", "default", true),
    papa: person("a_papa0000000000000000", "PAP2345", "Papa Chidi", "adult"),
    uncle: person("a_uncl0000000000000000", "UNC2345", "Uncle Emeka", "adult"),
    cousin: person("a_cous0000000000000000", "COU2345", adult ? "Chiamaka" : "Obinna", "teen", "default", true),
    ifeoma: person("a_ifeo0000000000000000", "IFE2345", "Ifeoma", "adult", "default", true),
    tobi: person("a_tobi0000000000000000", "TOB2345", "Tobi", "adult"),
    grace: person("a_grac0000000000000000", "GRA2345", "Grace", "adult"),
    daniel: person("a_dani0000000000000000", "DAN2345", "Daniel", "adult"),
    kelechi: person("a_kele0000000000000000", "KEL2345", "Kelechi", "teen", "default", true),
    zara: person("a_zara0000000000000000", "ZAR2345", "Zara", "teen"),
    // Codes for "Add a friend" in development.
    ada: person("a_adac0000000000000000", "ADA2345", adult ? "Amara" : "Nkem", tier),
    obi: person("a_obic0000000000000000", "OBI3456", adult ? "Oluchi" : "Somto", tier),
    stranger: person("a_strn0000000000000000", "MAN4567", "Mike", "adult"),
    // A teen's grown-up sister: an adult that a "keepers and parents" guess would miss.
    sister: person("a_sist0000000000000000", "SIS2345", "Adaeze", "adult"),
  };
  const cohortNames = adult
    ? ["Ngozi O.", "Kemi", "Sam", "Uche", "Bola", "Rita", "Jide", "Ann", "Femi", "Lara", "Dayo", "Joy", "Tunde"]
    : ["Kelechi", "Zara", "Tolu", "Ebube", "Mira", "Dami", "Ike", "Sade", "Jo", "Ola"];
  const cohortPeople = cohortNames.map((n, i) => person(`a_coh${String(i).padStart(17, "0")}`, "", n, tier));
  const people = new Map<string, Person>();
  for (const p of [...Object.values(P), ...cohortPeople]) people.set(p.id, p);

  // Family Circle. Adult: you keep it; a teen cousin asks you to be her guardian.
  // Teen: Mama keeps it; nobody has said yes to your voice notes yet.
  const circleId = "f_okafor01" as CircleId;
  const members: Member[] = adult
    ? [
        { id: ME, role: "keeper", joinedAt: iso(30 * DAY) },
        { id: P.mama.id, role: "member", relation: "parent", joinedAt: iso(29 * DAY) },
        { id: P.uncle.id, role: "member", relation: "aunt-uncle", joinedAt: iso(20 * DAY) },
        { id: P.cousin.id, role: "member", relation: "cousin", joinedAt: iso(12 * DAY) },
      ]
    : [
        { id: P.mama.id, role: "keeper", relation: "parent", joinedAt: iso(30 * DAY) },
        { id: P.papa.id, role: "member", relation: "parent", joinedAt: iso(29 * DAY) },
        { id: ME, role: "member", relation: "child", joinedAt: iso(28 * DAY) },
        { id: P.sister.id, role: "member", relation: "sibling", joinedAt: iso(27 * DAY) },
        { id: P.cousin.id, role: "member", relation: "cousin", joinedAt: iso(14 * DAY) },
        { id: P.uncle.id, role: "member", relation: "aunt-uncle", joinedAt: iso(10 * DAY) },
      ];
  const note = (id: string, from: Person, ago: number, durationMs: number, caption?: string, to: AccountId | null = null): VoiceNoteView => ({
    id,
    circle: circleId,
    from: from.id,
    to,
    ...(caption ? { caption } : {}),
    audioKey: `notes/${circleId}/${id}`,
    durationMs,
    createdAt: iso(ago),
    author: { id: from.id, code: from.code, displayName: from.name, avatar: from.avatar },
    audioPath: `/api/circles/${circleId}/notes/${id}/audio`,
  });
  const notes: VoiceNoteView[] = [
    note("v_n1", P.mama, 2 * HOUR, 14_000, "How we greet Grandma in the morning. Say it back to me!", ME),
    note("v_n2", P.uncle, 26 * HOUR, 31_000, "The proverb my father always used at the table"),
    note("v_n3", adult ? P.cousin : P.papa, 3 * DAY, 9_000, adult ? "My first try at counting to ten" : "Your name, and what it means"),
  ];
  const guardians: GuardianLink[] = adult ? [{ teen: P.cousin.id, guardian: ME, status: "pending", at: iso(5 * HOUR) }] : [];

  const friends = new Map<string, { since: string; streak: { days: number; lastBoth: string } | null }>();
  const friendList = adult
    ? ([
        [P.ifeoma, 12],
        [P.tobi, 4],
        [P.grace, 0],
      ] as const)
    : ([
        [P.kelechi, 6],
        [P.zara, 0],
      ] as const);
  for (const [p, days] of friendList) friends.set(p.id, { since: iso(25 * DAY), streak: days ? { days, lastBoth: new Date(now - DAY).toISOString().slice(0, 10) } : null });

  const reaction = (p: Person, r: ReactionId, ago: number): CohortReaction => ({ from: { id: p.id, code: "" as FriendCode, displayName: p.name, avatar: p.avatar }, reaction: r, at: iso(ago) });
  const members5 = [ME, ...cohortPeople.map((p) => p.id)];

  const clubs: MockClub[] = adult
    ? [
        club("c_begin01", "Igbo for Beginners", "sprout", "First words, first sentences. Ask anything, and nobody minds a mistake.", 24, 0),
        club("c_herit01", "Heritage Speakers UK", "users", "For those of us who understand more than we say. Speaking practice, gently.", 18, 10),
        club("c_prov001", "Proverbs at the Table", "book", "One proverb a day, what it means, and when your family uses it.", 12, 0),
        club("c_toron01", "Toronto Learners", "languages", "Learners in Canada. Weekly words and a monthly meet-up online.", 9, 0),
        club("c_tone001", "Tone Practice", "audio", "High, low, downstep. Practise the pairs that trip us up.", 30, 0),
      ]
    : [];
  const clubNames = ["Nneka", "Paul", "Ijeoma", "Kunle", "Mary", "Chuka", "Halima", "Ken", "Adaeze", "Seun", "Ruth", "Emeka O.", "Lola", "Victor", "Nora", "Ike", "Fola", "Sandra", "Gbenga", "Ama", "Chris", "Efe", "Uju", "Wale", "Bisi", "Dozie"];
  const clubPool = [P.ifeoma, P.tobi, P.grace, P.daniel, ...clubNames.map((n, i) => person(`a_clb${String(i).padStart(17, "0")}`, "", n, "adult"))];
  if (adult) for (const p of clubPool) people.set(p.id, p);
  clubs.forEach((c, k) => {
    // A different slice of the pool per club, so each has its own owner and officers.
    const at = [3, 0, 6, 9, 12][k] ?? 0;
    const pool = [...clubPool.slice(at), ...clubPool.slice(0, at)];
    c.members = pool.slice(0, c.summary.memberCount).map((p, i) => ({ id: p.id, role: i === 0 ? "owner" : i === 1 ? "officer" : "member", joinedAt: iso((20 - (i % 20)) * DAY) }));
  });
  const her = clubs.find((c) => c.summary.id === ("c_herit01" as ClubId));
  let nextMsg = 100;
  if (her) {
    const line = (p: Person, text: string, ago: number): ClubMessage => ({ id: nextMsg++, club: her.summary.id, author: { id: p.id, code: "" as FriendCode, displayName: p.name, avatar: p.avatar }, text, at: iso(ago) });
    her.messages = [
      line(P.ifeoma, "Good evening everyone. Who practised today?", 50 * 60_000),
      line(P.tobi, "I did the greetings unit again. The tones on the second word still catch me.", 46 * 60_000),
      line(P.grace, "Same here. Saying it slowly with the pitch line helped me.", 41 * 60_000),
      line(P.daniel, "Happy to practise together, find me on ***", 33 * 60_000),
      line(P.ifeoma, "Let's keep practice here in the club, please. Thank you!", 31 * 60_000),
      line(P.tobi, "My aunty laughed at my accent on the phone, but she understood me. Small wins.", 12 * 60_000),
    ];
  }

  return {
    me,
    people,
    friends,
    incoming: adult ? [{ from: P.daniel.id, at: iso(3 * HOUR), via: "code" }] : [{ from: P.mama.id, at: iso(6 * HOUR), via: "circle" }],
    outgoing: [],
    blocked: new Set(),
    muted: new Set(),
    circles: [{ id: circleId, name: "Okafor family", keeper: adult ? ME : P.mama.id, members, invite: { code: "OKFAMK7Q2M", expiresAt: iso(-6 * DAY) }, notes, guardians, uris: new Map() }],
    challenges: new Map([[circleId, seedChallenge(circleId, members.length, now, true, adult ? [ME, P.mama.id, P.uncle.id] : [P.mama.id, ME, P.sister.id])]]),
    cohort: {
      id: (adult ? "o_adult001" : "o_teen0001") as CohortId,
      startWeek: mondayOf(now - 14 * DAY),
      tier,
      members: members5,
      share: adult ? 0.55 : 0.32,
      reactions: adult
        ? [reaction(cohortPeople[0]!, "well-done", 40 * 60_000), reaction(cohortPeople[3]!, "keep-going", 3 * HOUR), reaction(cohortPeople[7]!, "welcome", 26 * HOUR)]
        : [reaction(cohortPeople[0]!, "keep-going", 90 * 60_000), reaction(cohortPeople[2]!, "well-done", 9 * HOUR)],
      mine: { reviews: 41, lessons: 3, minutes: 38 },
    },
    clubs,
    myClub: null,
    lastClubPost: 0,
    reports: [],
    appeals: [],
    nextMsg,
    seq: 0,
  };
}

/** A family a little over half way through this week's challenge, with a few helpers. */
function seedChallenge(circle: string, members: number, now: number, voiceNotes: boolean, helpers: AccountId[], kind?: FamilyChallengeKind): MockChallenge {
  const week = mondayOf(now);
  const pick = familyChallengeFor(circle, week, { voiceNotes, members });
  const k = kind ?? pick.kind;
  const target = kind ? familyTarget(kind, members) : pick.target;
  const mine = helpers.includes(ME) ? (k === "lessons" ? 2 : k === "words" ? 6 : 1) : 0;
  return {
    week,
    kind: k,
    target,
    others: helpers.length ? Math.max(0, Math.round(target * 0.6) - mine) : 0,
    helpers: helpers.filter((h) => h !== ME),
    mine: { lessons: k === "lessons" ? mine : 0, words: k === "words" ? mine : 0, replies: k === "voice-replies" && mine ? ["v_seed"] : [] },
    completedAt: null,
  };
}

function club(id: string, name: string, badge: string, description: string, memberCount: number, slow: number): MockClub {
  return {
    summary: { id: id as ClubId, name, badge, description, open: true, memberCount, maxMembers: LIMITS.clubMaxMembers },
    code: `${id.slice(2, 6).toUpperCase()}7K`,
    slowModeSeconds: slow,
    members: [],
    messages: [],
  };
}

function fail(code: SocialErrorCode, extra: Partial<WireError> = {}): never {
  const STATUS: Partial<Record<SocialErrorCode, number>> = { unauthorized: 401, "not-found": 404, already: 409, conflict: 409, limit: 409, full: 409, filtered: 422, "slow-down": 429, "bad-request": 400, "too-large": 413 };
  throw new SocialError("api", STATUS[code] ?? 403, { error: code, ...extra });
}

export function createMockSocialClient(options: MockOptions = {}): OkwuSocialClient & { mock: MockControls } {
  const store = options.creds ?? memoryCredsStore();
  const now = () => (options.now ? options.now() : new Date()).getTime();
  const latency = options.latencyMs ?? 150;
  const liveLineMs = options.liveLineMs ?? 2500;
  const filter = createTextFilter();
  let tier: AgeTier = options.tier ?? "adult";
  let w = seed(tier, now());
  let offline = false;
  const listeners = new Set<() => void>();
  const changed = () => {
    w.seq++;
    for (const fn of listeners) fn();
  };
  const lobbies = new Set<LobbyHandlers>();

  const config: SocialConfig = { ...DEFAULT_SOCIAL_CONFIG, flags: { clubs: true, voiceNotes: true, push: false } };
  let challengeKind: FamilyChallengeKind | null = null;
  let cohortGoal: CohortGoalKind | null = null;
  const iso = (t = now()) => new Date(t).toISOString();

  async function call<T>(fn: () => T | Promise<T>, opts: { auth?: boolean } = { auth: true }): Promise<T> {
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));
    if (offline) throw new SocialError("offline", 0);
    if (opts.auth !== false && !(await store.load())) fail("unauthorized");
    return fn();
  }

  const hidden = (id: string) => w.blocked.has(id) || w.muted.has(id);
  const pub = (p: Person, revealCode: boolean): PublicProfile => ({ id: p.id, code: (revealCode ? p.code : "") as FriendCode, displayName: p.name, avatar: p.avatar });
  const meProfile = (reveal = true): PublicProfile => pub(w.me, reveal);
  const profileOf = (id: string, reveal: boolean): PublicProfile | null => (id === ME ? meProfile(reveal) : w.people.has(id) ? pub(w.people.get(id)!, reveal) : null);
  const tierOf = (id: string): AgeTier => (id === ME ? w.me.tier : (w.people.get(id)?.tier ?? "teen"));
  const shareCircle = (a: string, b: string) => w.circles.some((c) => c.members.some((m) => m.id === a) && c.members.some((m) => m.id === b));
  const has = (kind: ConsentRecord["kind"], version?: string) => w.me.consents.some((c) => c.kind === kind && (!version || c.version === version));
  const needFeature = (feature: SocialFeature) => {
    if (!can(w.me.tier, feature, config.flags)) fail(feature === "clubs" || feature === "club-chat" ? (w.me.tier === "adult" ? "feature-off" : "forbidden-age") : "forbidden-age");
  };
  const muted = () => w.me.sanctions.find((s) => s.kind === "mute" && Date.parse(s.until) > now());
  const requireUnmuted = () => {
    const m = muted();
    if (m) fail("muted", { until: m.until });
  };
  const trust = (): TrustLevel => (now() - Date.parse(w.me.createdAt) >= 3 * DAY && !w.me.sanctions.length ? 2 : 1);

  function account(): MyAccountView {
    const needs = REQUIRED_CONSENTS.filter((k) => !has(k, config.versions[k]));
    const mute = muted();
    return {
      ...meProfile(true),
      age: w.me.age,
      appleLinked: w.me.appleLinked,
      consents: [...w.me.consents],
      createdAt: w.me.createdAt,
      standing: { mutedUntil: mute ? mute.until : null, suspendedUntil: null, trust: trust(), sanctions: [...w.me.sanctions] },
      needsConsent: needs,
      ageLocked: true,
      config,
    };
  }

  // ---- circles ----
  function voiceNeeds(): ("voice-notes" | "guardian")[] {
    const needs: ("voice-notes" | "guardian")[] = [];
    if (!has("voice-notes", config.versions["voice-notes"])) needs.push("voice-notes");
    if (w.me.tier === "teen" && !w.circles.some((c) => c.guardians.some((g) => g.teen === ME && g.status === "granted"))) needs.push("guardian");
    return needs;
  }
  /** This week's challenge for a circle (a new week starts a new one). */
  function challengeOf(c: MockCircle): MockChallenge {
    const t = now();
    const voice = config.flags.voiceNotes !== false;
    let ch = w.challenges.get(c.id);
    if (!ch || ch.week !== mondayOf(t)) {
      ch = seedChallenge(c.id, c.members.length, t, voice, [], challengeKind ?? undefined);
      w.challenges.set(c.id, ch);
    }
    if (ch.kind === "voice-replies" && !voice && !ch.completedAt) {
      // Voice notes switched off: a challenge nobody could finish becomes one they can (as the server does).
      const next = familyChallengeFor(c.id, ch.week, { voiceNotes: false, members: c.members.length });
      Object.assign(ch, { kind: next.kind, target: next.target, others: Math.min(ch.others, next.target - 1) });
    }
    return ch;
  }
  function challengeView(c: MockCircle): FamilyChallengeView {
    const ch = challengeOf(c);
    const mine = ch.kind === "lessons" ? ch.mine.lessons : ch.kind === "words" ? ch.mine.words : ch.mine.replies.length;
    const total = Math.min(ch.target, ch.others + mine);
    if (total >= ch.target && !ch.completedAt) ch.completedAt = iso();
    const helpers = new Set<string>([...ch.helpers, ...(mine > 0 ? [ME] : [])]);
    return {
      circle: c.id,
      week: ch.week,
      kind: ch.kind,
      target: ch.target,
      progress: total,
      mine,
      helpers: c.members.filter((m) => helpers.has(m.id) && !hidden(m.id)).map((m) => profileOf(m.id, true)!),
      completed: !!ch.completedAt,
      completedAt: ch.completedAt,
      endsAt: new Date(nextMonday(now())).toISOString(),
    };
  }
  function circleView(c: MockCircle): CircleView {
    const needs = voiceNeeds();
    const teen = w.me.tier === "teen";
    return {
      id: c.id,
      name: c.name,
      members: c.members
        .filter((m) => !w.blocked.has(m.id))
        .map(
          (m): CircleMemberView => ({
            profile: profileOf(m.id, true)!,
            role: m.role,
            ...(m.relation ? { relation: m.relation } : {}),
            joinedAt: m.joinedAt,
            // Only a teen is told who may be their guardian: the adults here they haven't blocked.
            ...(teen ? { canBeGuardian: m.id !== ME && tierOf(m.id) === "adult" && !w.blocked.has(m.id) } : {}),
          })
        ),
      ...(c.keeper === ME ? { invite: { ...c.invite } } : {}),
      maxMembers: LIMITS.circleMaxMembers,
      myRole: c.keeper === ME ? "keeper" : "member",
      hasTeen: c.members.some((m) => tierOf(m.id) === "teen"),
      guardians: c.guardians.map((g) => ({ ...g })),
      voice: { canSend: needs.length === 0 && !muted(), needs },
      challenge: challengeView(c),
    };
  }
  const myCircle = (id: CircleId) => {
    const c = w.circles.find((x) => x.id === id && x.members.some((m) => m.id === ME));
    if (!c) fail("not-found");
    return c;
  };

  // ---- clubs ----
  function clubView(c: MockClub): ClubViewExt {
    const mine = w.myClub === c.summary.id;
    const me = c.members.find((m) => m.id === ME);
    return {
      club: { ...c.summary, memberCount: c.members.length },
      role: mine ? (me?.role ?? "member") : null,
      members: c.members.filter((m) => !w.blocked.has(m.id)).map((m) => ({ profile: profileOf(m.id, false)!, role: m.role, joinedAt: m.joinedAt })),
      ...(mine ? { inviteCode: c.code } : {}),
      slowModeSeconds: c.slowModeSeconds,
      trust: trust(),
      mutedUntil: null,
    };
  }
  const myClubOrFail = () => {
    const c = w.clubs.find((x) => x.summary.id === w.myClub);
    if (!c) fail("not-found");
    return c;
  };
  const push = (msg: Parameters<LobbyHandlers["onMessage"]>[0]) => {
    for (const h of lobbies) h.onMessage(msg);
  };

  const client: OkwuSocialClient & { mock: MockControls } = {
    config: () => call(() => ({ ...config }), { auth: false }),
    creds: () => store.load(),

    // ---- accounts ----
    async ensureAccount(input) {
      const existing = await store.load();
      if (existing) return client.me();
      return call(
        async () => {
          if (input.age.tier !== w.me.tier) {
            tier = input.age.tier;
            w = seed(tier, now());
          }
          const n = filter.name(input.displayName);
          if (n.ok) w.me.name = n.text;
          for (const c of input.consents) recordConsent(c);
          const creds: Creds = { id: ME, token: `mock-${now().toString(36)}` };
          await store.save(creds);
          changed();
          return account();
        },
        { auth: false }
      );
    },
    async signInWithApple() {
      return call(
        async () => {
          w.me.appleLinked = true;
          await store.save({ id: ME, token: `mock-apple-${now().toString(36)}` });
          changed();
          return { account: account(), switched: false };
        },
        { auth: false }
      );
    },
    me: () => call(() => account()),
    updateMe: (patch) =>
      call(() => {
        requireUnmuted();
        if (patch.displayName !== undefined) {
          const n = filter.name(patch.displayName);
          if (!n.ok) fail("filtered", { reason: n.reason });
          w.me.name = n.text;
        }
        if (patch.avatar) w.me.avatar = patch.avatar;
        changed();
        return account();
      }),
    setAge: (age) =>
      call(() => {
        if (age.tier !== w.me.tier) {
          tier = age.tier;
          const consents = w.me.consents;
          w = seed(tier, now());
          w.me.consents = consents;
          changed();
        }
        return account();
      }),
    recordConsent: (c) => call(() => void recordConsent(c)),
    deleteAccount: () =>
      call(async () => {
        await store.save(null);
        w = seed(tier, now());
        changed();
      }),
    async signOut() {
      await store.save(null);
      changed();
    },
    recordProgress: (input) =>
      call(() => {
        w.cohort.mine = { reviews: Math.max(w.cohort.mine.reviews, input.reviews), lessons: Math.max(w.cohort.mine.lessons, input.lessons), minutes: Math.max(w.cohort.mine.minutes, input.minutes) };
        // The family challenge counts this week's lessons and new words, in every circle.
        for (const c of w.circles) {
          if (!c.members.some((m) => m.id === ME)) continue;
          const ch = challengeOf(c);
          ch.mine.lessons = Math.max(ch.mine.lessons, input.lessons);
          ch.mine.words = Math.max(ch.mine.words, input.words ?? 0);
        }
        changed();
        return cohortView();
      }),

    // ---- friends ----
    friends: () =>
      call((): FriendsView => {
        needFeature("friends-by-code");
        return {
          code: w.me.code,
          friends: [...w.friends.entries()]
            .filter(([id]) => !w.blocked.has(id))
            .map(([id, f]) => ({ profile: profileOf(id, true)!, since: f.since, streak: f.streak, online: w.people.get(id)?.online ?? false })),
          incoming: w.incoming.filter((r) => !w.blocked.has(r.from)).map((r) => ({ from: profileOf(r.from, true)!, at: r.at, via: r.via })),
          outgoing: w.outgoing.map((id) => profileOf(id, true)!),
          blocked: [...w.blocked] as AccountId[],
        };
      }),
    requestFriend: (code) =>
      call(() => {
        needFeature("friends-by-code");
        const c = String(code ?? "").trim().toUpperCase();
        if (c === w.me.code) fail("bad-request");
        const to = [...w.people.values()].find((p) => p.code && p.code === c);
        if (!to) fail("not-found");
        if (w.blocked.has(to.id)) fail("blocked");
        // Across age tiers only through a shared circle: the same answer as a wrong code.
        if (!mayBefriend(w.me.tier, to.tier, shareCircle(ME, to.id))) fail("not-found");
        if (w.friends.has(to.id)) fail("already");
        if (w.friends.size >= LIMITS.maxFriends) fail("limit");
        if (to.code === "OBI3456") {
          w.friends.set(to.id, { since: iso(), streak: null });
          changed();
          return { status: "friends" as const };
        }
        if (!w.outgoing.includes(to.id)) w.outgoing.push(to.id);
        changed();
        return { status: "sent" as const };
      }),
    respondFriend: (id, accept) =>
      call(() => {
        const r = w.incoming.find((x) => x.from === id);
        if (!r) fail("not-found");
        w.incoming = w.incoming.filter((x) => x.from !== id);
        if (accept) {
          if (!mayBefriend(w.me.tier, tierOf(id), shareCircle(ME, id))) fail("not-found");
          w.friends.set(id, { since: iso(), streak: null });
        }
        changed();
      }),
    removeFriend: (id) =>
      call(() => {
        w.friends.delete(id);
        w.outgoing = w.outgoing.filter((x) => x !== id);
        changed();
      }),
    block: (id) =>
      call(() => {
        if (id === ME) fail("bad-request");
        w.blocked.add(id);
        w.friends.delete(id);
        w.incoming = w.incoming.filter((r) => r.from !== id);
        w.outgoing = w.outgoing.filter((x) => x !== id);
        changed();
      }),
    unblock: (id) =>
      call(() => {
        w.blocked.delete(id);
        changed();
      }),
    mute: (id) =>
      call(() => {
        if (id === ME) fail("bad-request");
        w.muted.add(id);
        changed();
      }),
    unmute: (id) =>
      call(() => {
        w.muted.delete(id);
        changed();
      }),

    // ---- Family Circle ----
    myCircles: () =>
      call(() => {
        needFeature("family-circle");
        return w.circles.filter((c) => c.members.some((m) => m.id === ME)).map(circleView);
      }),
    createCircle: (name) =>
      call(() => {
        needFeature("family-circle");
        requireUnmuted();
        const n = filter.name(name, { maxGraphemes: 30 });
        if (!n.ok) fail("filtered", { reason: n.reason });
        if (w.circles.filter((c) => c.members.some((m) => m.id === ME)).length >= 5) fail("limit");
        const c: MockCircle = {
          id: `f_new${now().toString(36)}` as CircleId,
          name: n.text,
          keeper: ME,
          members: [{ id: ME, role: "keeper", joinedAt: iso() }],
          invite: { code: "NEWFAM2345", expiresAt: iso(now() + 7 * DAY) },
          notes: [],
          guardians: [],
          uris: new Map(),
        };
        w.circles.push(c);
        changed();
        return circleView(c);
      }),
    joinCircle: (inviteCode, relation) =>
      call(() => {
        needFeature("family-circle");
        const code = String(inviteCode ?? "").trim().toUpperCase();
        if (!/^[A-Z2-9]{10}$/.test(code)) fail("not-found");
        let c = w.circles.find((x) => x.invite.code === code);
        if (c?.members.some((m) => m.id === ME)) fail("already");
        if (!c) {
          // Any well-formed code joins a small seeded circle in development.
          c = { id: `f_join${now().toString(36)}` as CircleId, name: "The Nwosu family", keeper: "a_uncl0000000000000000" as AccountId, members: [{ id: "a_uncl0000000000000000" as AccountId, role: "keeper", relation: "aunt-uncle", joinedAt: iso(now() - 9 * DAY) }], invite: { code, expiresAt: iso(now() + 3 * DAY) }, notes: [], guardians: [], uris: new Map() };
          w.circles.push(c);
        }
        if (c.members.length >= LIMITS.circleMaxMembers) fail("full");
        c.members.push({ id: ME, role: "member", ...(relation ? { relation } : {}), joinedAt: iso() });
        changed();
        return circleView(c);
      }),
    leaveCircle: (id) =>
      call(() => {
        const c = myCircle(id);
        c.members = c.members.filter((m) => m.id !== ME);
        c.guardians = c.guardians.filter((g) => g.teen !== ME && g.guardian !== ME);
        if (c.keeper === ME && c.members.length) {
          const heir = c.members.find((m) => tierOf(m.id) === "adult") ?? c.members[0]!;
          c.keeper = heir.id;
          heir.role = "keeper";
        }
        if (!c.members.length) w.circles = w.circles.filter((x) => x !== c);
        changed();
      }),
    rotateInvite: (id) =>
      call(() => {
        const c = myCircle(id);
        if (c.keeper !== ME) fail("not-found");
        c.invite = { code: Array.from({ length: 10 }, (_, i) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[(now() / 997 + i * 7) % 32 | 0]).join(""), expiresAt: iso(now() + 7 * DAY) };
        changed();
        return circleView(c);
      }),
    removeFromCircle: (id, accountId) =>
      call(() => {
        const c = myCircle(id);
        if (c.keeper !== ME || accountId === ME || !c.members.some((m) => m.id === accountId)) fail("not-found");
        c.members = c.members.filter((m) => m.id !== accountId);
        c.guardians = c.guardians.filter((g) => g.teen !== accountId && g.guardian !== accountId);
        changed();
        return circleView(c);
      }),
    requestGuardian: (id, guardian) =>
      call(() => {
        const c = myCircle(id);
        if (w.me.tier !== "teen") fail("forbidden-age");
        if (!c.members.some((m) => m.id === guardian) || w.blocked.has(guardian)) fail("not-found");
        if (tierOf(guardian) !== "adult") fail("forbidden-age");
        if (c.guardians.some((g) => g.teen === ME && g.guardian === guardian)) fail("already");
        c.guardians.push({ teen: ME, guardian, status: "pending", at: iso() });
        changed();
        return circleView(c);
      }),
    grantGuardian: (id, teen) =>
      call(() => {
        const c = myCircle(id);
        if (w.me.tier !== "adult") fail("forbidden-age");
        const link = c.guardians.find((g) => g.teen === teen && g.guardian === ME);
        if (!link) fail("not-found");
        if (link.status === "granted") fail("already");
        link.status = "granted";
        link.at = iso();
        changed();
        return circleView(c);
      }),
    revokeGuardian: (id, other) =>
      call(() => {
        const c = myCircle(id);
        const before = c.guardians.length;
        c.guardians = c.guardians.filter((g) => !((g.teen === ME && g.guardian === other) || (g.teen === other && g.guardian === ME)));
        if (before === c.guardians.length) fail("not-found");
        changed();
        return circleView(c);
      }),
    voiceNotes: (id) =>
      call(() => {
        const c = myCircle(id);
        return c.notes.filter((n) => !hidden(n.from)).map((n) => ({ ...n }));
      }),
    familyChallenge: (id) =>
      call(() => {
        needFeature("family-circle");
        return challengeView(myCircle(id));
      }),
    sendVoiceNote: (id, input) =>
      call(() => {
        const c = myCircle(id);
        if (config.flags.voiceNotes === false) fail("closed");
        requireUnmuted();
        const needs = voiceNeeds();
        if (needs.length) fail("consent-required", { needs });
        const ms = Math.round(input.audio.durationMs);
        if (ms < 300 || ms > LIMITS.voiceNoteMaxMs) fail("bad-request");
        if (input.to && (!c.members.some((m) => m.id === input.to) || input.to === ME)) fail("not-found");
        let caption: string | undefined;
        if (input.caption?.trim()) {
          const r = filter.chat(input.caption, 120, { strict: circleView(c).hasTeen });
          if (!r.ok) fail("filtered", { reason: r.reason });
          caption = r.text;
        }
        const nid = `v_${now().toString(36)}`;
        const n: VoiceNoteView = {
          id: nid,
          circle: c.id,
          from: ME,
          to: input.to,
          ...(caption ? { caption } : {}),
          audioKey: `notes/${c.id}/${nid}`,
          durationMs: ms,
          createdAt: iso(),
          author: meProfile(true),
          audioPath: `/api/circles/${c.id}/notes/${nid}/audio`,
        };
        c.uris.set(nid, input.audio.uri);
        // An answer to a prompt (a note addressed to me) counts once towards a voice-reply challenge.
        const prompt = c.notes.find((x) => x.to === ME && x.from !== ME && (input.replyTo ? x.id === input.replyTo : x.from === input.to));
        const ch = challengeOf(c);
        if (prompt && !ch.mine.replies.includes(prompt.id)) ch.mine.replies.push(prompt.id);
        c.notes.unshift(n);
        changed();
        return { ...n };
      }),
    deleteVoiceNote: (id, noteId) =>
      call(() => {
        const c = myCircle(id);
        const n = c.notes.find((x) => x.id === noteId);
        if (!n || (n.from !== ME && c.keeper !== ME)) fail("not-found");
        c.notes = c.notes.filter((x) => x.id !== noteId);
        changed();
      }),
    async audioSource(note) {
      const m = /\/api\/circles\/([^/]+)\/notes\/([^/]+)\/audio/.exec(note.audioPath);
      const c = w.circles.find((x) => x.id === m?.[1]);
      const own = m?.[2] ? c?.uris.get(m[2]) : undefined;
      const uri = own && !own.startsWith("mock:") ? own : ((await options.audioUri?.(note.audioPath)) ?? "");
      return { uri, headers: {} };
    },

    // ---- cohort ----
    myCohort: () =>
      call(() => {
        needFeature("cohorts");
        return cohortView();
      }),
    react: (cohort, r) =>
      call(() => {
        needFeature("cohort-reactions");
        if (cohort !== w.cohort.id) fail("not-found");
        if (!["well-done", "keep-going", "thank-you", "same-here", "welcome"].includes(r)) fail("bad-request");
        w.cohort.reactions.unshift({ from: meProfile(false), reaction: r, at: iso() });
        changed();
      }),

    // ---- clubs ----
    searchClubs: (q) =>
      call(() => {
        needFeature("clubs");
        const key = q.trim().toLowerCase();
        return w.clubs
          .filter((c) => c.summary.open && (!key || c.summary.name.toLowerCase().includes(key)))
          .map((c) => ({ ...c.summary, memberCount: c.members.length }))
          .filter((s) => s.memberCount < s.maxMembers || s.id === w.myClub);
      }),
    club: (id) =>
      call(() => {
        needFeature("clubs");
        const c = w.clubs.find((x) => x.summary.id === id);
        if (!c) fail("not-found");
        return clubView(c);
      }),
    myClub: () =>
      call(() => {
        needFeature("clubs");
        const c = w.clubs.find((x) => x.summary.id === w.myClub);
        return c ? clubView(c) : null;
      }),
    createClub: (input) =>
      call(() => {
        needFeature("clubs");
        requireUnmuted();
        if (w.myClub) fail("already");
        if (trust() < 2) fail("limit");
        const n = filter.name(input.name, { maxGraphemes: 24 });
        if (!n.ok) fail("filtered", { reason: n.reason });
        if (w.clubs.some((c) => c.summary.name.toLowerCase() === n.text.toLowerCase())) fail("conflict");
        let description = "";
        if (input.description.trim()) {
          const d = filter.chat(input.description, 120);
          if (!d.ok) fail("filtered", { reason: d.reason });
          if (d.masked) fail("filtered", { reason: "contact" });
          description = d.text;
        }
        const c = club(`c_${now().toString(36)}`, n.text, /^[a-z0-9-]{1,24}$/.test(input.badge) ? input.badge : "sprout", description, 0, 0);
        c.summary.open = input.open;
        c.members = [{ id: ME, role: "owner", joinedAt: iso() }];
        w.clubs.unshift(c);
        w.myClub = c.summary.id;
        changed();
        return clubView(c);
      }),
    joinClub: (ref) =>
      call(() => {
        needFeature("clubs");
        if (w.myClub) fail("already");
        const c = "id" in ref ? w.clubs.find((x) => x.summary.id === ref.id) : w.clubs.find((x) => x.code === String(ref.code).toUpperCase());
        if (!c) fail("not-found");
        if (!c.summary.open && "id" in ref) fail("closed");
        if (c.members.length >= c.summary.maxMembers) fail("full");
        c.members.push({ id: ME, role: "member", joinedAt: iso() });
        w.myClub = c.summary.id;
        changed();
        return clubView(c);
      }),
    leaveClub: () =>
      call(() => {
        const c = myClubOrFail();
        c.members = c.members.filter((m) => m.id !== ME);
        w.myClub = null;
        changed();
      }),
    clubMessages: (after) =>
      call(() => {
        needFeature("club-chat");
        const c = myClubOrFail();
        return c.messages.filter((m) => m.id > (after ?? 0) && !hidden(m.author.id)).map((m) => ({ ...m }));
      }),
    sendClubMessage: (text) =>
      call(() => {
        needFeature("club-chat");
        const c = myClubOrFail();
        requireUnmuted();
        const gap = Math.max(LIMITS.clubMessageMinGapMs, c.slowModeSeconds * 1000);
        const since = now() - w.lastClubPost;
        if (since < gap) fail("slow-down", { retryAfterMs: gap - since });
        const r = filter.chat(text, LIMITS.clubMessageMaxGraphemes);
        if (!r.ok) fail("filtered", { reason: r.reason });
        const m: ClubMessage = { id: w.nextMsg++, club: c.summary.id, author: meProfile(false), text: r.text, at: iso() };
        c.messages.push(m);
        w.lastClubPost = now();
        changed();
        return { ...m };
      }),
    deleteClubMessage: (id) =>
      call(() => {
        const c = myClubOrFail();
        const m = c.messages.find((x) => x.id === id);
        const role = c.members.find((x) => x.id === ME)?.role ?? "member";
        if (!m || (m.author.id !== ME && role === "member")) fail("not-found");
        c.messages = c.messages.filter((x) => x.id !== id);
        changed();
      }),
    kick: (accountId) =>
      call(() => {
        const c = myClubOrFail();
        c.members = c.members.filter((m) => m.id !== accountId);
        changed();
      }),
    muteInClub: () => call(() => undefined),
    setClubRole: (accountId, role) =>
      call(() => {
        const c = myClubOrFail();
        const m = c.members.find((x) => x.id === accountId);
        if (m) m.role = role;
        changed();
      }),
    updateClub: (patch) =>
      call(() => {
        const c = myClubOrFail();
        if (typeof patch.slowModeSeconds === "number") c.slowModeSeconds = patch.slowModeSeconds;
        if (typeof patch.open === "boolean") c.summary.open = patch.open;
        changed();
        return clubView(c);
      }),

    // ---- safety ----
    report: (input) =>
      call(() => {
        if (!REPORT_REASONS.some((r) => r.id === input.reason)) fail("bad-request");
        w.reports.push({ ...input });
        if (input.target.kind === "voice-note") {
          const t = input.target;
          const c = w.circles.find((x) => x.id === t.circle);
          // A teen's report of sexual content hides the note at once (as the server does).
          if (c && w.me.tier === "teen" && input.reason === "sexual-content") c.notes = c.notes.filter((n) => n.id !== t.id);
        }
        changed();
        return { id: `r_${w.reports.length.toString().padStart(6, "0")}` as ReportId };
      }),
    appeals: () => call(() => [...w.appeals]),
    appeal: (sanction, text) =>
      call(() => {
        const s = w.me.sanctions.find((x) => x.id === sanction);
        if (!s) fail("not-found");
        if (s.appeal) fail("already");
        const t = filter.chat(text, 500);
        if (!t.ok && t.reason !== "contact") fail("filtered", { reason: t.reason });
        s.appeal = "open";
        const a: AppealView = { id: `p_${w.appeals.length + 1}`, sanction, text: t.ok ? t.text : text, status: "open", createdAt: iso(), decidedAt: null };
        w.appeals.unshift(a);
        changed();
        return a;
      }),

    // ---- push ----
    registerPush: () => call(() => undefined),
    unregisterPush: () => call(() => undefined, { auth: false }),

    // ---- live ----
    connectLobby(handlers): LobbyConnection {
      let closed = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      handlers.onState?.("connecting");
      timers.push(
        setTimeout(() => {
          if (closed || offline) return handlers.onState?.("closed");
          lobbies.add(handlers);
          handlers.onMessage({ t: "ready", profile: meProfile(true) });
          handlers.onState?.("open");
          if (liveLineMs > 0)
            timers.push(
              setTimeout(() => {
                const c = w.clubs.find((x) => x.summary.id === w.myClub);
                const grace = w.people.get("a_grac0000000000000000");
                if (closed || !c || !grace || hidden(grace.id)) return;
                const m: ClubMessage = { id: w.nextMsg++, club: c.summary.id, author: pub(grace, false), text: "Welcome! We practise greetings every evening. Join in whenever you like.", at: iso() };
                c.messages.push(m);
                push({ t: "club_msg", message: m });
              }, liveLineMs)
            );
        }, Math.max(1, latency))
      );
      return {
        close() {
          closed = true;
          lobbies.delete(handlers);
          for (const t of timers) clearTimeout(t);
          handlers.onState?.("closed");
        },
      };
    },

    mock: {
      get tier() {
        return tier;
      },
      setTier(t) {
        if (t === tier) return;
        tier = t;
        const consents = w.me.consents;
        w = seed(t, now());
        w.me.consents = consents;
        changed();
      },
      get offline() {
        return offline;
      },
      setOffline(on) {
        offline = on;
        changed();
      },
      approveGuardian() {
        for (const c of w.circles) {
          if (w.me.tier !== "teen") continue;
          const pending = c.guardians.find((g) => g.teen === ME && g.status === "pending");
          if (pending) {
            pending.status = "granted";
            pending.at = iso();
          }
        }
        changed();
      },
      addSanction() {
        w.me.sanctions.push({ id: `s_${w.me.sanctions.length + 1}`, kind: "mute", until: iso(now() + DAY), createdAt: iso(), reason: "Sharing contact details in a club", appeal: null });
        changed();
      },
      get voiceNotes() {
        return config.flags.voiceNotes !== false;
      },
      setVoiceNotes(on) {
        config.flags = { ...config.flags, voiceNotes: on };
        if (!on && challengeKind === "voice-replies") challengeKind = null;
        changed();
      },
      get challengeKind() {
        return challengeKind;
      },
      setChallengeKind(kind) {
        if (kind === "voice-replies" && config.flags.voiceNotes === false) return;
        challengeKind = kind;
        for (const c of w.circles) {
          const old = w.challenges.get(c.id);
          const helpers = old ? [...old.helpers, ...(old.mine.lessons + old.mine.words + old.mine.replies.length > 0 ? [ME] : [])] : [];
          w.challenges.set(c.id, seedChallenge(c.id, c.members.length, now(), config.flags.voiceNotes !== false, helpers, kind ?? undefined));
        }
        changed();
      },
      finishChallenge() {
        for (const c of w.circles) {
          const ch = challengeOf(c);
          ch.others = ch.target;
          for (const m of c.members) if (m.id !== ME && ch.helpers.length < 4 && !ch.helpers.includes(m.id)) ch.helpers.push(m.id);
        }
        changed();
      },
      get cohortGoal() {
        return cohortGoal;
      },
      setCohortGoal(kind) {
        cohortGoal = kind;
        changed();
      },
      reports: () => w.reports,
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
  };

  function recordConsent(c: ConsentRecord) {
    w.me.consents = [...w.me.consents.filter((x) => x.kind !== c.kind), { ...c }];
    if (c.kind === "voice-notes") changed();
  }

  function cohortView(): CohortView {
    const c = w.cohort;
    const t = now();
    const members = c.members.filter((id) => !w.blocked.has(id)).map((id) => profileOf(id, false)!).filter(Boolean);
    // The goal rotates week by week as the server's does; development can pick one.
    const rotated = cohortGoalFor(mondayOf(t), c.members.length);
    const pinned = cohortGoal ? COHORT_GOALS.find((g) => g.kind === cohortGoal) : undefined;
    const goal = pinned ? { kind: pinned.kind, target: pinned.perMember * c.members.length } : rotated;
    const progress = Math.min(goal.target, Math.round(goal.target * c.share) + c.mine[goal.kind]);
    return {
      id: c.id,
      startWeek: c.startWeek,
      tier: c.tier,
      members,
      quest: { week: mondayOf(t), goal, progress, endsAt: new Date(nextMonday(t)).toISOString() },
      reactions: c.reactions.filter((r) => !hidden(r.from.id) && sameSpace(tierOf(r.from.id), w.me.tier)),
      mine: { ...c.mine },
      completed: progress >= goal.target,
    };
  }

  return client;
}

/** Is this the development mock (rather than the real client)? */
export function isMockClient(c: OkwuSocialClient): c is OkwuSocialClient & { mock: MockControls } {
  return typeof (c as { mock?: unknown }).mock === "object" && (c as { mock?: unknown }).mock !== null;
}

export type { Attempt };
