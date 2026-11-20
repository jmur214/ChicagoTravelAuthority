import { distanceKm, type MatchConfidence, type PlaceCandidate, type ScoredCandidate } from '@cta/shared';

/** Words that don't help tell places apart. */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'at', 'on', 'in', 'chicago', 'il']);

/** Crude singular form so "Portillos", "Portillo's" and "Portillo" compare equal (applied to both sides). */
const singular = (t: string) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

/** "The Violet Hours!" → ["violet", "hour"]; "Lou Malnati's" → ["lou", "malnati"] */
export function nameTokens(name: string): string[] {
    return name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // accents
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/['’]s\b/g, '') // possessives
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter(t => t && !STOPWORDS.has(t))
        .map(singular);
}

const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
};

const dice = (a: string[], b: string[]) => {
    if (!a.length || !b.length) return 0;
    const counts = new Map<string, number>();
    for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
    let overlap = 0;
    for (const x of b) {
        const n = counts.get(x) ?? 0;
        if (n > 0) {
            overlap++;
            counts.set(x, n - 1);
        }
    }
    return (2 * overlap) / (a.length + b.length);
};

/**
 * 0–1 similarity between two place names: the best of word overlap, character
 * overlap (typos, spacing), and "one name contains the other"
 * (e.g. "Portillo's" vs "Portillo's Hot Dogs").
 */
export function nameSimilarity(a: string, b: string): number {
    const ta = nameTokens(a);
    const tb = nameTokens(b);
    if (!ta.length || !tb.length) return 0;
    const ja = ta.join('');
    const jb = tb.join('');
    if (ja === jb) return 1;

    const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    const contained = shorter.join('').length >= 4 && shorter.every(t => longer.includes(t));

    return Math.max(dice(ta, tb), dice(bigrams(ja), bigrams(jb)), contained ? 0.9 : 0);
}

/** Thresholds: close + similar name = confident; far away needs a near-identical name. */
export function confidenceFor(distanceMeters: number | null, nameScore: number): MatchConfidence {
    if (distanceMeters === null) return nameScore >= 0.85 ? 'medium' : 'low';
    if ((distanceMeters <= 150 && nameScore >= 0.6) || (distanceMeters <= 50 && nameScore >= 0.4)) return 'high';
    if ((distanceMeters <= 600 && nameScore >= 0.4) || (distanceMeters <= 3000 && nameScore >= 0.85)) return 'medium';
    return 'low';
}

export function scoreCandidate(
    target: { name: string; latitude?: number; longitude?: number },
    candidate: PlaceCandidate,
): ScoredCandidate {
    const distanceMeters =
        target.latitude !== undefined && target.longitude !== undefined
            ? Math.round(distanceKm(target.latitude, target.longitude, candidate.latitude, candidate.longitude) * 1000)
            : null;
    const nameScore = Math.round(nameSimilarity(target.name, candidate.name) * 100) / 100;
    return { ...candidate, distanceMeters, nameScore, confidence: confidenceFor(distanceMeters, nameScore) };
}

const RANK: Record<MatchConfidence, number> = { high: 2, medium: 1, low: 0 };

export function rankCandidates(scored: ScoredCandidate[]): ScoredCandidate[] {
    return [...scored].sort(
        (a, b) =>
            RANK[b.confidence] - RANK[a.confidence] ||
            b.nameScore - a.nameScore ||
            (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
    );
}

export type MatchDecision =
    | { kind: 'auto'; best: ScoredCandidate }
    | { kind: 'review'; candidates: ScoredCandidate[] }
    | { kind: 'none'; candidates: ScoredCandidate[] };

/**
 * Apply automatically only when exactly one candidate is a confident match.
 * Two confident candidates (e.g. a bar and the restaurant upstairs) go to review.
 */
export function decideMatch(scored: ScoredCandidate[]): MatchDecision {
    const ranked = rankCandidates(scored);
    const top = ranked.slice(0, 3);
    const confident = ranked.filter(c => c.confidence === 'high');

    if (confident.length === 1) return { kind: 'auto', best: confident[0] };
    if (confident.length > 1) {
        const [first, second] = confident;
        // A clearly better name breaks the tie.
        if (first.nameScore - second.nameScore >= 0.25) return { kind: 'auto', best: first };
        return { kind: 'review', candidates: top };
    }
    if (ranked.some(c => c.confidence === 'medium')) return { kind: 'review', candidates: top };
    return { kind: 'none', candidates: top };
}
