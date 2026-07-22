<script lang="ts">
    /**
     * A small, reusable confirmation modal replacing the browser's native
     * `confirm()` — the native dialog can't be styled and shows the raw page
     * origin ("localhost:5173 says..."), which looks unpolished and breaks
     * the app's visual language.
     *
     * Usage:
     *   <ConfirmDialog
     *     open={showConfirm}
     *     title="Przenieść do kosza?"
     *     message="..."
     *     confirmLabel="Usuń"
     *     onConfirm={() => doTheThing()}
     *     onCancel={() => (showConfirm = false)}
     *   />
     *
     * The dialog is a plain conditionally-rendered div (not <dialog>), since
     * the rest of the app doesn't rely on <dialog>'s built-in stacking, and
     * this keeps behavior consistent across browsers with a single approach.
     */
    let {
        open,
        title,
        message,
        confirmLabel = 'Usuń',
        cancelLabel = 'Anuluj',
        danger = true,
        onConfirm,
        onCancel
    }: {
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        /** Styles the confirm button as a destructive action (red). Default
         *  true since this component exists mainly for delete-style prompts. */
        danger?: boolean;
        onConfirm: () => void;
        onCancel: () => void;
    } = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') onCancel();
    }
</script>

{#if open}
    <div class="backdrop" onclick={onCancel} onkeydown={handleKeydown} role="presentation">
        <div
                class="dialog card"
                role="alertdialog"
                tabindex="-1"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
        >
            <h2 id="confirm-dialog-title">{title}</h2>
            <p id="confirm-dialog-message">{message}</p>
            <div class="actions">
                <button type="button" class="btn btn-secondary" onclick={onCancel}>{cancelLabel}</button>
                <button
                        type="button"
                        class="btn btn-primary"
                        class:danger
                        onclick={onConfirm}
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
{/if}

<svelte:window onkeydown={open ? handleKeydown : undefined}/>

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 1000;
    }

    .dialog {
        width: 100%;
        max-width: 380px;
        padding: 22px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .dialog h2 {
        font-size: 18px;
    }

    .dialog p {
        font-size: 14px;
        color: var(--ink-soft);
        line-height: 1.5;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 6px;
    }

    .btn.danger {
        background: var(--incorrect);
        border-color: var(--incorrect);
        color: white;
    }
</style>
