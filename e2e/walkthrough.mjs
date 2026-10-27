// iOS simulator walkthrough for Okwu (Appium / XCUITest via webdriverio).
//
// MODE=full (iPhone 16 Pro Max): a fresh install through onboarding as a new
// learner and the whole first lesson (the pattern card, every exercise, the
// end moments), the recordings (lesson clips streamed from the audio CDN, a
// dictionary word, a phrase), the paywall, Learn and its path, Practice
// (dictionary "nne", the phrasebook), the Library (hub, a proverb, a tale),
// Community as an adult (accepting the documents creates an anonymous account
// on the LIVE server), Me and its tools, Settings → Credits, the microphone
// prompt on Say it, and last, Settings → Delete account, which removes that
// account again (retried in `finally` if the tour broke off before it).
// MODE=small (iPhone SE size): the same first run on a small screen, key
// screens only, for clipping. It never accepts the community documents, so it
// creates no server account.
//
// Every check logs "<NAME> RESULT: PASS|FAIL|WARN|SKIP — detail" and lands in
// results-<mode>.json with the screenshot taken last. Screens are found by the
// app's testIDs (accessibility identifiers on iOS); nothing sleeps blindly
// where an element can be waited for.
import { remote } from "webdriverio";
import fs from "fs";
import { PNG } from "pngjs";

const UDID = process.env.UDID;
const BUNDLE = process.env.BUNDLE_ID || "app.okwu.learn";
const SHOTS = process.env.SHOTS_DIR || "shots";
const MODE = process.env.MODE === "small" ? "small" : "full";
const PREFIX = MODE === "small" ? "se-" : "";
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const log = (...a) => console.log(`[e2e:${MODE}]`, `+${((Date.now() - T0) / 1000).toFixed(1)}s`, ...a);
const msg = (e) => String(e?.message ?? e).split("\n")[0];
const results = [];
const facts = { mode: MODE, friendCode: null, accountCreated: false, accountDeleted: false };
let lastShot = null;
function record(name, status, detail) {
  results.push({ name, status, detail, shot: lastShot });
  log(`${name} RESULT: ${status} — ${detail}`);
}
const withTimeout = (p, ms, what) => Promise.race([p, sleep(ms).then(() => Promise.reject(new Error(`${what} timed out after ${ms}ms`)))]);

const pred = (p) => `-ios predicate string:${p}`;
const labelContains = (t) => pred(`label CONTAINS "${t}"`);

const caps = {
  platformName: "iOS",
  "appium:automationName": "XCUITest",
  "appium:udid": UDID,
  "appium:bundleId": BUNDLE,
  "appium:noReset": true,
  "appium:newCommandTimeout": 600,
  "appium:wdaLaunchTimeout": 300000,
  "appium:wdaConnectionTimeout": 300000,
};

// WebDriverAgent's first build on a cold simulator can outlast the HTTP
// client's header timeout; the second attempt usually finds it built.
async function createSession(attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await remote({ hostname: "127.0.0.1", port: 4723, path: "/", capabilities: caps, logLevel: "error", connectionRetryTimeout: 420000 });
    } catch (e) {
      log(`session attempt ${i}/${attempts} failed:`, msg(e));
      if (i === attempts) throw e;
      await sleep(8000);
    }
  }
}

const driver = await createSession();
let win = { width: 430, height: 932 };

// ---- primitives -------------------------------------------------------------
let n = 1;
async function shot(name) {
  try {
    const buf = Buffer.from(await driver.takeScreenshot(), "base64");
    const file = `${PREFIX}${String(n++).padStart(3, "0")}-${name}.png`;
    fs.writeFileSync(`${SHOTS}/${file}`, buf);
    lastShot = file;
    log("shot", file);
    return buf;
  } catch (e) {
    log("shot-failed", name, msg(e));
    return null;
  }
}

/** The page source, saved next to the screenshots (for debugging a selector that missed). */
async function source(name) {
  try {
    const xml = await withTimeout(driver.getPageSource(), 60000, "page source");
    fs.writeFileSync(`${SHOTS}/${PREFIX}${String(n).padStart(3, "0")}-${name}.xml`, xml);
    return xml;
  } catch (e) {
    log("source-failed", name, msg(e));
    return "";
  }
}

async function find(selector, timeout = 10000) {
  try {
    const el = await driver.$(selector);
    await el.waitForExist({ timeout, interval: 300 });
    return el;
  } catch {
    return null;
  }
}
const exists = async (selector, timeout = 4000) => !!(await find(selector, timeout));

async function tap(selector, label, timeout = 12000) {
  const el = await find(selector, timeout);
  if (!el) {
    log("tap-failed", label, "(not found)");
    return false;
  }
  try {
    await el.click();
    log("tapped", label);
    return true;
  } catch (e) {
    log("tap-failed", label, msg(e));
    return false;
  }
}

async function rectOf(selector, timeout = 3000) {
  const el = await find(selector, timeout);
  if (!el) return null;
  try {
    return await driver.getElementRect(el.elementId);
  } catch {
    return null;
  }
}

async function labelOf(selector, timeout = 2000) {
  const el = await find(selector, timeout);
  if (!el) return null;
  try {
    return (await el.getAttribute("label")) ?? (await el.getText());
  } catch {
    return null;
  }
}

/** All the words on screen under an element (a View whose Text children carry them). */
async function textsUnder(selector, timeout = 1500) {
  const el = await find(selector, timeout);
  if (!el) return "";
  try {
    const kids = await el.$$(pred('type == "XCUIElementTypeStaticText"'));
    const out = [];
    for (const k of kids) out.push(await k.getAttribute("label"));
    return out.filter(Boolean).join(" | ") || ((await el.getAttribute("label")) ?? "");
  } catch {
    return "";
  }
}

async function typeInto(selector, text) {
  const el = await find(selector, 6000);
  if (!el) return false;
  try {
    await el.click();
    await sleep(500);
    await el.setValue(text);
    return true;
  } catch (e) {
    log("type-failed", selector, msg(e));
    try {
      await el.addValue(text);
      return true;
    } catch {
      return false;
    }
  }
}

// A slow finger drag (no fling), so a scroll lands where it was asked to.
async function drag(dir, dist = win.height * 0.38) {
  const x = Math.round(win.width * 0.5);
  const y0 = Math.round(dir === "up" ? win.height * 0.62 : win.height * 0.3);
  const y1 = Math.round(dir === "up" ? y0 - dist : y0 + dist);
  try {
    await driver.performActions([
      {
        type: "pointer",
        id: "finger",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x, y: y0 },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 120 },
          { type: "pointerMove", duration: 450, x, y: y1 },
          { type: "pause", duration: 150 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ]);
    await driver.releaseActions().catch(() => {});
  } catch (e) {
    log("drag-failed", msg(e));
    await driver.execute("mobile: swipe", { direction: dir }).catch(() => {});
  }
  await sleep(600);
}

