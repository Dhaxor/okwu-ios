// The typed client the screens use (owner C → D). It implements the
// contract's SocialClient and adds the protocol extras (lib/social/protocol.ts).
//
// Offline-safe error model: every method either resolves or throws a
// SocialError, never a raw fetch/TypeError. `kind` says what happened:
//   "offline"  no connection (retry later; nothing was sent, or we can't know)
//   "timeout"  no answer in time
//   "server"   the server failed (5xx)
//   "api"      the server said no: `code` is the reason (filtered, slow-down, ...)
// `retryable` is true for the first three and for "slow-down" (wait
// `retryAfterMs`). Reads (GET) are retried once automatically; writes never
// are, so nothing is ever sent twice. `attempt()` turns a call into a result
// object for screens that prefer not to catch.
//
// Credentials live in a CredsStore the app provides (SecureStore with
// AFTER_FIRST_UNLOCK under CREDS_KEY, as in Ludo); an in-memory store is the
// default for tests and previews. A 401 never wipes stored credentials by
// itself: `onUnauthorized` lets the app decide.
import type {
  AccountId,
  AgeSignal,
  AvatarId,
  CircleId,
  ClubId,
  ClubMessage,
  ClubRole,
  ClubSummary,
  CohortId,
  CohortReaction,
  ConsentRecord,
  Creds,
  FilterReason,
  FriendCode,
  FriendsView,
  LobbyClientMsg,
  ReactionId,
  Relation,
  ReportId,
  ReportInput,
  SocialClient,
} from "./types";
import type {
  AccountCreated,
  AppealView,
  AppleSignInResult,
  CircleView,
  ClubViewExt,
  CohortView,
  FamilyChallengeView,
  LobbyServerMsgExt,
  MyAccountView,
  ProgressInput,
  SocialConfig,
  SocialErrorCode,
  VoiceNoteView,
  WireError,
} from "./protocol";
import { VOICE_UPLOAD } from "./protocol";

export type SocialErrorKind = "offline" | "timeout" | "server" | "api";

export class SocialError extends Error {
  readonly kind: SocialErrorKind;
  readonly status: number;
  /** For kind "api": the server's code. Otherwise the kind itself. */
  readonly code: SocialErrorCode | "offline" | "timeout" | "server";
  readonly reason?: FilterReason;
  readonly retryAfterMs?: number;
  readonly until?: string;
  readonly needs?: WireError["needs"];

  constructor(kind: SocialErrorKind, status: number, body?: Partial<WireError>) {
    const code = kind === "api" ? (body?.error ?? "bad-request") : kind;
    super(`social ${kind}: ${code}${body?.reason ? ` (${body.reason})` : ""}`);
    this.name = "SocialError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    if (body?.reason) this.reason = body.reason;
    if (body?.retryAfterMs) this.retryAfterMs = body.retryAfterMs;
    if (body?.until) this.until = body.until;
    if (body?.needs) this.needs = body.needs;
  }

  get retryable(): boolean {
    return this.kind !== "api" || this.code === "slow-down";
  }
}

export const isSocialError = (e: unknown): e is SocialError => e instanceof SocialError;

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: SocialError };

/** A call as a result object: `const r = await attempt(client.friends()); if (!r.ok) …`. */
export async function attempt<T>(p: Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    return { ok: false, error: isSocialError(e) ? e : new SocialError("offline", 0) };
  }
}

/** Plain-English text for an error (filter reasons have their own: FILTER_MESSAGES in filter.ts). */
export function errorMessage(e: SocialError): string {
  switch (e.code) {
    case "offline":
      return "You're offline. We'll try again when you're back.";
    case "timeout":
    case "server":
      return "Something went wrong on our side. Please try again.";
    case "unauthorized":
      return "Please sign in again.";
    case "forbidden-age":
      return "This part of Okwu is for adults.";
    case "consent-required":
      return e.needs?.includes("guardian") ? "A parent or guardian in your Family Circle needs to say yes first." : "Please review and accept the community rules first.";
    case "feature-off":
      return "This isn't available right now.";
    case "suspended":
      return "Your account is paused. You can see why, and appeal, in Settings.";
    case "muted":
      return "You can't post for a while. You can see why, and appeal, in Settings.";
    case "slow-down":
      return "Slow down a little and try again in a moment.";
    case "not-found":
      return "We couldn't find that.";
    case "already":
      return "Already done.";
    case "full":
      return "That's full.";
    case "closed":
      return "That isn't open to join.";
    case "limit":
      return "You've reached the limit for this.";
    case "blocked":
      return "You've blocked this person.";
    default:
      return "That didn't work. Please try again.";
  }
}

