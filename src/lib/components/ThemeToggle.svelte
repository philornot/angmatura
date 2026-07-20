<script lang="ts">
	import {Moon, Sun} from '@lucide/svelte';
	import {theme, toggleTheme} from '$lib/theme.svelte';

	// The wave has to spread from the exact spot the person tapped, not just
    // "somewhere near the button" — so we read the real pointer coordinates
    // off the event rather than e.g. the button's bounding box centre.
    function handleClick(event: MouseEvent) {
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
        transition: border-color 0.15s ease,
        color 0.15s ease,
        background-color 0.2s ease,
        transform 0.08s ease;
    }

    .theme-toggle:hover {
        border-color: var(--accent);
        color: var(--accent-ink);
    }

    .theme-toggle:active {
        transform: scale(0.92);
    }
</style>