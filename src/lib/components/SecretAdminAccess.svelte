<script lang="ts">
    // Desktop half of the hidden admin-panel entry point (see also the
    // logo click-counter in +layout.svelte, which covers mobile and serves
    // as the always-available fallback on desktop too). Hovering the mouse
    // near the bottom-left corner of the screen reveals a small icon;
    // clicking it navigates to /admin (the login screen, if not already
    // authenticated).
    import {goto} from '$app/navigation';

    // How close (in pixels) the pointer needs to get to the bottom-left
    // corner of the viewport before the corner icon appears. Small enough
    // that it won't flash into view during ordinary use (scrolling to the
    // bottom of a page, mousing over the footer), but comfortably clickable
    // once it shows.
    const CORNER_REVEAL_DISTANCE = 80;

    let cornerVisible = $state(false);
    // Keeps the icon visible while it's actually being hovered/focused, even
    // if the mouse position calculation would otherwise hide it — avoids the
    // icon disappearing out from under the pointer right as someone tries to
    // click it.
    let cornerHovered = $state(false);

    function handlePointerMove(event: PointerEvent) {
        // Corner-hover reveal only makes sense with a mouse — a touchscreen
        // has no persistent pointer position to react to, so this stays
        // inert there and the 7-click logo path (see +layout.svelte) is the
        // intended route on mobile.
        if (event.pointerType !== 'mouse') return;

        const dx = event.clientX;
        const dy = window.innerHeight - event.clientY;
        const distance = Math.hypot(dx, dy);
        cornerVisible = distance <= CORNER_REVEAL_DISTANCE;
    }

    function handlePointerLeaveWindow() {
        cornerVisible = false;
    }
</script>

<svelte:window onpointerleave={handlePointerLeaveWindow} onpointermove={handlePointerMove}/>

<button
        aria-label="Panel administratora"
        class="corner-trigger"
        class:visible={cornerVisible || cornerHovered}
        onblur={() => (cornerHovered = false)}
        onclick={() => goto('/admin')}
        onfocus={() => (cornerHovered = true)}
        onmouseenter={() => (cornerHovered = true)}
        onmouseleave={() => (cornerHovered = false)}
        tabindex={cornerVisible || cornerHovered ? 0 : -1}
        type="button"
>
    <img alt="" aria-hidden="true" src="/secret_admin_icon.svg"/>
</button>

<style>
    .corner-trigger {
        position: fixed;
        left: 0;
        bottom: 0;
        width: 44px;
        height: 44px;
        padding: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transform: scale(0.6);
        transform-origin: bottom left;
        transition: opacity 0.15s ease,
        transform 0.15s ease;
        z-index: 2000;
    }

    .corner-trigger.visible {
        opacity: 0.85;
        pointer-events: auto;
        transform: scale(1);
    }

    .corner-trigger.visible:hover,
    .corner-trigger.visible:focus-visible {
        opacity: 1;
    }

    .corner-trigger img {
        width: 100%;
        height: 100%;
        display: block;
    }
</style>
