<script lang="ts">
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import {ArrowLeft, RotateCcw, Trash2} from '@lucide/svelte';
	import {zestawForm} from '$lib/polishPlural';
	import type {SetSummary} from '$lib/types';

	let {data, form} = $props();

	// Local mirror of data.sets so bulk actions can update the list in place
	// without a full page reload, same pattern as the main admin panel.
	let sets = $state<SetSummary[]>([]);
	$effect(() => {
		sets = data.authed ? [...data.sets] : [];
	});

	let selectedIds = $state<Set<number>>(new Set());
	let selectedCount = $derived(selectedIds.size);
	let bulkBusy = $state(false);

	// Drives the confirm dialog for permanent deletion ("destroy") only —
	// restoring is fully reversible (the set just moves back to the main
	// list, where deleting it again would only re-trash it), so it never
	// needs a confirmation step, single or bulk.
	let pendingDestroyIds = $state<number[] | null>(null);

	function toggleSelected(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		selectedIds = selectedIds.size === sets.length ? new Set() : new Set(sets.map((s) => s.id));
	}

	async function runBulkAction(action: 'restore' | 'destroy', ids: number[]) {
		bulkBusy = true;
		try {
			const res = await fetch('/api/admin/sets/bulk', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({ids, action})
			});
			if (!res.ok) {
				alert('Nie udało się wykonać akcji. Spróbuj ponownie.');
				return;
			}
			// Both restore and destroy remove the set from *this* screen — a
			// restored set belongs on the main admin list now, not the trash.
			sets = sets.filter((s) => !ids.includes(s.id));
			selectedIds = new Set([...selectedIds].filter((id) => !ids.includes(id)));
		} catch {
			alert('Nie udało się wykonać akcji. Spróbuj ponownie.');
		} finally {
			bulkBusy = false;
		}
	}

	function restoreOne(set: SetSummary) {
		void runBulkAction('restore', [set.id]);
	}

	function restoreSelected() {
		if (selectedIds.size === 0) return;
		void runBulkAction('restore', [...selectedIds]);
	}

	/** Single-set "Usuń na stałe" button: normally opens the confirm dialog;
	 *  holding Shift skips it, for an admin clearing out several sets in a
	 *  row who doesn't need the prompt every time. */
	function requestDestroyOne(set: SetSummary, event: MouseEvent) {
		if (event.shiftKey) {
			void runBulkAction('destroy', [set.id]);
			return;
		}
		pendingDestroyIds = [set.id];
	}

	function requestDestroySelected() {
		if (selectedIds.size === 0) return;
		pendingDestroyIds = [...selectedIds];
	}

	function confirmPendingDestroy() {
		if (pendingDestroyIds) void runBulkAction('destroy', pendingDestroyIds);
		pendingDestroyIds = null;
	}

	function cancelPendingDestroy() {
		pendingDestroyIds = null;
	}

	let dialogMessage = $derived.by(() => {
		if (!pendingDestroyIds) return '';
		if (pendingDestroyIds.length === 1) {
			const set = sets.find((s) => s.id === pendingDestroyIds![0]);
			return `Usunąć „${set?.title ?? 'ten zestaw'}” na stałe? Tej operacji nie można cofnąć.`;
		}
		return `Usunąć na stałe ${pendingDestroyIds.length} ${zestawForm(pendingDestroyIds.length)}? Tej operacji nie można cofnąć.`;
	});

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
			<div class="bulk-toolbar">
				<label class="select-all">
					<input
							type="checkbox"
							checked={selectedCount > 0 && selectedCount === sets.length}
							indeterminate={selectedCount > 0 && selectedCount < sets.length}
							onchange={toggleSelectAll}
					/>
					Zaznacz wszystkie
				</label>
				{#if selectedCount > 0}
					<div class="bulk-actions">
						<span class="selected-count mono">Zaznaczono: {selectedCount}</span>
						<button type="button" class="btn btn-secondary" disabled={bulkBusy} onclick={restoreSelected}>
							<RotateCcw size={14} aria-hidden="true"/>
							Przywróć zaznaczone
						</button>
						<button
								type="button"
								class="btn btn-ghost danger"
								disabled={bulkBusy}
								onclick={requestDestroySelected}
						>
							<Trash2 size={14} aria-hidden="true"/>
							Usuń na stałe zaznaczone
						</button>
					</div>
				{/if}
			</div>

			<ul class="set-list">
				{#each sets as set (set.id)}
					<li class="set-row card">
						<div class="set-info">
							<input
									type="checkbox"
									class="set-checkbox"
									aria-label="Zaznacz „{set.title}”"
									checked={selectedIds.has(set.id)}
									onchange={() => toggleSelected(set.id)}
							/>
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
							<button type="button" class="btn btn-secondary" onclick={() => restoreOne(set)}>
								<RotateCcw size={14} aria-hidden="true"/>
								Przywróć
							</button>
							<button
									type="button"
									class="btn btn-ghost danger"
									title="Usuń na stałe (Shift+klik pomija potwierdzenie)"
									onclick={(e) => requestDestroyOne(set, e)}
							>
								<Trash2 size={14} aria-hidden="true"/>
								Usuń na stałe
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<ConfirmDialog
		confirmLabel="Usuń na stałe"
		message={dialogMessage}
		onCancel={cancelPendingDestroy}
		onConfirm={confirmPendingDestroy}
		open={pendingDestroyIds !== null}
		title="Usunąć na stałe?"
/>

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

	.bulk-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px;
		padding: 10px 14px;
		background: var(--surface-soft, #f2f2f2);
		border-radius: var(--radius-sm);
	}

	.select-all {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--ink-soft);
		cursor: pointer;
		white-space: nowrap;
	}

	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.bulk-actions button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
	}

	.selected-count {
		font-size: 12px;
		color: var(--muted);
		white-space: nowrap;
	}

	.set-checkbox {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
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

	.set-actions button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.danger {
		color: var(--incorrect);
	}
</style>
