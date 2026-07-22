<script lang="ts">
	import {enhance} from '$app/forms';
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
	import {ArrowLeft, RotateCcw, Trash2} from '@lucide/svelte';

	let {data, form} = $props();

    /**
     * Days remaining before a trashed set is eligible for permanent purging.
     * Purging itself happens server-side (see +page.server.ts `load`), this
     * is purely a countdown so the admin knows how much time is left.
     *
     * Args:
     *   deletedAt: ISO timestamp string of when the set was trashed.
     *   retentionDays: how many days a set stays in the trash before purge.
     *
     * Returns:
     *   Whole days left, floored at 0 (never negative — a set past its
     *   window will be gone on the next page load anyway).
     */
    function daysLeft(deletedAt: string, retentionDays: number): number {
        const deletedMs = new Date(deletedAt.replace(' ', 'T') + 'Z').getTime();
        const elapsedDays = (Date.now() - deletedMs) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.ceil(retentionDays - elapsedDays));
    }
</script>

<svelte:head>
    <title>Kosz — angmatura</title>
</svelte:head>

<div class="container page">
    {#if !data.authed}
        <p class="empty">Zaloguj się w panelu administratora, aby zobaczyć kosz.</p>
        <a href="/admin" class="btn btn-secondary">Przejdź do panelu</a>
    {:else}
        <a class="back" href="/admin">
            <ArrowLeft aria-hidden="true" size={14}/>
            Panel administratora</a>

        <h1>Kosz</h1>
        <p class="subtitle">
            Usunięte zestawy trafiają tutaj i są trzymane przez {data.retentionDays} dni, zanim znikną na
            stałe.
        </p>

        {#if form && 'message' in form && form.message}
            <p class="error-banner">{form.message}</p>
        {/if}

        {#if data.sets.length === 0}
            <p class="empty">Kosz jest pusty.</p>
        {:else}
            <ul class="set-list">
                {#each data.sets as set (set.id)}
                    <li class="set-row card">
                        <div class="set-info">
                            <SetTypeBadge type={set.type}/>
                            <span class="title">{set.title}</span>
                            <span class="count mono">{set.questionCount} pytań</span>
                        </div>
                        <p class="deleted-note">
                            Usunięty {set.deletedAt ? new Date(set.deletedAt.replace(' ', 'T') + 'Z').toLocaleDateString('pl-PL') : ''}
                            — {set.deletedAt ? daysLeft(set.deletedAt, data.retentionDays) : data.retentionDays} dni do
                            trwałego usunięcia
                        </p>
                        <div class="set-actions">
                            <form method="POST" action="?/restore" use:enhance>
                                <input type="hidden" name="id" value={set.id}/>
                                <button type="submit" class="btn btn-secondary">
                                    <RotateCcw size={14} aria-hidden="true"/>
                                    Przywróć
                                </button>
                            </form>
                            <form
                                    method="POST"
                                    action="?/destroy"
                                    use:enhance={({ cancel }) => {
									if (!confirm(`Usunąć „${set.title}” na stałe? Tej operacji nie można cofnąć.`)) cancel();
								}}
                            >
                                <input type="hidden" name="id" value={set.id}/>
                                <button type="submit" class="btn btn-ghost danger">
                                    <Trash2 size={14} aria-hidden="true"/>
                                    Usuń na stałe
                                </button>
                            </form>
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    {/if}
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 8px;
    }

    .back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: var(--muted);
        text-decoration: none;
    }

    h1 {
        font-size: 22px;
    }

    .subtitle {
        font-size: 13.5px;
        color: var(--ink-soft);
    }

    .error-banner {
        background: var(--incorrect-soft);
        color: var(--incorrect);
        padding: 10px 14px;
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .empty {
        color: var(--muted);
        text-align: center;
        padding: 40px 0;
    }

    .set-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .set-row {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .set-info {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .title {
        font-weight: 600;
        flex: 1;
    }

    .count {
        font-size: 12px;
        color: var(--muted);
    }

    .deleted-note {
        font-size: 12.5px;
        color: var(--muted);
    }

    .set-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .set-actions form {
        display: contents;
    }

    .set-actions button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .danger {
        color: var(--incorrect);
    }
</style>
