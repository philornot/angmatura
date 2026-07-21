<script lang="ts">
	import {Plus} from '@lucide/svelte';
	import {fly} from 'svelte/transition';
	import {cubicOut} from 'svelte/easing';

	/**
     * A "Stwórz nowy zestaw" button meant to live at the bottom of a list.
     *
     * On a page with only a few sets it just sits in the normal document flow
     * as a plain, low-emphasis ghost button — same as before this component
     * existed. Once the list grows long enough that reaching it would mean
     * scrolling all the way down, it lifts itself into a floating, more
     * prominent pill pinned `minBottomGap` above the bottom of the viewport
     * instead — so the action is always within a thumb's reach, and stands
     * out against whatever content happens to be behind it. As soon as the
     * real, in-flow button scrolls back within that same minimum gap, the
     * floating pill steps aside and lets the plain one take over again.
     *
     * Implemented with a single IntersectionObserver on the in-flow anchor,
     * using a negative bottom rootMargin: that shrinks the "viewport" the
     * observer checks against by exactly `minBottomGap`, so `isIntersecting`
     * is already true/false at precisely the line we care about — no manual
     * scroll math needed.
     */
    let {
        href = '/create',
        label = 'Stwórz nowy zestaw',
        minBottomGap = 24
    }: {
        href?: string;
        label?: string;
        minBottomGap?: number;
    } = $props();

    let anchorEl = $state<HTMLElement>();
    // Starts docked so there's no flash of the floating pill before the
    // observer has had a chance to measure anything (e.g. during SSR/hydration).
    let docked = $state(true);

    $effect(() => {
        const el = anchorEl;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                docked = entry.isIntersecting;
            },
            {rootMargin: `0px 0px -${minBottomGap}px 0px`, threshold: 0}
        );
        observer.observe(el);
        return () => observer.disconnect();
    });
</script>

<!--
	The real button always stays in the layout (it reserves the space it
	would normally take), it's just visually hidden while the floating pill
	is standing in for it — that way the page never jumps.
-->
<div bind:this={anchorEl} class="anchor">
    <a class="btn btn-ghost" class:hidden-but-present={!docked} {href}>
        <Plus aria-hidden="true" size={16}/>
        {label}
    </a>
</div>

{#if !docked}
    <div class="floating-dock" style={`--gap: ${minBottomGap}px`}>
        <a
                {href}
                class="btn btn-primary floating-btn"
                in:fly={{ y: 16, duration: 260, easing: cubicOut }}
                out:fly={{ y: 10, duration: 180, easing: cubicOut }}
        >
            <Plus size={16} aria-hidden="true"/>
            {label}
        </a>
    </div>
{/if}

<style>
    .anchor {
        display: flex;
        justify-content: center;
    }

    .hidden-but-present {
        visibility: hidden;
    }

    .floating-dock {
        position: fixed;
        left: 0;
        right: 0;
        bottom: calc(var(--gap) + env(safe-area-inset-bottom, 0px));
        display: flex;
        justify-content: center;
        pointer-events: none;
        z-index: 30;
    }

    .floating-btn {
        pointer-events: auto;
        box-shadow: var(--shadow-card);
    }
</style>