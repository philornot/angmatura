<script lang="ts">
    import type {SetType} from '$lib/types';
    import {Languages, Repeat2, SpellCheck} from '@lucide/svelte';
    import {fly} from 'svelte/transition';
    import {cubicOut} from 'svelte/easing';

    /**
     * Desktop-only vertical quick-nav that sits in the page margin next to
     * the content column and jumps to a section on click. Icon-only by
     * design (spec: max 3 entries — kwt/grammar/translation — so labels
     * would be redundant weight; a native `title` tooltip covers discovery).
     *
     * Only rendered by the parent once there's more than one section on the
     * page — a single-section page has nothing to navigate *between*, so the
     * nav would just be clutter (spec: "jeśli jest tylko jeden typ zestawów,
     * nie pokazujemy menu").
     */
    let {sections}: { sections: { type: SetType; label: string }[] } = $props();

    const ICONS: Record<SetType, typeof Languages> = {
        kwt: Repeat2,
        grammar: SpellCheck,
        translation: Languages
    };

    let activeType = $state<SetType | null>(sections[0]?.type ?? null);
    let activeIndex = $derived(Math.max(0, sections.findIndex((s) => s.type === activeType)));

    // Tracks the currently-observed elements so we can swap targets cleanly
    // if `sections` ever changes (e.g. sets loading in after mount).
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

<nav
        aria-label="Przejdź do sekcji"
        class="quick-nav"
        in:fly={{x: -12, duration: 220, easing: cubicOut}}
        out:fly={{x: -12, duration: 160, easing: cubicOut}}
>
    <div class="indicator" style={`--index: ${activeIndex}`}></div>
    {#each sections as section, i (section.type)}
        {@const Icon = ICONS[section.type]}
        <button
                type="button"
                class="nav-btn"
                class:active={section.type === activeType}
                title={section.label}
                aria-label={section.label}
                aria-current={section.type === activeType ? 'true' : undefined}
                onclick={() => scrollTo(section.type)}
        >
            <Icon size={17} aria-hidden="true"/>
        </button>
    {/each}
</nav>

<style>
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

    .nav-btn:hover {
        color: var(--accent-ink);
        transform: scale(1.08);
    }

    .nav-btn.active {
        color: var(--accent-ink);
    }
</style>