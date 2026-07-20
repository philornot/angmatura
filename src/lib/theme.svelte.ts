import {runThemeWave} from './themeTransition';

export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'angmatura-theme';

// Kept in sync with the `<meta name="theme-color">` default in app.html and
// with the --paper / --paper-raised values in app.css, so the browser's own
// chrome (address bar on mobile, etc.) matches the page the instant the
// theme changes.
const META_COLOR: Record<ThemeName, string> = {
    light: '#eef1f2',
    dark: '#10141a'
};

let current = $state<ThemeName>('light');

function isThemeName(value: string | null): value is ThemeName {
    return value === 'light' || value === 'dark';
}

function readStoredTheme(): ThemeName | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isThemeName(stored) ? stored : null;
    } catch {
        // Storage can throw in private browsing / with storage disabled —
        // the user just won't get a persisted preference across visits.
        return null;
    }
}

function persistTheme(next: ThemeName): void {
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // Same as above: the theme still applies for this session, it just
        // won't be remembered next time.
    }
}

function systemPrefersDark(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function writeThemeToDom(next: ThemeName): void {
    document.documentElement.setAttribute('data-theme', next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[next]);
}

/**
 * Reactive handle for components: `theme.current` tracks exactly like a
 * rune read would. It's exposed as an object with a getter — rather than
 * re-exporting the `let` directly — because that's the only way to share
 * live `$state` across module boundaries in Svelte 5.
 */
export const theme = {
    get current(): ThemeName {
        return current;
    }
};

/**
 * Boots the theme for this page load. The inline script in app.html has
 * already set `data-theme` on <html> before first paint (to avoid a flash
 * of the wrong theme); this just brings the reactive `theme.current` value
 * in sync with that, and starts listening for the *system* preference
 * changing while the tab stays open — but only for as long as the person
 * hasn't picked a theme manually, since an explicit choice should stick.
 *
 * Client-only: call once from the root layout, e.g. inside `$effect`.
 */
export function initTheme(): void {
    const stored = readStoredTheme();
    current = stored ?? (systemPrefersDark() ? 'dark' : 'light');
    writeThemeToDom(current);

    if (typeof matchMedia !== 'function') return;

    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (readStoredTheme()) return; // an explicit choice already exists — don't override it
        const next: ThemeName = event.matches ? 'dark' : 'light';
        // No click position for a system-triggered switch, so this always
        // takes the crossfade path rather than the circle wave — see
        // runThemeWave's fallback branch.
        runThemeWave(null, () => {
            current = next;
            writeThemeToDom(next);
        });
    });
}

/**
 * Flips light ↔ dark, animated as a wave spreading outward from
 * (originX, originY) — typically the exact point the person tapped on the
 * toggle button.
 */
export function toggleTheme(originX: number, originY: number): void {
    const next: ThemeName = current === 'dark' ? 'light' : 'dark';
    runThemeWave({x: originX, y: originY}, () => {
        current = next;
        writeThemeToDom(next);
        persistTheme(next);
    });
}
