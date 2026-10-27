// Content reports on this device (./reports.ts is the tested logic). One
// store shared by every screen: the report sheet adds, the reports sheet
// lists and exports. Nothing is uploaded until a content route exists
// (CONTENT_REPORT_ROUTE); the queue survives restarts (okwu.contentreports.v1).
import { useCallback, useSyncExternalStore } from "react";
import { deviceKV } from "./kv";
import { REPORTS_KEY, addReport, makeReport, parseReports, queued, serializeReports, type ContentReport, type ReportInput } from "./reports";
import { createStore } from "./store";

const store = createStore<ContentReport[]>({ key: REPORTS_KEY, kv: deviceKV, parse: parseReports, serialize: serializeReports, debounceMs: 0 });
let reports: ContentReport[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  if (!loaded) {
    loaded = true;
    void store.load().then((v) => {
      // A report made before the load finished is kept in front of the stored ones.
      reports = [...reports, ...v.filter((r) => !reports.some((x) => x.id === r.id))];
      emit();
    });
  }
  return () => listeners.delete(l);
}

export interface ContentReports {
  reports: ContentReport[];
  /** Reports not sent anywhere yet (all of them, until a content route exists). */
  queued: number;
  submit: (input: ReportInput) => ContentReport;
}

export function useContentReports(): ContentReports {
  const list = useSyncExternalStore(subscribe, () => reports, () => reports);
  const submit = useCallback((input: ReportInput) => {
    const report = makeReport(input, new Date());
    reports = addReport(reports, report);
    store.save(reports);
    void store.flush();
    emit();
    return report;
  }, []);
  return { reports: list, queued: queued(list).length, submit };
}
