<script lang="ts">
    import {Moon, Sun} from '@lucide/svelte';
    import {theme, toggleTheme} from '$lib/theme.svelte';

    // The wave has to spread from the exact spot the person tapped, not just
    // "somewhere near the button" — so we read the real pointer coordinates
    // off the event rather than e.g. the button's bounding box centre.
    //
    // The one exception: activations that have no real tap point. Keyboard
    // (Enter/Space) and many assistive-technology activations (VoiceOver on
    // iOS, TalkBack on Android — both very much "mobile devices") fire a
    // synthetic click with clientX/clientY pinned to 0 and event.detail set
    // to 0. Reading those coordinates literally makes the wave spread from
    // the screen's top-left corner instead of the button, which is exactly
    // the "not from the button" bug this fixes — so in that case we fall
    // back to the button's own centre instead.
    function handleClick(event: MouseEvent) {
        if (event.detail === 0) {
            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
            toggleTheme(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return;
        }
        toggleTheme(event.clientX, event.clientY);
    }
</script>

<button
        aria-label={theme.current === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
        class="theme-toggle"
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
        border: 1.5px solid var(--rule);
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