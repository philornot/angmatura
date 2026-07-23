<script lang="ts">
    import {page} from '$app/state';
    import {ArrowLeft, Home, RefreshCw, Search} from '@lucide/svelte';

    // SvelteKit populates page.status/page.error for every thrown error —
    // both from load() functions (error()/throw) and from unmatched routes
    // (404). This one file is the catch-all for the whole app, so the copy
    // below is keyed off the status code rather than assuming it's always 404.
    let status = $derived(page.status);
    let message = $derived(page.error?.message ?? '');

    // icon is a string key rather than a component reference — resolved to an
    // actual lucide component with an {#if} chain in the template. Simpler
    // and safer across Svelte versions than passing components around as data.
    type IconKey = 'home' | 'back' | 'reload';

    type ErrorCopy = {
        mark: 'x' | 'question' | 'lock' | 'clock' | 'wave';
        margin: string; // handwritten-style red-pen margin note, mono
        title: string;
        body: string;
        primary: { label: string; href: string; icon: IconKey };
        secondary?: { label: string; action: 'back' | 'reload'; icon: IconKey };
    };

    const COPY: Record<number, ErrorCopy> = {
        404: {
            mark: 'question',
            margin: 'brak w zeszycie',
            title: 'Nie znaleziono tej strony',
            body: 'Tej kartki nie ma w zeszycie — sprawdź, czy adres jest poprawny, albo wróć do zestawów.',
            primary: {label: 'Strona główna', href: '/', icon: 'home'},
            secondary: {label: 'Moje zestawy', action: 'back', icon: 'back'}
        },
        401: {
            mark: 'lock',
            margin: 'wymagany podpis',
            title: 'Musisz się zalogować',
            body: 'Ta strona wymaga zalogowania. Wróć do panelu i podaj hasło jeszcze raz.',
            primary: {label: 'Strona główna', href: '/', icon: 'home'},
            secondary: {label: 'Spróbuj ponownie', action: 'back', icon: 'back'}
        },
        403: {
            mark: 'lock',
            margin: 'niedozwolone',
            title: 'Brak dostępu',
            body: 'Nie masz uprawnień, żeby zobaczyć tę stronę. Jeśli to pomyłka, wróć na start i spróbuj inaczej.',
            primary: {label: 'Strona główna', href: '/', icon: 'home'},
            secondary: {label: 'Wróć', action: 'back', icon: 'back'}
        },
        429: {
            mark: 'clock',
            margin: 'za szybko!',
            title: 'Zbyt wiele prób',
            body: 'Trochę za szybko przewracasz kartki. Odczekaj chwilę i spróbuj ponownie.',
            primary: {label: 'Strona główna', href: '/', icon: 'home'},
            secondary: {label: 'Odśwież', action: 'reload', icon: 'reload'}
        },
        500: {
            mark: 'wave',
            margin: 'poprawka nauczyciela',
            title: 'Coś poszło nie tak',
            body: 'Serwer się zaciął przy sprawdzaniu. To nie Twoja wina — spróbuj odświeżyć stronę za chwilę.',
            primary: {label: 'Strona główna', href: '/', icon: 'home'},
            secondary: {label: 'Odśwież stronę', action: 'reload', icon: 'reload'}
        }
    };

    function fallbackCopy(): ErrorCopy {
        return {
            mark: 'x',
            margin: `błąd ${status || ''}`.trim(),
            title: 'Wystąpił nieoczekiwany błąd',
            body: 'Coś poszło nie tak. Spróbuj odświeżyć stronę albo wróć na start.',
            primary: {label: 'Strona główna', href: '/', icon: 'home'},
            secondary: {label: 'Odśwież stronę', action: 'reload', icon: 'reload'}
        };
    }

    // 502/503/504 read the same as 500 — all "the server choked" stories.
    // Wrapped in a function (rather than a plain object) so the `status`
    // interpolated into fallbackCopy().margin stays reactive.
    let copy = $derived(
        COPY[status] ?? (status >= 500 ? COPY[500] : undefined) ?? fallbackCopy()
    );

    function handleSecondary() {
        if (!copy.secondary) return;
        if (copy.secondary.action === 'reload') {
            location.reload();
        } else {
            history.length > 1 ? history.back() : (location.href = '/');
        }
    }
</script>

<svelte:head>
    <title>{status ? `Błąd ${status}` : 'Błąd'} — angmatura</title>
</svelte:head>