/** Scroll the screen until the element sits inside the readable band (above any footer or tab bar). */
async function scrollTo(selector, max = 8) {
  const top = MODE === "small" ? 40 : 70;
  for (let i = 0; i <= max; i++) {
    const r = await rectOf(selector, i === 0 ? 5000 : 1200);
    const limit = win.height * 0.7;
    if (r && r.y >= top && r.y + r.height <= limit) return true;
    if (!r || r.y + r.height > limit) await drag("up", r ? Math.min(Math.max(r.y + r.height - limit + 60, 80), win.height * 0.42) : undefined);
    else await drag("down", Math.min(top - r.y + 60, win.height * 0.42));
  }
  const r = await rectOf(selector, 800);
  return !!r && r.y >= 0 && r.y + r.height <= win.height;
}

async function scrollTop() {
  for (let i = 0; i < 4; i++) await drag("down", win.height * 0.5);
}

// 4 = running in the foreground (XCUIApplicationState).
const appState = () => driver.execute("mobile: queryAppState", { bundleId: BUNDLE }).catch(() => -1);

/** The toast showing now, if any (its words), or null. */
async function toastNow(timeout = 300) {
  if (!(await exists("~toast", timeout))) return null;
  return (await textsUnder("~toast", 500)) || "(toast)";
}

/** A system alert (permission prompts belong to SpringBoard): read it, screenshot it, accept it. */
async function systemAlert(tag, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    let buttons = null;
    try {
      buttons = await driver.execute("mobile: alert", { action: "getButtons" });
    } catch {
      /* no alert yet */
    }
    if (Array.isArray(buttons) && buttons.length) {
      let text = "";
      try {
        text = await driver.getAlertText();
      } catch {}
      await shot(`${tag}-system-alert`);
      const want = buttons.find((b) => /^(Allow|OK|Allow While Using App|Continue)$/i.test(String(b)));
      try {
        await driver.execute("mobile: alert", { action: "accept", ...(want ? { buttonLabel: want } : {}) });
      } catch (e) {
        log("alert accept failed:", msg(e));
        await driver.acceptAlert().catch(() => {});
      }
      await sleep(1000);
      return { text: String(text).replace(/\s+/g, " ").trim(), buttons, accepted: want ?? "(default)" };
    }
    await sleep(400);
  }
  return null;
}

// ---- layout checks ------------------------------------------------------------
// Safe areas: nothing tappable under the status bar / Dynamic Island or the
// home indicator. Overflow: text or buttons running off the side of the screen.
const layoutIssues = [];
const overflowNotes = [];
const insets = () => (win.height >= 900 ? { top: 54, bottom: 34 } : win.height >= 800 ? { top: 47, bottom: 34 } : { top: 20, bottom: 0 });

async function checkSafeArea(screen, selectors) {
  const { top, bottom } = insets();
  for (const s of selectors) {
    const r = await rectOf(s, 600);
    if (!r || r.width === 0) continue;
    if (r.y < top - 1) layoutIssues.push(`${screen}: ${s.slice(1)} top at ${r.y}pt, under the status bar (inset ${top})`);
    if (r.y + r.height > win.height - bottom + 1) layoutIssues.push(`${screen}: ${s.slice(1)} bottom at ${r.y + r.height}pt, under the home indicator (screen ${win.height}, inset ${bottom})`);
    if (r.x < -1 || r.x + r.width > win.width + 1) layoutIssues.push(`${screen}: ${s.slice(1)} runs off the side (x ${r.x}, w ${r.width})`);
  }
}

