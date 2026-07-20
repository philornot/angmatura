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

// Mobile devices get a cheaper, simpler animation: a band that grows
// outward from the centre of the screen (left and right) until it covers
// the whole viewport, instead of a circle expanding from the exact tap
// point. No radius-to-farthest-corner math, no dependency on where on the
// button the person tapped — just two clip-path keyframes. Lighter on
// weaker mobile GPUs and easier to follow visually on a small screen.
const MOBILE_MEDIA_QUERY = '(max-width: 768px)';
const MOBILE_WAVE_DURATION_MS = 500;

// Spam-proofing: while a theme transition is in flight, every additional
// toggle request (extra taps/clicks, a system colour-scheme change firing
// mid-animation, etc.) is simply ignored — on every device, whether it ends
// up taking the View Transition path, the crossfade fallback, or the
// instant reduced-motion path. This is deliberately a hard "drop the input"
// rather than "queue it up and play next": queuing still lets a burst of
// clicks chain into a rapid flicker of full theme swaps, which is exactly
// what this guards against. The promise resolves once the current
// transition (including its own settle time) is fully done.
let transitionInFlight: Promise<void> | null = null;

function isMobileViewport(): boolean {
    return typeof matchMedia === 'function' && matchMedia(MOBILE_MEDIA_QUERY).matches;
}

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
 *    before/after page for us. On desktop-sized viewports we grow a
 *    circular clip on the "new" snapshot from the origin point, so the new
 *    theme visibly spreads outward from wherever the person tapped, like
 *    ink soaking into paper. On mobile-sized viewports (see
 *    `isMobileViewport`) we use a simpler band that grows outward from the
 *    horizontal centre of the screen instead — cheaper to animate and
 *    easier to follow on a small screen.
 * 2. No View Transitions support, or no origin point (e.g. the system's
 *    color scheme changed while the tab was open, which has no tap
 *    position): a brief, uniform crossfade of every colour via the
 *    `.theme-crossfade` rule in app.css. No spreading circle, but still
 *    smooth rather than an instant, jarring swap.
 * 3. prefers-reduced-motion: reduce — apply instantly, no animation.
 *
 * In every case, a toggle request that arrives while a previous one is
 * still in flight is dropped rather than queued (see `transitionInFlight`),
 * so mashing the button can't chain into a rapid flicker of theme swaps.
 */
export function runThemeWave(origin: WaveOrigin | null, apply: () => void): void {
    // Spam guard: a transition is already running (any of the three modes
    // below), so this call — most likely an extra tap on an already-spammed
    // button — is dropped rather than queued. See `transitionInFlight`.
    if (transitionInFlight) return;

    if (prefersReducedMotion()) {
        apply();
        return;
    }

    const doc = document as DocumentWithViewTransitions;

    if (typeof doc.startViewTransition === 'function' && origin) {
        transitionInFlight = startWave(origin, apply).finally(() => {
            transitionInFlight = null;
        });
        return;
    }

    const root = document.documentElement;
    root.classList.add(CROSSFADE_CLASS);
    apply();
    transitionInFlight = new Promise<void>((resolve) => {
        window.setTimeout(() => {
            root.classList.remove(CROSSFADE_CLASS);
            transitionInFlight = null;
            resolve();
        }, CROSSFADE_DURATION_MS);
    });
}

/**
 * Kicks off a single "wave" transition and resolves once it's fully
 * settled (used by `runThemeWave` to know when it's safe to lift the spam
 * guard again).
 *
 * On desktop/large viewports this grows a circular clip-path from `origin`
 * until it covers the whole viewport. On mobile viewports it instead grows
 * a band outward from the horizontal centre of the screen — simpler to
 * compute and lighter to animate, and independent of exactly where on the
 * button the person tapped.
 *
 * Args:
 *     origin: Viewport point the wave should spread outward from (only
 *         used on non-mobile viewports).
 *     apply: Callback that flips the theme; passed straight through to
 *         `startViewTransition` so the browser can snapshot the before/after
 *         states around it.
 */
function startWave(origin: WaveOrigin, apply: () => void): Promise<void> {
    const doc = document as DocumentWithViewTransitions;
    if (typeof doc.startViewTransition !== 'function') {
        apply();
        return Promise.resolve();
    }

    let transition: ViewTransition;
    try {
        transition = doc.startViewTransition(apply);
    } catch {
        // Extremely defensive: if the browser advertises the API but
        // throws anyway, just apply the change directly.
        apply();
        return Promise.resolve();
    }

    const settled = transition.finished.catch(() => {
    }).then(() => undefined);

    const mobile = isMobileViewport();

    transition.ready
        .then(() => {
            if (mobile) {
                document.documentElement.animate(
                    {
                        clipPath: [
                            'inset(0 50% 0 50%)',
                            'inset(0 0% 0 0%)'
                        ]
                    },
                    {
                        duration: MOBILE_WAVE_DURATION_MS,
                        easing: WAVE_EASING,
                        pseudoElement: '::view-transition-new(root)'
                    }
                );
                return;
            }

            const {x, y} = origin;
            // Use visualViewport for more accurate dimensions on mobile
            // (address bar hiding/showing changes innerHeight during
            // animation). Kept here even though this branch is desktop-only
            // today, in case the mobile breakpoint ever changes.
            const vv = window.visualViewport;
            const width = vv ? vv.width : window.innerWidth;
            const height = vv ? vv.height : window.innerHeight;
            const endRadius = computeCoverRadius(x, y, width, height);

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
            // the theme itself is still correct — we just lose the wave
            // animation for this one switch.
        });

    return settled;
}