<div class="container">
    <div class="error-card card">
        <div aria-hidden="true" class="mark-wrap">
            {#if copy.mark === 'question'}
                <svg viewBox="0 0 120 120" class="mark">
                    <circle cx="60" cy="60" r="52" class="mark-ring"/>
                    <path
                            d="M42 46c0-10 8-18 18-18s18 7 18 16c0 11-9 13-14 19-3 4-4 7-4 11"
                            class="mark-stroke" fill="none"/>
                    <circle cx="60" cy="90" r="4.5" class="mark-dot"/>
                </svg>
            {:else if copy.mark === 'lock'}
                <svg viewBox="0 0 120 120" class="mark">
                    <circle cx="60" cy="60" r="52" class="mark-ring"/>
                    <rect x="40" y="56" width="40" height="30" rx="5" class="mark-stroke" fill="none"/>
                    <path d="M48 56v-10a12 12 0 0 1 24 0v10" class="mark-stroke" fill="none"/>
                    <circle cx="60" cy="70" r="3.5" class="mark-dot"/>
                </svg>
            {:else if copy.mark === 'clock'}
                <svg viewBox="0 0 120 120" class="mark">
                    <circle cx="60" cy="60" r="52" class="mark-ring"/>
                    <circle cx="60" cy="62" r="24" class="mark-stroke" fill="none"/>
                    <path d="M60 48v16l12 8" class="mark-stroke" fill="none"/>
                </svg>
            {:else if copy.mark === 'wave'}
                <svg viewBox="0 0 120 120" class="mark">
                    <circle cx="60" cy="60" r="52" class="mark-ring"/>
                    <path d="M36 54c6-8 12-8 18 0s12 8 18 0 12-8 18 0" class="mark-stroke" fill="none"/>
                    <path d="M36 74c6-8 12-8 18 0s12 8 18 0 12-8 18 0" class="mark-stroke" fill="none"/>
                </svg>
            {:else}
                <svg viewBox="0 0 120 120" class="mark">
                    <circle cx="60" cy="60" r="52" class="mark-ring"/>
                    <path d="M42 42l36 36M78 42l-36 36" class="mark-stroke" fill="none"/>
                </svg>
            {/if}
        </div>

        {#if copy.margin}
            <p class="margin-note mono">{copy.margin}</p>
        {/if}

        <p class="status-code mono">błąd {status || '—'}</p>
        <h1>{copy.title}</h1>
        <!--
            Prefer the actual message coming from `error(status, 'message')` in
            load()/API endpoints — e.g. "Nie znaleziono zestawu." — since it's
            more specific than the generic per-status copy. 5xx messages tend to
            be raw/technical (or a generic SvelteKit fallback), so those still
            use the friendly copy plus a small technical-detail line below.
        -->
        <p class="body-text">{status < 500 && message ? message : copy.body}</p>

        {#if message && status >= 500 && message !== 'Internal Error' && message !== copy.body}
            <p class="detail mono">{message}</p>
        {/if}

        <div class="actions">
            <a class="btn btn-primary" href={copy.primary.href}>
                {#if copy.primary.icon === 'home'}
                    <Home size={18} aria-hidden="true"/>
                {:else if copy.primary.icon === 'back'}
                    <ArrowLeft size={18} aria-hidden="true"/>
                {:else}
                    <RefreshCw size={18} aria-hidden="true"/>
                {/if}
                {copy.primary.label}
            </a>
            {#if copy.secondary}
                <button type="button" class="btn btn-secondary" onclick={handleSecondary}>
                    {#if copy.secondary.icon === 'home'}
                        <Home size={18} aria-hidden="true"/>
                    {:else if copy.secondary.icon === 'back'}
                        <ArrowLeft size={18} aria-hidden="true"/>
                    {:else}
                        <RefreshCw size={18} aria-hidden="true"/>
                    {/if}
                    {copy.secondary.label}
                </button>
            {/if}
        </div>
    </div>

    {#if status === 404}
        <p class="hint">
            Szukasz konkretnego zestawu? <a href="/my-sets">
            <Search size={14} aria-hidden="true" style="vertical-align: -2px"/>
            Przejrzyj moje zestawy</a>.
        </p>
    {/if}
</div>

<style>
    .container {
        padding-top: 48px;
        padding-bottom: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        min-height: calc(100dvh - 200px);
        justify-content: center;
    }

    .error-card {
        width: 100%;
        max-width: 460px;
        padding: 40px 32px 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .mark-wrap {
        width: 84px;
        height: 84px;
        margin-bottom: 4px;
    }

    .mark {
        width: 100%;
        height: 100%;
    }

    .mark-ring {
        fill: none;
        stroke: var(--incorrect);
        stroke-width: 3.5;
        stroke-linecap: round;
        opacity: 0.55;
        /* hand-drawn "not quite a circle" wobble, matching the red-pen theme */
        stroke-dasharray: 300;
        stroke-dashoffset: 6;
    }

    .mark-stroke {
        stroke: var(--incorrect);
        stroke-width: 6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .mark-dot {
        fill: var(--incorrect);
    }

    .margin-note {
        font-size: 12px;
        font-weight: 600;
        color: var(--incorrect);
        text-transform: lowercase;
        letter-spacing: 0.02em;
        transform: rotate(-2deg);
        margin-bottom: 2px;
    }

    .status-code {
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 10px;
    }

    h1 {
        font-size: 26px;
        margin-bottom: 10px;
    }

    .body-text {
        color: var(--ink-soft);
        font-size: 15px;
        line-height: 1.55;
        max-width: 34ch;
    }

    .detail {
        margin-top: 14px;
        padding: 10px 14px;
        background: var(--incorrect-soft);
        color: var(--incorrect);
        border-radius: var(--radius-sm);
        font-size: 12.5px;
        word-break: break-word;
        max-width: 100%;
    }

    .actions {
        margin-top: 26px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
    }

    .hint {
        font-size: 14px;
        color: var(--muted);
    }

    .hint a {
        color: var(--accent-ink);
        font-weight: 600;
        text-decoration: none;
    }

    .hint a:hover {
        text-decoration: underline;
    }
</style>
