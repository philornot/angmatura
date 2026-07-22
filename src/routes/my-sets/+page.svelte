<script lang="ts">
    import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
    import FloatingCreateButton from '$lib/components/FloatingCreateButton.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import type {SetSummary, SetType} from '$lib/types';
    import {getDeviceId} from '$lib/deviceId';
    import {zestawForm} from '$lib/polishPlural';
    import {ArrowLeft, Info, Lock, Trash2} from '@lucide/svelte';

    const SECTION_TITLES: Record<SetType, string> = {
        kwt: 'Key Word Transformations',
        grammar: 'Gramatykalizacja',
        translation: 'Tłumaczenia'
    };

    const ORDER: SetType[] = ['kwt', 'grammar', 'translation'];

    let loading = $state(true);
    let sets = $state<SetSummary[]>([]);
    // Tracks which sets are mid-delete (single id, or every selected id
    // during a bulk delete) so their buttons/checkboxes show a busy state
    // and can't be double-submitted while the request is in flight.
    let deletingIds = $state<Set<number>>(new Set());
    // Which sets the user has ticked via checkbox, for bulk delete.
    let selectedIds = $state<Set<number>>(new Set());

    // Drives the ConfirmDialog. `pendingIds` is either one set (single
    // delete) or several (bulk delete) — the dialog doesn't care which,
    // it just confirms "trash these N sets".
    let pendingIds = $state<number[] | null>(null);

    function groupByType(list: SetSummary[]): Record<SetType, SetSummary[]> {
        const groups: Record<SetType, SetSummary[]> = {kwt: [], grammar: [], translation: []};
        for (const set of list) groups[set.type].push(set);
        return groups;
    }

    let groups = $derived(groupByType(sets));
    let selectedCount = $derived(selectedIds.size);

    function loadSets() {
        const deviceId = getDeviceId();
        if (!deviceId) {
            loading = false;
            return;
        }
        fetch(`/api/sets/mine?deviceId=${encodeURIComponent(deviceId)}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data: SetSummary[]) => {
                sets = data;
                loading = false;
            })
            .catch(() => {
                loading = false;
            });
    }

    // Same pattern as the review page: the device id only exists in
    // localStorage, so we don't know which sets are "ours" during SSR — fetch
    // them client-side once we can read the id.
    $effect(() => {
        loadSets();
    });

    function toggleSelected(id: number) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selectedIds = next;
    }

    /**
     * Actually moves the given sets to the trash. Shared by both the
     * single-set delete button and the bulk-delete bar — the only
     * difference between those two callers is how many ids they pass in.
     *
     * Args:
     *   ids: Set ids to move to the trash.
     */
    async function performTrash(ids: number[]) {
        deletingIds = new Set([...deletingIds, ...ids]);
        const deviceId = getDeviceId();

        const results = await Promise.allSettled(
            ids.map((id) =>
                fetch(`/api/sets/${id}/trash`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({deviceId})
                }).then((res) => ({id, ok: res.ok}))
            )
        );

        const succeededIds = new Set(
            results
                .filter((r): r is PromiseFulfilledResult<{
                    id: number;
                    ok: boolean
                }> => r.status === 'fulfilled' && r.value.ok)
                .map((r) => r.value.id)
        );
        const failedCount = ids.length - succeededIds.size;

        sets = sets.filter((s) => !succeededIds.has(s.id));
        selectedIds = new Set([...selectedIds].filter((id) => !succeededIds.has(id)));
        deletingIds = new Set([...deletingIds].filter((id) => !ids.includes(id)));

        if (failedCount > 0) {
            alert(
                failedCount === 1
                    ? 'Nie udało się usunąć zestawu. Spróbuj ponownie.'
                    : `Nie udało się usunąć ${failedCount} zestawów. Spróbuj ponownie.`
            );
        }
    }

    /**
     * Handles a click on a single set's delete button. Normally opens the
     * confirm dialog; holding Shift while clicking skips the confirmation
     * and trashes immediately, for anyone who wants to plow through several
     * sets quickly and doesn't need the safety net each time.
     *
     * Args:
     *   set: The set to trash.
     *   event: The click event, checked for the Shift modifier.
     */
    function requestTrashOne(set: SetSummary, event: MouseEvent) {
        if (event.shiftKey) {
            void performTrash([set.id]);
            return;
        }
        pendingIds = [set.id];
    }

    /** Opens the confirm dialog for every currently-selected set. Bulk
     *  delete always confirms — Shift-skip is only offered for the
     *  single-set button, since accidentally shift-clicking "delete
     *  selected" would be a much costlier mistake. */
    function requestTrashSelected() {
        if (selectedIds.size === 0) return;
        pendingIds = [...selectedIds];
    }

    function confirmPending() {
        if (pendingIds) void performTrash(pendingIds);
        pendingIds = null;
    }

    function cancelPending() {
        pendingIds = null;
    }

    let dialogMessage = $derived.by(() => {
        if (!pendingIds) return '';
        if (pendingIds.length === 1) {
            const set = sets.find((s) => s.id === pendingIds![0]);
            return `Czy na pewno chcesz usunąć „${set?.title ?? 'ten zestaw'}”?`;
        }
        return `Czy na pewno chcesz usunąć ${pendingIds.length} ${zestawForm(pendingIds.length)}?`;
    });
</script>

<svelte:head>
    <title>Moje zestawy — angmatura</title>
</svelte:head>

<div class="container page">
    <a class="back" href="/">
        <ArrowLeft aria-hidden="true" size={14}/>
        Strona główna</a>

    <h1>Moje zestawy</h1>

    <div class="explainer card">
        <Info aria-hidden="true" class="explainer-icon" size={18}/>
        <p>
            angmatura zapamiętuje, które zestawy zostały stworzone <strong>na tej przeglądarce</strong>,
            i pokazuje je tutaj jako twoje. Na innym telefonie lub komputerze ta lista będzie inna,
            a po wyczyszczeniu danych przeglądania zniknie.
        </p>
    </div>

    {#if loading}
        <p class="empty">Ładowanie…</p>
    {:else if sets.length === 0}
        <div class="empty-state card">
            <h2>Nie masz jeszcze żadnego zestawu</h2>
            <p>Stworzone przez Ciebie zestawy — publiczne i prywatne — pojawią się tutaj.</p>
            <a href="/create" class="btn btn-primary btn-block">Stwórz pierwszy zestaw</a>
        </div>
    {:else}
        <div class="list-header">
            <p class="count mono">{sets.length} {zestawForm(sets.length)}</p>
            {#if selectedCount > 0}
                <button type="button" class="btn btn-ghost bulk-delete-btn" onclick={requestTrashSelected}>
                    <Trash2 size={14} aria-hidden="true"/>
                    Usuń zaznaczone ({selectedCount})
                </button>
            {/if}
        </div>

        {#each ORDER as type (type)}
            {#if groups[type].length > 0}
                <section class="section">
                    <div class="section-head">
                        <h2>{SECTION_TITLES[type]}</h2>
                        <SetTypeBadge {type}/>
                    </div>
                    <ul class="set-list">
                        {#each groups[type] as set (set.id)}
                            <li class="set-row">
                                <input
                                        type="checkbox"
                                        class="set-checkbox"
                                        aria-label="Zaznacz „{set.title}”"
                                        checked={selectedIds.has(set.id)}
                                        disabled={deletingIds.has(set.id)}
                                        onchange={() => toggleSelected(set.id)}
                                />
                                <a href="/set/{set.slug}" class="set-card card">
                                    {#if !set.isPublic}
                                        <Lock size={14} aria-hidden="true" class="lock-icon"/>
                                    {/if}
                                    <span class="set-title">{set.title}</span>
                                    {#if set.sourceLabel}
                                        <span class="set-source">{set.sourceLabel}</span>
                                    {/if}
                                    <span class="set-count mono">{set.questionCount} pytań</span>
                                </a>
                                <button
                                        type="button"
                                        class="btn btn-ghost delete-btn"
                                        title="Przenieś do kosza (Shift+klik pomija potwierdzenie)"
                                        disabled={deletingIds.has(set.id)}
                                        onclick={(e) => requestTrashOne(set, e)}
                                >
                                    <Trash2 size={16} aria-hidden="true"/>
                                </button>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}
        {/each}
    {/if}

    <footer class="footer">
        <FloatingCreateButton href="/create"/>
    </footer>
</div>

<ConfirmDialog
        confirmLabel="Usuń"
        message={dialogMessage}
        onCancel={cancelPending}
        onConfirm={confirmPending}
        open={pendingIds !== null}
        title="Przenieść do kosza?"
/>

<style>
    .page {
        display: flex;
        flex-direction: column;
        gap: 20px;
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

    .explainer {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        background: var(--accent-soft);
    }

    .explainer p {
        font-size: 13.5px;
        color: var(--ink-soft);
        line-height: 1.55;
    }

    :global(.explainer-icon) {
        flex-shrink: 0;
        color: var(--accent-ink);
    }

    .count {
        font-size: 12px;
        color: var(--muted);
    }

    .list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 32px;
    }

    .bulk-delete-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--incorrect);
        font-size: 13px;
    }

    .set-checkbox {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        margin: 0;
        align-self: center;
        accent-color: var(--accent);
        cursor: pointer;
    }

    .set-checkbox:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .section-head {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .set-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .set-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 18px;
        text-decoration: none;
        color: var(--ink);
        border-left: 4px solid var(--rule);
        flex: 1;
    }

    .set-row {
        display: flex;
        align-items: stretch;
        gap: 8px;
    }

    .delete-btn {
        flex-shrink: 0;
        color: var(--muted);
    }

    .delete-btn:hover {
        color: var(--incorrect);
    }

    .delete-btn:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .set-card:hover {
        border-left-color: var(--accent);
    }

    :global(.lock-icon) {
        flex-shrink: 0;
        color: var(--muted);
    }

    .set-title {
        flex: 1;
        font-weight: 600;
    }

    .set-source {
        font-size: 13px;
        color: var(--muted);
    }

    .set-count {
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
    }

    .empty {
        color: var(--muted);
        text-align: center;
        padding: 40px 0;
    }

    .empty-state {
        padding: 32px 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .empty-state h2 {
        font-size: 20px;
    }

    .empty-state p {
        color: var(--ink-soft);
        font-size: 14px;
        margin-bottom: 8px;
    }

    .footer {
        display: flex;
        justify-content: center;
        padding-top: 8px;
    }
</style>