/** One page-source read: every text or button whose frame runs off the left or right edge. */
async function scanOverflow(screen) {
  const xml = await source(`${screen}-tree`);
  if (!xml) return;
  const re = /<XCUIElementType(StaticText|Button|TextField|Other)\b([^>]*)>/g;
  let m;
  const hits = [];
  while ((m = re.exec(xml))) {
    const attrs = m[2];
    const num = (k) => {
      const a = new RegExp(`\\b${k}="(-?\\d+)"`).exec(attrs);
      return a ? Number(a[1]) : null;
    };
    const vis = /\bvisible="true"/.test(attrs);
    const x = num("x");
    const w = num("width");
    const y = num("y");
    const h = num("height");
    if (x === null || w === null || y === null || h === null || w === 0 || h === 0) continue;
    if (m[1] === "Other" && !/\bname="/.test(attrs)) continue;
    // Only what is on screen vertically and pokes out sideways (horizontal scrollers excluded by their partly-visible frames below).
    if (y + h <= 0 || y >= win.height) continue;
    if (x < -2 || x + w > win.width + 2) {
      const label = (/\blabel="([^"]*)"/.exec(attrs)?.[1] ?? /\bname="([^"]*)"/.exec(attrs)?.[1] ?? "").slice(0, 50);
      if (!vis && m[1] === "Other") continue;
      hits.push(`${m[1]} "${label}" x=${x} w=${w}`);
    }
  }
  // Remove the tree file when it shows nothing worth a look (keeps the results small).
  if (!hits.length) {
    try {
      fs.unlinkSync(`${SHOTS}/${PREFIX}${String(n).padStart(3, "0")}-${screen}-tree.xml`);
    } catch {}
  } else overflowNotes.push(`${screen}: ${hits.slice(0, 6).join("; ")}${hits.length > 6 ? ` (+${hits.length - 6})` : ""}`);
}

/** Software keyboard: does it cover the field being typed in, or the button that acts on it? */
async function keyboardCheck(tag, inputSel, actionSel) {
  const kb = await find("-ios class chain:**/XCUIElementTypeKeyboard", 5000);
  if (!kb) return { ok: null, detail: "no software keyboard appeared (hardware keyboard connected?)" };
  let k;
  try {
    k = await driver.getElementRect(kb.elementId);
  } catch {
    return { ok: null, detail: "keyboard frame unreadable" };
  }
  const issues = [];
  const inp = await rectOf(inputSel, 1500);
  if (inp && inp.y + inp.height > k.y + 1) issues.push(`field (bottom ${inp.y + inp.height}) under the keyboard (top ${k.y})`);
  if (actionSel) {
    const act = await rectOf(actionSel, 1500);
    if (!act) issues.push(`${actionSel.slice(1)} not found with the keyboard up`);
    else if (act.y + act.height > k.y + 1) issues.push(`${actionSel.slice(1)} (bottom ${act.y + act.height}) under the keyboard (top ${k.y})`);
  }
  await shot(`${tag}-keyboard`);
  return { ok: issues.length === 0, detail: issues.length ? issues.join("; ") : `field${actionSel ? " and its button" : ""} stay above the keyboard (top ${k.y})` };
}

async function hideKeyboard() {
  try {
    await driver.execute("mobile: hideKeyboard", { keys: ["return", "Return", "Done", "search", "Search"] });
  } catch {
    try {
      await driver.hideKeyboard();
    } catch {}
  }
  await sleep(500);
}

/** A uniform screenshot (all one colour) means a blank or crashed screen. */
function blank(buf) {
  if (!buf) return true;
  try {
    const png = PNG.sync.read(buf);
    const seen = new Set();
    for (let y = 0; y < png.height; y += 37) for (let x = 0; x < png.width; x += 37) {
      const i = (y * png.width + x) * 4;
      seen.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
      if (seen.size > 6) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---- navigation --------------------------------------------------------------
/** Tap whatever back / close control sits at the top of the screen. */
async function goBack(preferred) {
  if (preferred && (await tap(preferred, `back (${preferred.slice(1)})`, 2500))) {
    await sleep(900);
    return true;
  }
  try {
    const els = await driver.$$(pred('name ENDSWITH "-back" OR name ENDSWITH "-close"'));
    for (const el of els) {
      const r = await driver.getElementRect(el.elementId).catch(() => null);
      if (!r || r.width === 0 || r.y > 220 || r.y < 0) continue;
      const name = await el.getAttribute("name");
      await el.click();
      log("tapped", `back (${name})`);
      await sleep(900);
      return true;
    }
  } catch (e) {
    log("goBack failed:", msg(e));
  }
  return false;
}

async function toTab(name) {
  for (let i = 0; i < 6; i++) {
    const r = await rectOf(`~tab-${name}`, 1000);
    if (r && r.y > win.height * 0.75) break;
    // A sheet left open (a lesson's "Leave this lesson?", a report) covers the back button.
    if (await exists("~confirm-ok", 300)) {
      await tap("~confirm-ok", "confirm", 1500);
      await sleep(1000);
      continue;
    }
    if (!(await goBack())) break;
  }
  const ok = await tap(`~tab-${name}`, `${name} tab`, 5000);
  await sleep(1200);
  return ok;
}

async function section(name, fn) {
  try {
    const r = await fn();
    record(name, r.ok === null ? "SKIP" : r.ok === "warn" ? "WARN" : r.ok ? "PASS" : "FAIL", r.detail);
    if (!r.ok && r.ok !== null) await source(`${name.toLowerCase()}-fail`);
  } catch (e) {
    record(name, "FAIL", `error: ${msg(e)}`);
    await shot(`${name.toLowerCase()}-error`);
    await source(`${name.toLowerCase()}-error`);
  }
}

// ---- audio -------------------------------------------------------------------
/**
 * Tap a play control and wait for it to report playing (the lesson button's
 * label turns "Playing"; the dictionary and phrase buttons read "Playing…").
 * A stream that fails to load never reports playing. Any toast is an error.
 */
async function listen(tag, selector, playingRe, ms = 8000) {
  const el = await find(selector, 4000);
  if (!el) return { ok: false, detail: `${selector.slice(1)} missing` };
  const before = (await labelOf(selector, 800)) ?? "";
  try {
    await el.click();
  } catch (e) {
    return { ok: false, detail: `tap failed: ${msg(e)}` };
  }
  const end = Date.now() + ms;
  let seen = null;
  let toast = null;
  while (Date.now() < end && !seen) {
    const l = await labelOf(selector, 600);
    if (l && playingRe.test(l)) seen = l;
    if (!toast) toast = await toastNow(150);
    if (!seen) await sleep(200);
  }
  if (seen) await shot(`${tag}-playing`);
  await sleep(1200);
  if (!toast) toast = await toastNow(300);
  const alive = (await appState()) === 4;
  return {
    ok: !!seen && !toast && alive,
    detail: `"${before}" → ${seen ? `"${seen}"` : `never reported playing within ${ms / 1000}s`}; ${toast ? `toast "${toast}"` : "no error toast"}${alive ? "" : "; APP NOT RUNNING"}`,
  };
}

// ---- the lesson player -------------------------------------------------------------
const EX_TYPES = ["listen-choose", "tone-pair", "build-sentence", "type-it", "say-it", "dialogue", "story"];
async function exerciseType(prefix) {
  try {
    const els = await driver.$$(pred(`name IN {${EX_TYPES.map((t) => `"${prefix}-${t}-header"`).join(", ")}}`));
    for (const el of els) {
      const name = await el.getAttribute("name");
      if (name) return name.slice(prefix.length + 1, -"-header".length);
    }
  } catch {}
  return null;
}

/** The microphone prompt from "Record yourself" on a Say it exercise, accepted through `mobile: alert`. */
async function micPrompt(tag, p) {
  const rec = `~${p}-record`;
  if (!(await exists(rec, 3000))) return { ok: false, detail: "no Record yourself button" };
  await scrollTo(rec, 3);
  const before = await labelOf(rec, 1500);
  await tap(rec, "record yourself", 3000);
  const alert = await systemAlert(`${tag}-mic`, 10000);
  let state = null;
  for (let i = 0; i < 16 && !state; i++) {
    const l = (await labelOf(rec, 600)) ?? "";
    if (/^Stop$/.test(l)) state = "recording";
    else if (await exists(labelContains("recording didn"), 150)) state = "error (no input device?)";
    else if (await exists(labelContains("needs the microphone"), 150)) state = "denied";
    else await sleep(400);
  }
  await shot(`${tag}-say-it-recorder`);
  let after = "";
  if (state === "recording") {
    await sleep(1500);
    await tap(rec, "stop", 2000);
    await sleep(1200);
    after = (await exists(`~${p}-mine`, 2500)) ? "stopped → Play mine shown" : `stopped → "${await labelOf(rec, 800)}", no Play mine`;
    await shot(`${tag}-say-it-recorded`);
  }
  const alive = (await appState()) === 4;
  return {
    ok: !!alert && alive && state !== "denied",
    detail: `"${before}" tapped; ${alert ? `system prompt "${alert.text}" [${alert.buttons.join(" / ")}] accepted with "${alert.accepted}"` : "NO microphone prompt appeared"}; recorder ${state ?? "state unknown"}${after ? `; ${after}` : ""}; app ${alive ? "alive" : "NOT running"}`,
  };
}

/**
 * Play the lesson on screen to its end: every exercise answered (the first
 * option, the tiles in order, a typed letter, "Matched", "Next line"), each
 * screenshotted, with the recordings checked on the way.
 */
async function playLesson(tag, { prefix = "lesson", micCheck = false, audioCheck = true } = {}) {
  const out = { done: false, exercises: [], audio: [], mic: null, keyboard: null, pending: [] };
  const checkedAudio = new Set();
  const feedbackShot = new Set();
  let fresh = true;
  let idle = 0;
  for (let step = 0; step < 120; step++) {
    if (await exists(`~${prefix}-end`, 250)) {
      out.done = true;
      break;
    }
    if (await exists(`~${prefix}-continue`, 250)) {
      await tap(`~${prefix}-continue`, "continue", 2000);
      fresh = true;
      await sleep(700);
      continue;
    }
    const type = await exerciseType(prefix);
    if (!type) {
      if (++idle > 14) {
        await shot(`${tag}-stuck`);
        await source(`${tag}-stuck`);
        break;
      }
      await sleep(600);
      continue;
    }
    idle = 0;
    const p = `${prefix}-${type}`;
    if (fresh) {
      fresh = false;
      const progress = (await labelOf(`~${prefix}-progress`, 600)) ?? "";
      const pending = await exists(`~${p}-pending`, 400);
      const play = await exists(`~${p}-play`, 300);
      const shown = (await labelOf(`~${p}-prompt`, 300)) ?? (await labelOf(`~${p}-text`, 300)) ?? "";
      out.exercises.push({ type, progress, pending, play, shown });
      if (pending) out.pending.push(`${type} "${shown}"`);
      await shot(`${tag}-${String(out.exercises.length).padStart(2, "0")}-${type}`);
      if (audioCheck && play && !checkedAudio.has(type) && type !== "dialogue") {
        checkedAudio.add(type);
        out.audio.push({ type, ...(await listen(`${tag}-${type}`, `~${p}-play`, /^Playing$/)) });
      }
    }
    switch (type) {
      case "listen-choose":
      case "tone-pair": {
        await scrollTo(`~${p}-option-0`, 2);
        await tap(`~${p}-option-0`, "option 0", 3000);
        await sleep(300);
        await tap(`~${prefix}-check`, "check", 3000);
        break;
      }
      case "build-sentence": {
        const tiles = await driver.$$(pred(`name BEGINSWITH "${p}-tile-"`));
        const names = [];
        for (const t of tiles) names.push(await t.getAttribute("name"));
        names.sort((a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()));
        for (const name of names) {
          await tap(`~${name}`, name, 1500);
          await sleep(250);
        }
        await tap(`~${prefix}-check`, "check", 3000);
        break;
      }
      case "type-it": {
        await typeInto(`~${p}-input`, "a");
        await sleep(800);
        if (!out.keyboard) out.keyboard = await keyboardCheck(`${tag}-type-it`, `~${p}-input`, `~${prefix}-check`);
        if (out.keyboard && out.keyboard.ok === false) await hideKeyboard();
        await tap(`~${prefix}-check`, "check", 3000);
        await sleep(400);
        if (await exists("-ios class chain:**/XCUIElementTypeKeyboard", 300)) await hideKeyboard();
        break;
      }
      case "say-it": {
        if (micCheck && !out.mic) out.mic = await micPrompt(tag, p);
        await tap(`~${prefix}-matched`, "matched", 3000);
        break;
      }
      case "dialogue": {
        if (await exists(`~${prefix}-matched`, 300)) await tap(`~${prefix}-matched`, "matched", 2000);
        else await tap(`~${prefix}-next`, "next line", 3000);
        break;
      }
      case "story": {
        await shot(`${tag}-story`);
        await tap(`~${prefix}-next`, "I've read it", 3000);
        break;
      }
    }
    await sleep(600);
    if (!feedbackShot.has(type) && (await exists(`~${prefix}-feedback`, 1200))) {
      feedbackShot.add(type);
      await shot(`${tag}-${type}-feedback`);
    }
  }
  return out;
}

/** Through the end moments ("Continue", then the chain, then the screen's own last button). */
async function finishLesson(tag, prefix, until) {
  if (!(await exists(`~${prefix}-end`, 8000))) return false;
  await sleep(1500);
  await shot(`${tag}-complete`);
  for (let i = 0; i < 4; i++) {
    if (await exists(until, 1500)) return true;
    if (!(await tap(`~${prefix}-end-continue`, "end continue", 3000))) break;
    await sleep(1800);
    if (await exists(`~${prefix}-end`, 600)) await shot(`${tag}-end-${i + 2}`);
  }
  return exists(until, 8000);
}

// ---- the paywall -------------------------------------------------------------------
async function paywallCheck(tag) {
  await find("~paywall", 8000);
  await sleep(1200);
  await shot(`${tag}`);
  await checkSafeArea(tag, ["~paywall-close", "~paywall-buy", "~paywall-not-now"]);
  const plans = [];
  for (const p of ["yearly", "monthly", "family", "lifetime"]) {
    await scrollTo(`~plan-${p}`, 4);
    const l = await labelOf(`~plan-${p}`, 1500);
    if (l) plans.push(`${p}: "${l.slice(0, 70)}"`);
  }
  await shot(`${tag}-plans`);
  const note = (await labelOf("~paywall-price-note", 1500)) ?? "";
  const buy = (await labelOf("~paywall-buy", 1500)) ?? "";
  await scrollTo("~paywall-legal", 4);
  await shot(`${tag}-legal`);
  await scanOverflow(tag);
  return { plans, note, buy };
}

// ---- account deletion (the run's last step; retried in finally) ----------------------------
async function deleteAccount(tag) {
  await toTab("me");
  if (!(await scrollTo("~me-open-settings", 8))) return { ok: false, detail: "Settings row not found on Me" };
  await tap("~me-open-settings", "Settings");
  if (!(await find("~settings", 8000))) return { ok: false, detail: "Settings did not open" };
  if (!(await scrollTo("~settings-delete", 12))) return { ok: false, detail: "Delete account row not found" };
  await shot(`${tag}-settings-account`);
  await tap("~settings-delete", "Delete account");
  if (!(await find("~delete", 8000))) return { ok: false, detail: "delete screen did not open" };
  await sleep(800);
  await shot(`${tag}-delete`);
  await checkSafeArea("delete", ["~delete-header-back", "~delete-confirm"]);
  await tap("~delete-confirm", "Delete my account");
  if (!(await find("~confirm-ok", 6000))) return { ok: false, detail: "the confirm sheet did not open" };
  await sleep(600);
  await shot(`${tag}-confirm`);
  await tap("~confirm-ok", "Delete everything");
  // The server deletes first; only then does the phone reset to the welcome screen.
  let toast = null;
  const end = Date.now() + 30000;
  let welcome = false;
  while (Date.now() < end && !welcome) {
    toast = (await toastNow(200)) ?? toast;
    welcome = await exists("~welcome", 800);
  }
  await sleep(800);
  await shot(`${tag}-after-delete`);
  const deleted = welcome && (!toast || /deleted/i.test(toast));
  if (deleted) facts.accountDeleted = true;
  return { ok: deleted, detail: `${welcome ? "back on the welcome screen" : "NOT back on welcome"}; toast "${toast ?? "(none seen)"}"; friend code ${facts.friendCode ?? "(unknown)"}` };
}

// =================================================================================
try {
  try {
    await driver.updateSettings({ snapshotMaxDepth: 80, waitForIdleTimeout: 1 });
  } catch (e) {
    log("updateSettings failed:", msg(e));
  }
  win = await driver.getWindowSize();
  log("window", JSON.stringify(win));

  // ---- fresh install → welcome ---------------------------------------------------
  await section("BOOT", async () => {
    const w = await find("~welcome", 150000);
    await sleep(1500);
    const buf = await shot("welcome");
    await checkSafeArea("welcome", ["~welcome-start"]);
    await scanOverflow("welcome");
    return { ok: !!w && !blank(buf), detail: w ? "fresh install opened the welcome screen" : "welcome screen never appeared (150 s)" };
  });

  // ---- onboarding: why → new learner → dialect --------------------------------------
  await section("ONBOARDING", async () => {
    await tap("~welcome-start", "Start your first lesson");
    if (!(await find("~motive", 10000))) return { ok: false, detail: "motive screen missing" };
    await tap("~motive-family", "Talk with my family");
    await sleep(500);
    await shot("motive");
    await checkSafeArea("motive", ["~motive-header-back", "~motive-continue"]);
    await tap("~motive-continue", "continue");
    if (!(await find("~familiarity", 10000))) return { ok: false, detail: "familiarity screen missing" };
    await tap("~familiarity-new", "I'm new to Igbo");
    await sleep(500);
    await shot("familiarity");
    await tap("~familiarity-continue", "continue");
    if (!(await find("~dialect", 10000))) return { ok: false, detail: "dialect screen missing" };
    const list = await exists("~dialect-list", 8000);
    await sleep(600);
    await shot("dialect");
    await checkSafeArea("dialect", ["~dialect-header-back", "~dialect-continue"]);
    if (MODE === "small") await scanOverflow("dialect");
    await tap("~dialect-continue", "Continue with Standard Igbo");
    const intro = await find("~lesson-intro", 20000);
    const missing = intro ? false : await exists("~first-lesson-missing", 2000);
    return { ok: !!intro, detail: `motive → new learner → dialect (${list ? "areas listed" : "area list MISSING"}) → ${intro ? "first lesson intro" : missing ? `NO first lesson: "${await textsUnder("~first-lesson-missing")}"` : "nothing"}` };
  });

  // ---- the first lesson: the pattern card --------------------------------------------
  let lessonReady = await exists("~lesson-intro", 2000);
  await section("LESSON-INTRO", async () => {
    if (!lessonReady) return { ok: false, detail: "no lesson intro" };
    await sleep(1200);
    await shot("lesson-intro");
    await checkSafeArea("lesson-intro", ["~lesson-intro-close", "~lesson-intro-start"]);
    const pattern = await exists("~lesson-intro-pattern", 3000);
    const plays = await driver.$$(pred('name BEGINSWITH "lesson-intro-pattern-example-" AND name ENDSWITH "-play"'));
    const pend = await driver.$$(pred('name BEGINSWITH "lesson-intro-pattern-example-" AND name ENDSWITH "-pending"'));
    let played = "no example to play";
    if (plays.length) {
      await scrollTo("~lesson-intro-pattern-example-0-play", 3);
      await tap("~lesson-intro-pattern-example-0-play", "play the first example", 3000);
      await sleep(1500);
      const toast = await toastNow(500);
      played = `example 0 played, ${toast ? `toast "${toast}"` : "no toast"}`;
    }
    await drag("up", win.height * 0.4);
    await shot("lesson-intro-scrolled");
    if (MODE === "small") await scanOverflow("lesson-intro");
    return { ok: pattern && pend.length === 0 && plays.length > 0, detail: `pattern card ${pattern ? "shown" : "MISSING"}; ${plays.length} example(s) with a play button, ${pend.length} "Recording coming soon"; ${played}` };
  });

  // ---- the first lesson: every exercise ---------------------------------------------
  let lessonRun = null;
  await section("FIRST-LESSON", async () => {
    if (!lessonReady) return { ok: false, detail: "no lesson to play" };
    await tap("~lesson-intro-start", "Start lesson");
    if (!(await find("~lesson", 10000))) return { ok: false, detail: "the lesson player did not open" };
    lessonRun = await playLesson("lesson", { micCheck: MODE === "full", audioCheck: MODE === "full" });
    const types = {};
    for (const e of lessonRun.exercises) types[e.type] = (types[e.type] ?? 0) + 1;
    const end = await finishLesson("lesson", "lesson", "~account");
    return {
      ok: lessonRun.done && end,
      detail: `${lessonRun.exercises.length} exercise screens (${Object.entries(types).map(([t, c]) => `${t} ×${c}`).join(", ")}); ${lessonRun.done ? "reached the end moment" : "did NOT reach the end"}; ${end ? "→ account screen" : "account screen NOT reached"}`,
    };
  });

  if (MODE === "full") {
    await section("LESSON-RECORDINGS", async () => {
      if (!lessonRun) return { ok: false, detail: "lesson not played" };
      const withPlay = lessonRun.exercises.filter((e) => e.play).length;
      return {
        ok: lessonRun.pending.length === 0 && withPlay > 0,
        detail: `${withPlay}/${lessonRun.exercises.length} exercise screens had a play button; "Recording coming soon" on ${lessonRun.pending.length}${lessonRun.pending.length ? `: ${lessonRun.pending.join("; ")}` : ""}`,
      };
    });
    await section("LESSON-AUDIO", async () => {
      if (!lessonRun || !lessonRun.audio.length) return { ok: false, detail: "no play button was tapped" };
      return { ok: lessonRun.audio.every((a) => a.ok), detail: lessonRun.audio.map((a) => `${a.type}: ${a.detail}`).join(" | ") };
    });
    await section("MIC-PROMPT", async () => {
      if (!lessonRun?.mic) return { ok: null, detail: "no Say it exercise in the first lesson (tried again in Practice)" };
      return lessonRun.mic;
    });
    await section("TYPE-IT-KEYBOARD", async () => {
      if (!lessonRun?.keyboard) return { ok: null, detail: "no Type it exercise in the first lesson" };
      return lessonRun.keyboard;
    });
  }

  // ---- save your progress (adult, documents NOT accepted here) → reminder ----------------
  await section("ACCOUNT", async () => {
    if (!(await find("~account", 15000))) {
      if (await exists("~first-lesson-continue", 1000)) await tap("~first-lesson-continue", "continue without a lesson");
      if (!(await find("~account", 10000))) return { ok: false, detail: "account screen missing" };
    }
    await sleep(800);
    await shot("account");
    await tap("~account-age-band-18+", "18 or over");
    await sleep(500);
    await shot("account-adult");
    await checkSafeArea("account", ["~account-header-back", "~account-continue"]);
    await scanOverflow("account");
    const apple = await exists("~account-apple", 1500);
    const agree = await labelOf("~account-agree", 1500);
    await tap("~account-continue", "continue");
    const ok = await exists("~reminder", 10000);
    return { ok, detail: `age 18+ chosen; documents left for Community; Sign in with Apple button ${apple ? "shown" : "not shown"}; agree switch "${agree}"; ${ok ? "→ reminder" : "reminder NOT reached"}` };
  });

  await section("REMINDER", async () => {
    await sleep(600);
    if (MODE === "small") {
      await shot("reminder");
      await checkSafeArea("reminder", ["~reminder-start", "~reminder-none"]);
      await tap("~reminder-none", "No reminders");
      const learn = await exists("~learn", 15000);
      return { ok: learn, detail: `no reminders → ${learn ? "Learn" : "Learn NOT reached"}` };
    }
    await tap("~reminder-evening", "Evening");
    await sleep(500);
    await shot("reminder");
    await checkSafeArea("reminder", ["~reminder-start", "~reminder-none"]);
    await tap("~reminder-start", "Start learning");
    const alert = await systemAlert("notifications", 8000);
    const learn = await exists("~learn", 15000);
    return { ok: learn, detail: `${alert ? `notification prompt "${alert.text}" accepted with "${alert.accepted}"` : "no notification prompt"}; ${learn ? "→ Learn" : "Learn NOT reached"}` };
  });

  // ---- the soft paywall (once, after the first lesson) ------------------------------------
  let paywallSeen = false;
  await section("SOFT-PAYWALL", async () => {
    const shown = await find("~paywall", 9000);
    if (!shown) return { ok: null, detail: "the soft paywall did not open after the first lesson (store not ready on the simulator?); opened from Me later" };
    paywallSeen = true;
    const p = await paywallCheck("paywall-soft");
    await tap("~paywall-not-now", "Not now", 4000);
    const back = await exists("~learn", 8000);
    return { ok: p.plans.length === 4 && back, detail: `${p.plans.length}/4 plans: ${p.plans.join("; ")}; note "${p.note}"; buy "${p.buy}"; ${back ? "Not now → Learn" : "did NOT return to Learn"}` };
  });

  // ---- Learn and its path ------------------------------------------------------------------
  await section("LEARN", async () => {
    await toTab("learn");
    const hero = await exists("~learn-hero", 8000);
    await sleep(800);
    await shot("learn");
    await checkSafeArea("learn", ["~learn-continue", "~tab-learn", "~tab-me"]);
    await scanOverflow("learn");
    const path = await scrollTo("~learn-path", 6);
    await shot("learn-path");
    const unit = await exists("~learn-unit-1", 3000);
    let lesson2 = "lesson 2 not opened";
    if (MODE === "full" && (await scrollTo("~learn-unit-1-lesson-2", 4))) {
      await tap("~learn-unit-1-lesson-2", "Unit 1 lesson 2");
      if (await find("~lesson-intro", 10000)) {
        await sleep(1000);
        await shot("learn-lesson-2-intro");
        lesson2 = "lesson 2 intro opened from the path";
        await tap("~lesson-intro-close", "close", 3000);
        await sleep(1000);
      } else lesson2 = (await exists("~paywall", 1500)) ? "lesson 2 opened the paywall" : "lesson 2 did not open";
      if (await exists("~paywall", 800)) await tap("~paywall-not-now", "Not now", 3000);
    }
    for (let i = 3; i <= 4 && MODE === "full"; i++) {
      if (await scrollTo(`~learn-unit-${i}`, 6)) {
        await shot(`learn-unit-${i}`);
        break;
      }
    }
    return { ok: hero && path && unit, detail: `next-lesson card ${hero ? "shown" : "MISSING"}; path ${path ? "shown" : "MISSING"}; unit 1 ${unit ? "listed" : "MISSING"}; ${lesson2}` };
  });

  if (MODE === "full") {
    // ---- Practice: the dictionary --------------------------------------------------------
    await section("DICTIONARY", async () => {
      await toTab("practice");
      await find("~practice", 8000);
      await sleep(800);
      await shot("practice");
      await checkSafeArea("practice", ["~tab-practice"]);
      await scanOverflow("practice");
      if (!(await scrollTo("~practice-search", 6))) return { ok: false, detail: "dictionary launcher not found" };
      await tap("~practice-search", "Search the dictionary");
      if (!(await find("~dictionary", 8000))) return { ok: false, detail: "dictionary did not open" };
      await sleep(800);
      await shot("dictionary");
      const typed = await typeInto("~dictionary-input", "nne");
      await sleep(1200);
      const kb = await keyboardCheck("dictionary", "~dictionary-input", null);
      const hit = await find("~dictionary-hit-0", 10000);
      const hitLabel = hit ? await labelOf("~dictionary-hit-0", 800) : null;
      await shot("dictionary-nne");
      if (!hit) return { ok: false, detail: `typed ${typed}; no results for "nne"` };
      await hideKeyboard();
      await tap("~dictionary-hit-0", "first result");
      const word = await find("~word", 8000);
      await sleep(800);
      await shot("dictionary-word");
      await checkSafeArea("word", ["~word-back", "~word-play"]);
      await scanOverflow("word");
      const pending = await exists("~word-pending", 800);
      record("KEYBOARD-DICTIONARY", kb.ok === null ? "SKIP" : kb.ok ? "PASS" : "FAIL", kb.detail);
      return { ok: !!word, detail: `"nne" → first hit "${hitLabel}" → word page ${word ? "opened" : "MISSING"}; ${pending ? '"Recording coming soon" shown' : "recording available"}` };
    });

    await section("WORD-AUDIO", async () => {
      if (!(await exists("~word", 2000))) return { ok: false, detail: "not on a word page" };
      if (!(await exists("~word-play", 2000))) return { ok: false, detail: (await exists("~word-pending", 500)) ? 'word shows "Recording coming soon" (no play button)' : "no play button" };
      return listen("word", "~word-play", /Playing/);
    });

    // ---- Practice: the phrasebook ----------------------------------------------------------
    await section("PHRASEBOOK", async () => {
      await goBack("~word-back");
      await goBack("~dictionary-header-back");
      await toTab("practice");
      if (!(await scrollTo("~practice-real-life-phrasebook", 6))) return { ok: false, detail: "phrasebook entry not found" };
      await tap("~practice-real-life-phrasebook", "Phrasebook");
      if (!(await find("~phrasebook", 8000))) return { ok: false, detail: "phrasebook did not open" };
      await sleep(800);
      await shot("phrasebook");
      await scanOverflow("phrasebook");
      const sit = await find(pred('name BEGINSWITH "phrasebook-situation-"'), 6000);
      if (!sit) return { ok: false, detail: "no situations listed" };
      const sitName = await sit.getAttribute("name");
      await scrollTo(`~${sitName}`, 4);
      await tap(`~${sitName}`, sitName);
      if (!(await find("~situation", 8000))) return { ok: false, detail: `${sitName} did not open` };
      await sleep(800);
      await shot("phrasebook-situation");
      await scrollTo("~situation-phrase-0", 4);
      await tap("~situation-phrase-0", "first phrase");
      const phrase = await find("~phrase", 8000);
      await sleep(800);
      await shot("phrase");
      await checkSafeArea("phrase", ["~phrase-back", "~phrase-play"]);
      await scanOverflow("phrase");
      const igbo = await labelOf("~phrase-igbo", 1000);
      const pending = await exists("~phrase-pending", 600);
      return { ok: !!phrase, detail: `${sitName.replace("phrasebook-situation-", "")} → "${igbo}"; ${pending ? '"Recording coming soon"' : "recording available"}` };
    });

    await section("PHRASE-AUDIO", async () => {
      if (!(await exists("~phrase", 2000))) return { ok: false, detail: "not on a phrase page" };
      if (!(await exists("~phrase-play", 2000))) return { ok: false, detail: "no play button on the phrase" };
      return listen("phrase", "~phrase-play", /Playing/);
    });

    // ---- the microphone prompt, if the first lesson had no Say it ----------------------------
    if (!lessonRun?.mic) {
      await section("MIC-PROMPT-PRACTICE", async () => {
        await toTab("practice");
        if (!(await scrollTo("~practice-say", 6))) return { ok: false, detail: "Say it tile not found" };
        await tap("~practice-say", "Say it");
        if (!(await find("~speak", 8000))) return { ok: false, detail: "Say it did not open" };
        await shot("speak");
        if (!(await tap("~speak-start", "start", 5000))) return { ok: false, detail: "no words to say yet (speak-start missing)" };
        let type = null;
        for (let i = 0; i < 16 && !type; i++) {
          type = await exerciseType("speak-session");
          if (!type) await sleep(500);
        }
        if (type !== "say-it") return { ok: false, detail: `no Say it exercise (saw ${type})` };
        const r = await micPrompt("speak", "speak-session-say-it");
        await goBack("~speak-session-close");
        if (await exists("~confirm-ok", 1500)) await tap("~confirm-ok", "leave", 2000);
        return r;
      });
    }

    // ---- the Library ------------------------------------------------------------------------
    await section("LIBRARY", async () => {
      await toTab("learn");
      if (!(await scrollTo("~learn-library", 8))) return { ok: false, detail: "library card not found on Learn" };
      await tap("~learn-library", "Library");
      if (!(await find("~library", 8000))) return { ok: false, detail: "library did not open" };
      await sleep(1000);
      await shot("library");
      await checkSafeArea("library", ["~library-header-back"]);
      await scanOverflow("library");
      await drag("up");
      await shot("library-scrolled");
      const shelves = [];
      for (const s of ["names", "proverbs", "tales", "customs"]) if (await exists(`~library-${s}`, 1000)) shelves.push(s);
      return { ok: shelves.length === 4, detail: `shelves: ${shelves.join(", ") || "none"}` };
    });

    await section("PROVERB", async () => {
      if (!(await exists("~library", 1500))) await tap("~learn-library", "Library", 3000);
      if (!(await scrollTo("~library-proverbs", 6))) return { ok: false, detail: "proverbs shelf not found" };
      await tap("~library-proverbs", "Proverbs");
      if (!(await find("~proverbs", 8000))) return { ok: false, detail: "proverbs did not open" };
      await sleep(800);
      await shot("proverbs");
      if (!(await scrollTo("~proverbs-0", 6))) return { ok: false, detail: "no proverb listed" };
      await tap("~proverbs-0", "first proverb");
      if (!(await find("~proverb", 8000))) return { ok: false, detail: "proverb did not open" };
      await sleep(800);
      await shot("proverb");
      await checkSafeArea("proverb", ["~proverb-back", "~proverb-next"]);
      await scanOverflow("proverb");
      let audio = "no play button";
      if (await exists("~proverb-play", 1500)) {
        await tap("~proverb-play", "play the proverb");
        await sleep(2500);
        const toast = await toastNow(400);
        const alive = (await appState()) === 4;
        await shot("proverb-played");
        audio = `played, ${toast ? `toast "${toast}"` : "no toast"}${alive ? "" : ", APP NOT RUNNING"}`;
        if (toast || !alive) return { ok: false, detail: audio };
      } else if (await exists("~proverb-play-soon", 500)) audio = '"Recording coming soon"';
      await drag("up");
      await shot("proverb-meaning");
      await goBack("~proverb-back");
      await goBack("~proverbs-header-back");
      return { ok: true, detail: `proverb page shown; ${audio}` };
    });

    await section("TALE", async () => {
      if (!(await exists("~library", 2000))) return { ok: false, detail: "not back on the library" };
      if (!(await scrollTo("~library-tales", 6))) return { ok: false, detail: "tales shelf not found" };
      await tap("~library-tales", "Tales");
      if (!(await find("~tales", 8000))) return { ok: false, detail: "tales did not open" };
      await sleep(800);
      await shot("tales");
      await tap("~tales-0", "first tale", 4000);
      if (!(await find("~tale", 8000))) return { ok: false, detail: "tale did not open" };
      await sleep(1000);
      await shot("tale");
      await checkSafeArea("tale", ["~tale-back", "~tale-next"]);
      await scanOverflow("tale");
      await drag("up");
      await shot("tale-reading");
      let igbo = "no Igbo lines tab";
      if (await scrollTo("~tale-mode-ig", 4)) {
        await tap("~tale-mode-ig", "Igbo lines");
        await sleep(1000);
        igbo = (await exists("~tale-igbo", 3000)) ? "Igbo lines shown" : "Igbo lines MISSING";
        await shot("tale-igbo");
      }
      await goBack("~tale-back");
      await goBack("~tales-header-back");
      await goBack("~library-header-back");
      return { ok: true, detail: `tale page shown; ${igbo}` };
    });

    // ---- Community as an adult (creates the server account) ----------------------------------
    await section("COMMUNITY-TERMS", async () => {
      await toTab("community");
      await find("~community", 8000);
      await sleep(1000);
      await shot("community-terms");
      await checkSafeArea("community", ["~community-terms-accept", "~tab-community"]);
      await scanOverflow("community-terms");
      if (!(await exists("~community-terms", 4000))) {
        if (await exists("~community-friend-code", 1000)) return { ok: true, detail: "documents already accepted" };
        return { ok: false, detail: "no terms gate on Community (age gate?)" };
      }
      await scrollTo("~community-terms-agree", 6);
      await tap("~community-terms-agree", "I agree");
      await sleep(500);
      await shot("community-terms-agreed");
      await tap("~community-terms-accept", "Agree and continue");
      facts.accountCreated = true;
      const code = await find("~community-friend-code", 45000);
      facts.friendCode = code ? ((await code.getAttribute("label")) ?? "").trim() : null;
      await sleep(1000);
      await shot("community");
      const down = await exists("~community-down", 500);
      return { ok: !!facts.friendCode, detail: facts.friendCode ? `anonymous account created on the live server; friend code ${facts.friendCode}` : down ? `community down: "${await textsUnder("~community-down")}"` : "friend code never appeared (45 s)" };
    });

    await section("FAMILY-CIRCLE", async () => {
      await toTab("community");
      if (!(await scrollTo("~community-family", 4))) return { ok: false, detail: "Family Circle section missing" };
      await shot("community-family");
      // The circles load from the server first.
      let create = null;
      for (let i = 0; i < 24 && !create; i++) {
        if (await exists("~community-circle-create", 300)) create = "~community-circle-create";
        else if (await exists("~community-start-circle", 200)) create = "~community-start-circle";
        else await sleep(500);
      }
      if (!create) return { ok: false, detail: "no way to start a circle" };
      await scrollTo(create, 3);
      await tap(create, "Start a circle");
      const ok = await find("~circle-new", 8000);
      await sleep(800);
      await shot("circle-new");
      await checkSafeArea("circle-new", ["~circle-new-header-back", "~circle-new-submit"]);
      await scanOverflow("circle-new");
      await goBack("~circle-new-header-back");
      return { ok: !!ok, detail: ok ? "Start your Family Circle screen opened (nothing created)" : "circle screen did not open" };
    });

    await section("FRIENDS", async () => {
      await toTab("community");
      if (!(await scrollTo("~community-friends-all", 6))) return { ok: false, detail: "Friends section missing" };
      await shot("community-friends");
      await tap("~community-friends-all", "See all friends");
      const ok = await find("~friends", 8000);
      const code = await labelOf("~friends-code-value", 6000);
      await sleep(800);
      await shot("friends");
      await checkSafeArea("friends", ["~friends-header-back", "~friends-share"]);
      await scanOverflow("friends");
      await goBack("~friends-header-back");
      return { ok: !!ok, detail: ok ? `friends screen opened; code "${code}"` : "friends screen did not open" };
    });

    await section("CLUBS", async () => {
      await toTab("community");
      if (!(await scrollTo("~community-clubs", 8))) return { ok: false, detail: "Clubs section missing" };
      await shot("community-clubs");
      const browse = await exists("~community-browse-clubs", 2000);
      if (!browse) {
        const locked = await exists("~community-clubs-locked", 800);
        const mine = await exists("~community-my-club", 800);
        return { ok: mine, detail: locked ? "clubs locked for an adult?" : mine ? "already in a club" : "no Browse clubs button" };
      }
      await scrollTo("~community-browse-clubs", 3);
      await tap("~community-browse-clubs", "Browse clubs");
      const ok = await find("~clubs", 8000);
      await sleep(1500);
      await shot("clubs");
      await checkSafeArea("clubs", ["~clubs-header-back", "~clubs-create"]);
      await scanOverflow("clubs");
      const list = (await exists("~clubs-empty", 2000)) ? "no clubs yet" : "clubs listed";
      await goBack("~clubs-header-back");
      return { ok: !!ok, detail: ok ? `clubs browser opened (${list})` : "clubs did not open" };
    });

    // ---- Me → Your tools ---------------------------------------------------------------------
    await section("ME", async () => {
      await toTab("me");
      const ok = await find("~me", 8000);
      await sleep(800);
      await shot("me");
      await checkSafeArea("me", ["~tab-me"]);
      await scanOverflow("me");
      await drag("up");
      await shot("me-scrolled");
      return { ok: !!ok, detail: ok ? "Me shown" : "Me missing" };
    });

    for (const [tool, screen, label] of [
      ["flashcards", "flashcards", "Flashcards"],
      ["offline", "offline", "Offline packs"],
      ["report", "report", "Progress report"],
    ]) {
      await section(`TOOL-${tool.toUpperCase()}`, async () => {
        await toTab("me");
        if (!(await scrollTo(`~me-tools-${tool}`, 6))) return { ok: false, detail: `${label} row missing` };
        await tap(`~me-tools-${tool}`, label);
        const ok = await find(`~${screen}`, 10000);
        await sleep(1500);
        await shot(`tool-${tool}`);
        await checkSafeArea(screen, [`~${screen}-header-back`]);
        await scanOverflow(`tool-${tool}`);
        await drag("up");
        await shot(`tool-${tool}-scrolled`);
        await goBack(`~${screen}-header-back`);
        return { ok: !!ok, detail: ok ? `${label} opened` : `${label} did not open` };
      });
    }

    // ---- the paywall from Me (when the soft offer did not show) ------------------------------------
    await section("PAYWALL", async () => {
      await toTab("me");
      await scrollTop();
      if (!(await tap("~me-plus", "Okwu Plus card", 5000))) return { ok: false, detail: "Okwu Plus card missing on Me" };
      if (!(await find("~paywall", 8000))) return { ok: false, detail: "paywall did not open" };
      const p = await paywallCheck("paywall-me");
      await tap("~paywall-close", "close", 4000);
      const back = await exists("~me", 6000);
      return { ok: p.plans.length === 4 && back, detail: `${paywallSeen ? "(soft offer also seen) " : ""}${p.plans.length}/4 plans: ${p.plans.join("; ")}; note "${p.note}"; buy "${p.buy}"; close → ${back ? "Me" : "NOT Me"}` };
    });

    // ---- Settings → Credits --------------------------------------------------------------------
    await section("CREDITS", async () => {
      await toTab("me");
      if (!(await scrollTo("~me-open-settings", 8))) return { ok: false, detail: "Settings row missing on Me" };
      await tap("~me-open-settings", "Settings");
      if (!(await find("~settings", 8000))) return { ok: false, detail: "Settings did not open" };
      await sleep(800);
      await shot("settings");
      await checkSafeArea("settings", ["~settings-header-back"]);
      await scanOverflow("settings");
      await drag("up");
      await shot("settings-2");
      if (!(await scrollTo("~settings-credits", 12))) return { ok: false, detail: "Credits row missing" };
      await shot("settings-about");
      await tap("~settings-credits", "Credits");
      const ok = await find("~credits", 8000);
      await sleep(800);
      await shot("credits");
      await checkSafeArea("credits", ["~credits-header-back"]);
      await scanOverflow("credits");
      await drag("up");
      await shot("credits-2");
      await goBack("~credits-header-back");
      return { ok: !!ok, detail: ok ? "Credits opened from Settings" : "Credits did not open" };
    });

    // ---- the last step: delete the test account -----------------------------------------------------
    await section("DELETE-ACCOUNT", async () => {
      const r = await deleteAccount("delete");
      return r;
    });
  } else {
    // ---- small screen: the main tabs and Settings --------------------------------------------------
    for (const tab of ["practice", "community", "me"]) {
      await section(`SE-${tab.toUpperCase()}`, async () => {
        await toTab(tab);
        const ok = await find(`~${tab}`, 8000);
        await sleep(1200);
        await shot(tab);
        await checkSafeArea(tab, [`~tab-${tab}`, "~community-terms-accept"]);
        await scanOverflow(tab);
        await drag("up");
        await shot(`${tab}-scrolled`);
        return { ok: !!ok, detail: ok ? `${tab} shown` : `${tab} missing` };
      });
    }
    await section("SE-PAYWALL", async () => {
      if (paywallSeen) return { ok: true, detail: "soft paywall already captured" };
      await toTab("me");
      await scrollTop();
      if (!(await tap("~me-plus", "Okwu Plus card", 5000))) return { ok: false, detail: "Okwu Plus card missing" };
      const p = await paywallCheck("paywall");
      await tap("~paywall-close", "close", 4000);
      return { ok: p.plans.length === 4, detail: `${p.plans.length}/4 plans` };
    });
    await section("SE-SETTINGS", async () => {
      await toTab("me");
      if (!(await scrollTo("~me-open-settings", 8))) return { ok: false, detail: "Settings row missing" };
      await tap("~me-open-settings", "Settings");
      const ok = await find("~settings", 8000);
      await sleep(800);
      await shot("settings");
      await checkSafeArea("settings", ["~settings-header-back"]);
      await scanOverflow("settings");
      return { ok: !!ok, detail: ok ? "Settings shown" : "Settings missing" };
    });
  }

  record("APP-ALIVE-END", (await appState()) === 4 ? "PASS" : "FAIL", "app still in the foreground at the end");
} catch (e) {
  log("FATAL", msg(e));
  await shot("fatal");
  await source("fatal");
} finally {
  // Never leave the test account on the live server.
  if (MODE === "full" && facts.accountCreated && !facts.accountDeleted) {
    for (let attempt = 1; attempt <= 2 && !facts.accountDeleted; attempt++) {
      log(`account still on the server: deleting (attempt ${attempt})`);
      try {
        await driver.execute("mobile: activateApp", { bundleId: BUNDLE }).catch(() => {});
        await sleep(3000);
        const r = await deleteAccount(`cleanup-${attempt}`);
        record(`DELETE-ACCOUNT-RETRY-${attempt}`, r.ok ? "PASS" : "FAIL", r.detail);
      } catch (e) {
        record(`DELETE-ACCOUNT-RETRY-${attempt}`, "FAIL", `error: ${msg(e)}`);
      }
    }
  }
  record(
    "SAFE-AREA",
    layoutIssues.length ? "FAIL" : "PASS",
    layoutIssues.length ? layoutIssues.join(" | ") : "no control under the status bar, the island or the home indicator"
  );
  record("OVERFLOW", overflowNotes.length ? "WARN" : "PASS", overflowNotes.length ? overflowNotes.join(" | ") : "nothing runs off the side of the screen");
  const count = (s) => results.filter((r) => r.status === s).length;
  log(`SUMMARY: ${count("PASS")} pass, ${count("FAIL")} fail, ${count("WARN")} warn, ${count("SKIP")} skip`);
  fs.writeFileSync(`${SHOTS}/results-${MODE}.json`, JSON.stringify({ facts, window: win, results }, null, 2));
  try {
    await driver.deleteSession();
  } catch {}
  process.exitCode = count("FAIL") > 0 ? 1 : 0;
}
