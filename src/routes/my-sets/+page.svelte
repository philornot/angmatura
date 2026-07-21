<script lang="ts">
    import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
    import FloatingCreateButton from '$lib/components/FloatingCreateButton.svelte';
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
    // Tracks which set is mid-delete so its button can show a busy state and
    // can't be double-submitted while the request is in flight.
    let deletingId = $state<number | null>(null);

    function groupByType(list: SetSummary[]): Record<SetType, SetSummary[]> {
        const groups: Record<SetType, SetSummary[]> = {kwt: [], grammar: [], translation: []};
        for (const set of list) groups[set.type].push(set);
        return groups;
    }

    let groups = $derived(groupByType(sets));

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

    // Moves a set to the trash rather than deleting it outright — it can
    // still be recovered by an admin within 30 days (see /admin/trash). We
    // optimistically drop it from the visible list on success rather than
    // re-fetching the whole page.
    async function trashSet(set: SetSummary) {
        if (!confirm(`Przenieść „${set.title}” do kosza? Będzie można to cofnąć przez 30 dni.`)) return;

        deletingId = set.id;
        try {
            const res = await fetch(`/api/sets/${set.id}/trash`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({deviceId: getDeviceId()})
            });
            if (res.ok) {
                sets = sets.filter((s) => s.id !== set.id);
            } else {
                alert('Nie udało się usunąć zestawu. Spróbuj ponownie.');
            }
        } catch {
            alert('Nie udało się usunąć zestawu. Spróbuj ponownie.');
        } finally {
            deletingId = null;
        }
    }
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
        <p class="count mono">{sets.length} {zestawForm(sets.length)}</p>

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
                                        title="Przenieś do kosza"
                                        disabled={deletingId === set.id}
                                        onclick={() => trashSet(set)}
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
