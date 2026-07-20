<script lang="ts">
    import {Moon, Sun} from '@lucide/svelte';
    import {theme, toggleTheme} from '$lib/theme.svelte';

    // Store the real pointer coordinates from pointerdown, because on mobile
    // the click event often has incorrect coordinates (0,0 or delayed).
    // This way we always have the actual touch/click position.
    let lastPointer = {x: 0, y: 0};

    function handlePointerDown(e: PointerEvent) {
        lastPointer = {x: e.clientX, y: e.clientY};
    }

    function handleClick(event: MouseEvent) {
        const button = event.currentTarget as HTMLButtonElement;
        const rect = button.getBoundingClientRect();

        // Use stored pointer coordinates, or fall back to button centre
        // if for some reason pointerdown didn't fire (e.g. keyboard activation)
        const x = lastPointer.x || rect.left + rect.width / 2;
        const y = lastPointer.y || rect.top + rect.height / 2;

        toggleTheme(x, y);
    }
</script>

<button
        aria-label={theme.current === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
        class="theme-toggle"
        onpointerdown={handlePointerDown}
        onclick={handleClick}
        title={theme.current === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
        type="button"
>
    {#if theme.current === 'dark'}
        <Sun size={19} aria-hidden="true"/>
    {:else}
        <Moon size={19} aria-hidden="true"/>
    {/if}
</button>

<style>
    .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: var(--tap-min);
        height: var(--tap-min);
        border-radius: 999px;
        border: 1.5px solid var(--rule); /* todo: fix Float px values may render differently on different browsers */
        background: var(--paper-raised);
        color: var(--ink-soft);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        /* Tells the browser this button never needs the double-tap-to-zoom
           gesture, so it can dispatch the tap immediately instead of
           waiting ~300ms to see if a second tap follows — noticeably
           snappier on touchscreens. */
        touch-action: manipulation;
        transition: border-color 0.15s ease,
        color 0.15s ease,
        background-color 0.2s ease,
        transform 0.08s ease;
    }

    /* Scoped to devices with a real hovering pointer (mouse/trackpad). Without
       this, tapping the button on a touchscreen leaves it visually "stuck" in
       the hover state until the person taps elsewhere, since touch has no
       real hover to leave. */
    @media (hover: hover) and (pointer: fine) {
        .theme-toggle:hover {
            border-color: var(--accent);
            color: var(--accent-ink);
        }
    }

    .theme-toggle:active {
        transform: scale(0.92);
    }
</style>
