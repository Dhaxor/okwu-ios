// Loads what the Community tab shows, through useSocial().client, only for
// what this learner may use (`can`), and again whenever social data changes
// (`social.rev`) or the app returns. Offline-safe: every part is optional,
// and a failure keeps what was last shown.
import { useCallback, useEffect, useRef, useState } from "react";
import { attempt, type CircleView, type ClubViewExt, type CohortView, type FriendsView, type SocialError, type VoiceNoteView } from "@/lib/social";
import { useSocial } from "@/lib/state";

export interface CommunityData {
  loading: boolean;
  /** The last failure (offline, server, refused), or null. */
  error: SocialError | null;
  circles: CircleView[] | null;
  /** The latest notes per circle (for the cards). */
  notes: Record<string, VoiceNoteView[]>;
  friends: FriendsView | null;
  cohort: CohortView | null;
  club: ClubViewExt | null;
  reload: () => void;
}

export function useCommunity(): CommunityData {
  const social = useSocial();
  const ready = social.gate === "open" && social.hasCreds;
  const [state, setState] = useState<Omit<CommunityData, "reload">>({ loading: true, error: null, circles: null, notes: {}, friends: null, cohort: null, club: null });
  const seq = useRef(0);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const canCircle = social.can("family-circle");
  const canFriends = social.can("friends-by-code");
  const canCohort = social.can("cohorts");
  const canClubs = social.can("clubs");
  const client = social.client;

  useEffect(() => {
    if (!ready) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: s.circles === null && s.friends === null }));
    void (async () => {
      const [circles, friends, cohort, club] = await Promise.all([
        canCircle ? attempt(client.myCircles()) : null,
        canFriends ? attempt(client.friends()) : null,
        canCohort ? attempt(client.myCohort()) : null,
        canClubs ? attempt(client.myClub()) : null,
      ]);
      const notes: Record<string, VoiceNoteView[]> = {};
      if (circles?.ok)
        for (const c of circles.value.slice(0, 5)) {
          const n = await attempt(client.voiceNotes(c.id));
          if (n.ok) notes[c.id] = n.value;
        }
      if (mine !== seq.current) return;
      const failed = [circles, friends, cohort, club].find((r) => r && !r.ok);
      setState((s) => ({
        loading: false,
        error: failed && !failed.ok ? failed.error : null,
        circles: circles?.ok ? circles.value : canCircle ? s.circles : null,
        notes: circles?.ok ? notes : s.notes,
        friends: friends?.ok ? friends.value : canFriends ? s.friends : null,
        cohort: cohort?.ok ? cohort.value : canCohort ? s.cohort : null,
        club: club?.ok ? club.value : canClubs ? s.club : null,
      }));
    })();
  }, [ready, client, canCircle, canFriends, canCohort, canClubs, social.rev, social.account?.id, nonce]);

  return { ...state, reload };
}
