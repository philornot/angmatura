/**
 * Drives the "wave" animation used when switching between light and dark
 * mode. Deliberately kept separate from theme.svelte.ts: this file has no
 * runes and no reactive state, just DOM/animation orchestration, so it stays
 * easy to unit-test (see themeTransition.test.ts) and easy to reason about.
 */

export interface WaveOrigin {
    x: number;
    y: number;
}

interface ViewTransition {
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    finished: Promise<void>;
    skipTransition: () => void;
}

interface DocumentWithViewTransitions extends Omit<Document, 'startViewTransition'> {
    startViewTransition?: (callback: () => void) => ViewTransition;
}

const WAVE_DURATION_MS = 650;
const WAVE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const CROSSFADE_CLASS = 'theme-crossfade';
const CROSSFADE_DURATION_MS = 500;

// A fast double-tap (easy to trigger by accident on a touchscreen, harder
// with a mouse) can call runThemeWave a second time before the first
// transition has finished. Letting both run at once forces the browser to
// juggle two full-page snapshots and two clip-path animations simultaneously
// — on weaker mobile GPUs this drops frames and the wave can visibly glitch
// or appear to originate from the wrong point. Tracking the in-flight
// transition lets a new tap cleanly cut the old one short first.
let activeTransition: ViewTransition | null = null;

/**
 * Radius (px) an expanding circle centred at (x, y) needs to fully cover a
 * width×height rectangle, i.e. the distance to whichever corner ends up
 * farthest from the origin. Pure and DOM-free on purpose, so it's cheap to
 * unit-test without a browser environment.
 */
export function computeCoverRadius(x: number, y: number, width: number, height: number): number {
    const dx = Math.max(x, width - x);
    const dy = Math.max(y, height - y);
    return Math.hypot(dx, dy);
}

function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Applies `apply()` — expected to flip the `data-theme` attribute (and
 * whatever else needs to change) — wrapped in whichever transition the
 * current browser can do best:
 *
 * 1. View Transitions API (Chrome/Edge 111+, Safari 18+, Firefox 144+, and
 *    effectively every current mobile browser): the browser snapshots the
 *    before/after page for us; we grow a circular clip on the "new"
 *    snapshot from the origin point so the new theme visibly spreads
 *    outward from wherever the person tapped, like ink soaking into paper.
 * 2. No View Transitions support, or no origin point (e.g. the system's
 *    color scheme changed while the tab was open, which has no tap
 *    position): a brief, uniform crossfade of every colour via the
 *    `.theme-crossfade` rule in app.css. No spreading circle, but still
 *    smooth rather than an instant, jarring swap.
 * 3. prefers-reduced-motion: reduce — apply instantly, no animation.
 */
export function runThemeWave(origin: WaveOrigin | null, apply: () => void): void {
    if (prefersReducedMotion()) {
        apply();
        return;
    }

    const doc = document as DocumentWithViewTransitions;

    if (typeof doc.startViewTransition === 'function' && origin) {
        const {x, y} = origin;
        const endRadius = computeCoverRadius(x, y, window.innerWidth, window.innerHeight);

        // Cut off a still-running transition instead of letting it fight the
        // new one for compositor time.
        activeTransition?.skipTransition();

        let transition: ViewTransition;
        try {
            transition = doc.startViewTransition(apply);
        } catch {
            // Extremely defensive: if the browser advertises the API but
            // throws anyway, just apply the change directly.
            apply();
            return;
        }

        activeTransition = transition;
        transition.finished.finally(() => {
            if (activeTransition === transition) activeTransition = null;
        });

        transition.ready
            .then(() => {
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`
                        ]
                    },
                    {
                        duration: WAVE_DURATION_MS,
                        easing: WAVE_EASING,
                        pseudoElement: '::view-transition-new(root)'
                    }
                );
            })
            .catch(() => {
                // The browser skipped the transition (e.g. the tab was
                // backgrounded, or another transition was already running).
                // apply() already ran as startViewTransition's callback, so
                // the theme itself is still correct — we just lose the
                // circle animation for this one switch.
            });
        return;
    }

    const root = document.documentElement;
    root.classList.add(CROSSFADE_CLASS);
    apply();
    window.setTimeout(() => root.classList.remove(CROSSFADE_CLASS), CROSSFADE_DURATION_MS);
}