export interface CredsStore {
  load(): Promise<Creds | null>;
  save(creds: Creds | null): Promise<void>;
}

export function memoryCredsStore(initial: Creds | null = null): CredsStore {
  let c = initial;
  return {
    load: async () => c,
    save: async (v) => {
      c = v;
    },
  };
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface SocialClientOptions {
  base?: string;
  creds?: CredsStore;
  fetch?: Fetch;
  /** Per request (default 12 s; uploads get 4×). */
  timeoutMs?: number;
  /** Extra tries for reads after offline/timeout/5xx (default 1). */
  readRetries?: number;
  /** Web and tests: read a recorded file into a Blob. Native leaves this unset (React Native's FormData sends the file by uri). */
  readAudio?: (uri: string) => Promise<Blob>;
  onUnauthorized?: () => void;
  /** A WebSocket constructor for the lobby (default: the global one). */
  WebSocketImpl?: new (url: string) => WebSocketLike;
}

export interface WebSocketLike {
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface LobbyHandlers {
  /** The contract's messages plus the protocol's (a guardian request, a family challenge update). */
  onMessage(msg: LobbyServerMsgExt): void;
  onState?(state: "connecting" | "open" | "closed"): void;
}

export interface LobbyConnection {
  close(): void;
}

/** The contract's client plus the protocol extras. */
export interface OkwuSocialClient extends SocialClient {
  config(): Promise<SocialConfig>;
  creds(): Promise<Creds | null>;
  ensureAccount(input: { displayName: string; avatar: AvatarId; age: AgeSignal; consents: ConsentRecord[] }): Promise<MyAccountView>;
  signInWithApple(identityToken: string, nonce: string, authorizationCode?: string): Promise<{ account: MyAccountView; switched: boolean }>;
  me(): Promise<MyAccountView>;
  updateMe(patch: { displayName?: string; avatar?: AvatarId }): Promise<MyAccountView>;
  setAge(age: { tier: AgeSignal["tier"]; source: AgeSignal["source"] }): Promise<MyAccountView>;
  recordProgress(input: ProgressInput): Promise<CohortView | null>;
  mute(id: AccountId): Promise<void>;
  unmute(id: AccountId): Promise<void>;
  myCircles(): Promise<CircleView[]>;
  createCircle(name: string): Promise<CircleView>;
  joinCircle(inviteCode: string, relation?: Relation): Promise<CircleView>;
  rotateInvite(id: CircleId): Promise<CircleView>;
  removeFromCircle(id: CircleId, account: AccountId): Promise<CircleView>;
  requestGuardian(id: CircleId, guardian: AccountId): Promise<CircleView>;
  grantGuardian(id: CircleId, teen: AccountId, version: string): Promise<CircleView>;
  revokeGuardian(id: CircleId, other: AccountId): Promise<CircleView>;
  voiceNotes(id: CircleId, after?: string): Promise<VoiceNoteView[]>;
  /** `replyTo`: the prompt (a note addressed to me) this answers; it counts towards a voice-reply family challenge. */
  sendVoiceNote(id: CircleId, input: { to: AccountId | null; caption?: string; replyTo?: string; audio: { uri: string; durationMs: number } }): Promise<VoiceNoteView>;
  deleteVoiceNote(id: CircleId, note: string): Promise<void>;
  /** This week's family challenge (also in every CircleView as `challenge`). */
  familyChallenge(id: CircleId): Promise<FamilyChallengeView>;
  /**
   * Sign out on this phone: the server ends this session and forgets this
   * phone's push token (pass it when known); the stored credentials are
   * cleared even when the server can't be reached.
   */
  signOut(pushToken?: string): Promise<void>;
  /** For expo-audio: `useAudioPlayer(await client.audioSource(note))`. */
  audioSource(note: Pick<VoiceNoteView, "audioPath">): Promise<{ uri: string; headers: Record<string, string> }>;
  myCohort(): Promise<CohortView | null>;
  club(id: ClubId): Promise<ClubViewExt>;
  myClub(): Promise<ClubViewExt | null>;
  createClub(input: { name: string; badge: string; description: string; open: boolean }): Promise<ClubViewExt>;
  joinClub(ref: { id: ClubId } | { code: string }): Promise<ClubViewExt>;
  kick(account: AccountId): Promise<void>;
  muteInClub(account: AccountId, hours: number): Promise<void>;
  setClubRole(account: AccountId, role: ClubRole): Promise<void>;
  updateClub(patch: { description?: string; open?: boolean; badge?: string; slowModeSeconds?: number }): Promise<ClubViewExt>;
  appeals(): Promise<AppealView[]>;
  appeal(sanction: string, text: string): Promise<AppealView>;
  /** The live socket: friend requests, voice notes, reactions, club lines. Reconnects by itself. */
  connectLobby(handlers: LobbyHandlers): LobbyConnection;
}

const AUDIO_TYPES: Record<string, string> = { m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg" };
const audioType = (uri: string) => AUDIO_TYPES[/\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri)?.[1]?.toLowerCase() ?? "m4a"] ?? "audio/mp4";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createSocialClient(baseOrOptions: string | SocialClientOptions = {}): OkwuSocialClient {
  const opts: SocialClientOptions = typeof baseOrOptions === "string" ? { base: baseOrOptions } : baseOrOptions;
  const base = (opts.base ?? "http://localhost:8787").replace(/\/+$/, "");
  const store = opts.creds ?? memoryCredsStore();
  const doFetch: Fetch = opts.fetch ?? ((u, i) => fetch(u, i));
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const readRetries = opts.readRetries ?? 1;

  async function authHeader(): Promise<Record<string, string>> {
    const c = await store.load();
    return c ? { authorization: `Bearer ${c.id}.${c.token}` } : {};
  }

  async function once(method: string, path: string, body: unknown, form: boolean, limit: number): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json", ...(await authHeader()) };
    if (body !== undefined && !form) headers["content-type"] = "application/json";
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        ctrl?.abort();
        reject(new SocialError("timeout", 0));
      }, limit);
    });
    let res: Response;
    try {
      res = await Promise.race([
        doFetch(base + path, { method, headers, body: body === undefined ? undefined : form ? (body as BodyInit) : JSON.stringify(body), signal: ctrl?.signal }),
        timeout,
      ]);
    } catch (e) {
      throw isSocialError(e) ? e : new SocialError(timedOut ? "timeout" : "offline", 0);
    } finally {
      clearTimeout(timer);
    }
    let data: unknown = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (res.ok) return data;
    if (res.status >= 500) throw new SocialError("server", res.status);
    const err = new SocialError("api", res.status, (data ?? {}) as Partial<WireError>);
    if (err.code === "unauthorized") opts.onUnauthorized?.();
    return Promise.reject(err);
  }

  async function request<T>(method: string, path: string, body?: unknown, o: { form?: boolean; limit?: number } = {}): Promise<T> {
    const tries = method === "GET" ? 1 + readRetries : 1;
    for (let i = 0; ; i++) {
      try {
        return (await once(method, path, body, !!o.form, o.limit ?? timeoutMs)) as T;
      } catch (e) {
        const se = isSocialError(e) ? e : new SocialError("offline", 0);
        if (i + 1 >= tries || se.kind === "api") throw se;
        await sleep(250 * (i + 1));
      }
    }
  }

  const get = <T>(path: string) => request<T>("GET", path);
  const post = <T>(path: string, body: unknown = {}) => request<T>("POST", path, body);
  const del = <T>(path: string) => request<T>("DELETE", path);
  const enc = encodeURIComponent;
  const ok = async (p: Promise<unknown>) => void (await p);

  const client: OkwuSocialClient = {
    config: () => get<SocialConfig>("/api/config"),
    creds: () => store.load(),

    // ---- accounts ----
    async ensureAccount(input) {
      if (await store.load()) return client.me();
      const r = await post<AccountCreated>("/api/accounts", input);
      await store.save(r.creds);
      return r.account;
    },
    async signInWithApple(identityToken, nonce, authorizationCode) {
      const r = await post<AppleSignInResult>("/api/auth/apple", { identityToken, nonce, ...(authorizationCode ? { authorizationCode } : {}) });
      await store.save(r.creds);
      return { account: r.account, switched: r.switched };
    },
    me: () => get<MyAccountView>("/api/me"),
    updateMe: (patch) => request<MyAccountView>("PATCH", "/api/me", patch),
    setAge: (age) => post<MyAccountView>("/api/me/age", age),
    recordConsent: (consent) => ok(post("/api/consents", consent)),
    async deleteAccount() {
      await del("/api/me");
      await store.save(null);
    },
    async recordProgress(input) {
      return (await post<{ cohort: CohortView | null }>("/api/progress", input)).cohort;
    },

    // ---- friends, blocks, mutes ----
    friends: () => get<FriendsView>("/api/friends"),
    requestFriend: (code: FriendCode) => post<{ status: "sent" | "friends" }>("/api/friends/request", { code }),
    respondFriend: (id, accept) => ok(post("/api/friends/respond", { id, accept })),
    removeFriend: (id) => ok(del(`/api/friends/${enc(id)}`)),
    block: (id) => ok(post("/api/blocks", { id })),
    unblock: (id) => ok(del(`/api/blocks/${enc(id)}`)),
    mute: (id) => ok(post("/api/mutes", { id })),
    unmute: (id) => ok(del(`/api/mutes/${enc(id)}`)),

    // ---- Family Circle ----
    async myCircles() {
      return (await get<{ circles: CircleView[] }>("/api/circles")).circles;
    },
    createCircle: (name) => post<CircleView>("/api/circles", { name }),
    joinCircle: (inviteCode, relation) => post<CircleView>("/api/circles/join", { inviteCode, relation }),
    leaveCircle: (id) => ok(post(`/api/circles/${enc(id)}/leave`)),
    rotateInvite: (id) => post<CircleView>(`/api/circles/${enc(id)}/invite`),
    removeFromCircle: (id, account) => post<CircleView>(`/api/circles/${enc(id)}/remove`, { account }),
    requestGuardian: (id, guardian) => post<CircleView>(`/api/circles/${enc(id)}/guardian`, { guardian }),
    grantGuardian: (id, teen, version) => post<CircleView>(`/api/circles/${enc(id)}/guardian/consent`, { teen, version }),
    revokeGuardian: (id, other) => del<CircleView>(`/api/circles/${enc(id)}/guardian/${enc(other)}`),
    async voiceNotes(id, after) {
      return (await get<{ notes: VoiceNoteView[] }>(`/api/circles/${enc(id)}/notes${after ? `?after=${enc(after)}` : ""}`)).notes;
    },
    async sendVoiceNote(id, input) {
      const form = new FormData();
      form.append(VOICE_UPLOAD.metaField, JSON.stringify({ to: input.to, caption: input.caption, ...(input.replyTo ? { replyTo: input.replyTo } : {}), durationMs: Math.round(input.audio.durationMs) }));
      const type = audioType(input.audio.uri);
      const name = `note.${type === "audio/mp4" ? "m4a" : (type.split("/")[1] ?? "m4a")}`;
      if (opts.readAudio) form.append(VOICE_UPLOAD.audioField, await opts.readAudio(input.audio.uri), name);
      // React Native's FormData sends a file part from { uri, name, type }.
      else form.append(VOICE_UPLOAD.audioField, { uri: input.audio.uri, name, type } as unknown as Blob);
      return request<VoiceNoteView>("POST", `/api/circles/${enc(id)}/notes`, form, { form: true, limit: timeoutMs * 4 });
    },
    deleteVoiceNote: (id, note) => ok(del(`/api/circles/${enc(id)}/notes/${enc(note)}`)),
    familyChallenge: (id) => get<FamilyChallengeView>(`/api/circles/${enc(id)}/challenge`),
    async audioSource(note) {
      return { uri: base + note.audioPath, headers: await authHeader() };
    },

    // ---- cohorts ----
    async myCohort() {
      return (await get<{ cohort: CohortView | null }>("/api/cohort")).cohort;
    },
    react: (cohort: CohortId, reaction: ReactionId) => ok(post<CohortReaction>("/api/cohort/react", { cohort, reaction })),

    // ---- clubs ----
    async searchClubs(q) {
      return (await get<{ clubs: ClubSummary[] }>(`/api/clubs?q=${enc(q)}`)).clubs;
    },
    club: (id) => get<ClubViewExt>(`/api/clubs/${enc(id)}`),
    async myClub() {
      return (await get<{ club: ClubViewExt | null }>("/api/clubs/mine")).club;
    },
    createClub: (input) => post<ClubViewExt>("/api/clubs", input),
    joinClub: (ref) => post<ClubViewExt>("/api/clubs/join", ref),
    leaveClub: () => ok(post("/api/clubs/leave")),
    async clubMessages(after) {
      return (await get<{ messages: ClubMessage[] }>(`/api/clubs/messages${after ? `?after=${after}` : ""}`)).messages;
    },
    sendClubMessage: (text) => post<ClubMessage>("/api/clubs/messages", { text }),
    deleteClubMessage: (id) => ok(del(`/api/clubs/messages/${id}`)),
    kick: (account) => ok(post("/api/clubs/kick", { account })),
    muteInClub: (account, hours) => ok(post("/api/clubs/mute", { account, hours })),
    setClubRole: (account, role) => ok(post("/api/clubs/role", { account, role })),
    updateClub: (patch) => request<ClubViewExt>("PATCH", "/api/clubs/settings", patch),

    // ---- safety ----
    report: (input: ReportInput) => post<{ id: ReportId }>("/api/reports", input),
    async appeals() {
      return (await get<{ appeals: AppealView[] }>("/api/appeals")).appeals;
    },
    appeal: (sanction, text) => post<AppealView>("/api/appeals", { sanction, text }),

    // ---- push ----
    registerPush: (token, lang) => ok(post("/api/push", { token, lang })),
    unregisterPush: (token) => ok(del(`/api/push${token ? `?token=${enc(token)}` : ""}`)),
    async signOut(pushToken) {
      try {
        if (await store.load()) await post("/api/signout", pushToken ? { pushToken } : {});
      } finally {
        await store.save(null);
      }
    },

    // ---- live ----
    connectLobby(handlers) {
      const WS = opts.WebSocketImpl ?? (globalThis as unknown as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
      let ws: WebSocketLike | null = null;
      let closed = false;
      let delay = 1000;
      let ping: ReturnType<typeof setInterval> | undefined;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const send = (m: LobbyClientMsg) => ws?.send(JSON.stringify(m));
      const open = async () => {
        const c = await store.load();
        if (closed || !WS || !c) return handlers.onState?.("closed");
        handlers.onState?.("connecting");
        ws = new WS(`${base.replace(/^http/, "ws")}/lobby`);
        ws.onopen = () => {
          delay = 1000;
          send({ t: "auth", id: c.id, token: c.token });
          ping = setInterval(() => send({ t: "ping" }), 25_000);
        };
        ws.onmessage = (ev) => {
          let msg: LobbyServerMsgExt;
          try {
            msg = JSON.parse(String(ev.data)) as LobbyServerMsgExt;
          } catch {
            return;
          }
          if (msg.t === "ready") handlers.onState?.("open");
          if (msg.t !== "pong") handlers.onMessage(msg);
        };
        ws.onerror = () => {};
        ws.onclose = () => {
          clearInterval(ping);
          ws = null;
          if (closed) return;
          handlers.onState?.("closed");
          retry = setTimeout(() => void open(), delay);
          delay = Math.min(30_000, delay * 2);
        };
      };
      void open();
      return {
        close() {
          closed = true;
          clearInterval(ping);
          clearTimeout(retry);
          ws?.close();
          handlers.onState?.("closed");
        },
      };
    },
  };
  return client;
}
