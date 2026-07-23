<script lang="ts">
    /**
     * A small, self-contained info-tooltip.
     *
     * The app already relies on native `title` attributes to hint that
     * Shift+click skips the confirm dialog on delete buttons, but a plain
     * `title` only shows up after a long hover and almost nobody discovers
     * it that way. This component renders an actual visible "i" badge next
     * to the relevant control; hovering/focusing it pops a styled tooltip
     * bubble, and tapping it works the same way on touch devices (no hover
     * needed). The existing `title` attributes are left in place — this is
     * additive, not a replacement.
     *
     * Usage:
     *   <Tooltip text="Shift+klik pomija potwierdzenie" />
     */
    let {
        text,
        label = 'Więcej informacji'
    }: {
        text: string;
        /** aria-label for the trigger button, for screen readers. */
        label?: string;
    } = $props();

    let open = $state(false);

    function show() {
        open = true;
    }

    function hide() {
        open = false;
    }

    function toggle(e: MouseEvent) {
        // Prevent the click from also bubbling to whatever button/link this
        // tooltip sits next to (e.g. a delete button that reads shiftKey).
        e.stopPropagation();
        e.preventDefault();
        open = !open;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') hide();
    }
</script>

<span class="tooltip-wrap">
    <button
            aria-expanded={open}
            aria-label={label}
            class="tooltip-trigger"
            onblur={hide}
            onclick={toggle}
            onfocus={show}
            onmouseenter={show}
            onmouseleave={hide}
            type="button"
    >
        i
    </button>
    {#if open}
        <span class="tooltip-bubble" role="tooltip">{text}</span>
    {/if}
</span>

<svelte:window onkeydown={open ? handleKeydown : undefined}/>

<style>
    .tooltip-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
    }

    .tooltip-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        min-width: 20px;
        border-radius: 50%;
        border: 1px solid var(--rule);
        background: var(--surface-soft, #f2f2f2);
        color: var(--muted);
        font-family: var(--font-mono);
        font-size: 11px;
        font-style: italic;
        font-weight: 700;
        line-height: 1;
        padding: 0;
        cursor: help;
        /* Enlarges the tap target well past the visible 20px circle without
           shifting surrounding layout (negative margin cancels the padding). */
        margin: -12px;
        padding: 12px;
        background-clip: padding-box;
    }

    .tooltip-trigger:hover,
    .tooltip-trigger:focus-visible {
        border-color: var(--accent);
        color: var(--accent);
        outline: none;
    }

    .tooltip-bubble {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        width: max-content;
        max-width: 220px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        background: var(--ink);
        color: var(--paper);
        font-size: 12px;
        line-height: 1.4;
        text-align: center;
        box-shadow: var(--shadow-card);
        z-index: 50;
        pointer-events: none;
    }

    .tooltip-bubble::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: var(--ink);
    }
</style>
