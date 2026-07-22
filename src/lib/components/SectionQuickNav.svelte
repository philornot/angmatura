<script lang="ts">
    import type {SetType} from '$lib/types';
    import {Languages} from '@lucide/svelte';
    import {fly} from 'svelte/transition';
    import {cubicOut} from 'svelte/easing';

    /**
     * Jump-to-section nav for the homepage, shown in two different shapes
     * depending on viewport (spec: icons-only floating pill on desktop, a
     * space-conscious sticky segmented control on mobile — no icon-only
     * squeeze on a narrow screen). Both share the same active-section
     * tracking and click-to-scroll logic; only the markup/CSS differ, picked
     * with a plain media query so there's no duplicated JS and no layout
     * flash from a JS-computed breakpoint.
     *
     * Only rendered by the parent once there's more than one section on the
     * page — a single-section page has nothing to navigate *between* (spec:
     * "jeśli jest tylko jeden typ zestawów, nie pokazujemy menu").
     */
    let {sections}: { sections: { type: SetType; label: string }[] } = $props();

    // Desktop: icon-only. KWT/Gramatykalizacja get a plain letter (spec) —
    // simpler and more legible at 17px than hunting for a "transformation"
    // or "grammar" glyph that reads clearly that small. Translation keeps
    // the Languages icon, there's no letter that would be unambiguous for it.
    const DESKTOP_GLYPH: Record<SetType, string | typeof Languages> = {
        kwt: 'K',
        grammar: 'G',
        translation: Languages
    };

    // Mobile: short but still readable text labels — there's room for these
    // horizontally, and on a tab bar a bare "K" / "G" would be far more
    // cryptic than in a hover-tooltipped desktop pill.
    const MOBILE_LABEL: Record<SetType, string> = {
        kwt: 'KWT',
        grammar: 'Gramatykalizacja',
        translation: 'Tłumaczenia'
    };

    let activeType = $state<SetType | null>(sections[0]?.type ?? null);
    let activeIndex = $derived(Math.max(0, sections.findIndex((s) => s.type === activeType)));

    $effect(() => {
        const els = sections
            .map((s) => document.getElementById(`section-${s.type}`))
            .filter((el): el is HTMLElement => el !== null);
        if (els.length === 0) return;

        // A thin horizontal band through the middle of the viewport: whichever
        // section is crossing it "owns" the indicator. Using a band instead of
        // the default whole-viewport box avoids the indicator flickering
        // between two sections when both are partially visible.
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const type = entry.target.getAttribute('data-section-type') as SetType | null;
                    if (type) activeType = type;
                }
            },
            {rootMargin: '-45% 0px -45% 0px', threshold: 0}
        );
        for (const el of els) observer.observe(el);
        return () => observer.disconnect();
    });

    function scrollTo(type: SetType) {
        activeType = type;
        document.getElementById(`section-${type}`)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
</script>

<!-- Desktop: floating vertical pill in the page margin -->
<nav
        class="quick-nav"
        aria-label="Przejdź do sekcji"
        in:fly={{x: -12, duration: 220, easing: cubicOut}}
        out:fly={{x: -12, duration: 160, easing: cubicOut}}
>
    <div class="indicator" style={`--index: ${activeIndex}`}></div>
    {#each sections as section (section.type)}
        {@const glyph = DESKTOP_GLYPH[section.type]}
        <button
                type="button"
                class="nav-btn"
                class:active={section.type === activeType}
                title={section.label}
                aria-label={section.label}
                aria-current={section.type === activeType ? 'true' : undefined}
                onclick={() => scrollTo(section.type)}
        >
            {#if typeof glyph === 'string'}
                <span class="glyph-letter">{glyph}</span>
            {:else}
                {@const Icon = glyph}
                <Icon size={17} aria-hidden="true"/>
            {/if}
        </button>
    {/each}
</nav>

<!-- Mobile: sticky segmented control -->
<nav aria-label="Przejdź do sekcji" class="tab-bar" style={`--count: ${sections.length}`}>
    <div class="tab-indicator" style={`--index: ${activeIndex}`}></div>
    {#each sections as section (section.type)}
        <button
                type="button"
                class="tab-btn"
                class:active={section.type === activeType}
                aria-current={section.type === activeType ? 'true' : undefined}
                onclick={() => scrollTo(section.type)}
        >
            {MOBILE_LABEL[section.type]}
        </button>
    {/each}
</nav>

<style>
    /* ---------- desktop pill ---------- */

    .quick-nav {
        position: fixed;
        left: max(24px, calc(50% - 400px));
        top: 50%;
        transform: translateY(-50%);
        display: none;
        flex-direction: column;
        gap: 6px;
        padding: 6px;
        background: var(--paper-raised);
        border: 1px solid var(--rule);
        border-radius: 999px;
        box-shadow: var(--shadow-card);
        z-index: 20;
    }

    @media (min-width: 1100px) {
        .quick-nav {
            display: flex;
        }
    }

    .indicator {
        position: absolute;
        top: 6px;
        left: 6px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--accent-soft);
        transform: translateY(calc(var(--index) * (34px + 6px)));
        transition: transform 280ms cubic-bezier(0.34, 1.2, 0.4, 1);
        z-index: -1;
    }

    .nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        transition: color 160ms ease, transform 160ms ease;
    }

    .glyph-letter {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 15px;
        line-height: 1;
    }

    .nav-btn:hover {
        color: var(--accent-ink);
        transform: scale(1.08);
    }

    .nav-btn.active {
        color: var(--accent-ink);
    }

    /* ---------- mobile segmented control ---------- */

    .tab-bar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: repeat(var(--count), 1fr);
        gap: 2px;
        padding: 3px;
        margin: 0 -20px;
        background: var(--paper);
        border-bottom: 1px solid var(--rule);
    }

    @media (min-width: 1100px) {
        .tab-bar {
            display: none;
        }
    }

    .tab-indicator {
        position: absolute;
        top: 3px;
        bottom: 3px;
        left: 3px;
        width: calc((100% - 6px) / var(--count));
        border-radius: var(--radius-sm);
        background: var(--accent-soft);
        transform: translateX(calc(var(--index) * 100%));
        transition: transform 280ms cubic-bezier(0.34, 1.2, 0.4, 1);
    }

    .tab-btn {
        position: relative;
        padding: 9px 6px;
        border: none;
        background: transparent;
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: color 160ms ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tab-btn.active {
        color: var(--accent-ink);
    }
</style>
