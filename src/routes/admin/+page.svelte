<script lang="ts">
	import {enhance} from '$app/forms';
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {Star, Trash2} from '@lucide/svelte';
	import {zestawForm} from '$lib/polishPlural';
	import type {SetSummary} from '$lib/types';

	let { data, form } = $props();

	// Local mirror of data.sets so bulk actions can update the list in place
	// without a full page reload — SvelteKit's `enhance` already does this
	// for the single-set form actions via invalidation, but the bulk
	// endpoint is a plain fetch, so we manage this copy ourselves.
	let sets = $state<SetSummary[]>([]);
	$effect(() => {
		sets = data.authed ? [...data.sets] : [];
	});

	let selectedIds = $state<Set<number>>(new Set());
	let selectedCount = $derived(selectedIds.size);
	let bulkBusy = $state(false);

	// Drives the confirm dialog for both the single-set "Usuń" button and
	// the bulk toolbar's "Usuń zaznaczone" — trash is the one action
	// destructive enough (even as a soft-delete) to warrant confirmation.
	let pendingTrashIds = $state<number[] | null>(null);

	function toggleSelected(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		selectedIds = selectedIds.size === sets.length ? new Set() : new Set(sets.map((s) => s.id));
	}

	async function runBulkAction(action: 'publish' | 'hide' | 'feature' | 'unfeature' | 'trash', ids: number[]) {
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
			if (action === 'trash') {
				sets = sets.filter((s) => !ids.includes(s.id));
				selectedIds = new Set([...selectedIds].filter((id) => !ids.includes(id)));
			} else {
				sets = sets.map((s) =>
						ids.includes(s.id)
								? {
									...s,
									isPublic: action === 'publish' ? true : action === 'hide' ? false : s.isPublic,
									isFeatured:
											action === 'feature'
													? s.isPublic
													: action === 'unfeature'
															? false
															: action === 'hide'
																	? false
																	: s.isFeatured
								}
								: s
				);
			}
		} catch {
			alert('Nie udało się wykonać akcji. Spróbuj ponownie.');
		} finally {
			bulkBusy = false;
		}
	}

	/** Single-set delete button: normally opens the confirm dialog; holding
	 *  Shift while clicking trashes immediately, for admins clearing out
	 *  several sets in a row who don't need the prompt every time. */
	function requestTrashOne(set: SetSummary, event: MouseEvent) {
		if (event.shiftKey) {
			void runBulkAction('trash', [set.id]);
			return;
		}
		pendingTrashIds = [set.id];
	}

	function requestTrashSelected() {
		if (selectedIds.size === 0) return;
		pendingTrashIds = [...selectedIds];
	}

	function confirmPendingTrash() {
		if (pendingTrashIds) void runBulkAction('trash', pendingTrashIds);
		pendingTrashIds = null;
	}

	function cancelPendingTrash() {
		pendingTrashIds = null;
	}

	let dialogMessage = $derived.by(() => {
		if (!pendingTrashIds) return '';
		if (pendingTrashIds.length === 1) {
			const set = sets.find((s) => s.id === pendingTrashIds![0]);
			return `Przenieść „${set?.title ?? 'ten zestaw'}” do kosza? Będzie można go przywrócić z kosza przez 30 dni`;
		}
		return `Przenieść ${pendingTrashIds.length} ${zestawForm(pendingTrashIds.length)} do kosza? Będzie można go przywrócić z kosza przez 30 dni.`;
	});
</script>

<svelte:head>
	<title>Admin — angmatura</title>
</svelte:head>

<div class="container page">
	<div class="header-row">
		<h1>Panel administratora</h1>
		{#if data.authed}
			<div class="header-actions">
				<a href="/admin/trash" class="btn btn-secondary trash-link" title="Kosz">
					<Trash2 size={16} aria-hidden="true"/>
					Kosz
				</a>
				<form method="POST" action="?/logout" use:enhance>
					<button type="submit" class="btn btn-ghost">Wyloguj</button>
				</form>
			</div>
		{/if}
	</div>

	{#if !data.authed}
		<form method="POST" action="?/login" use:enhance class="login card">
			{#if form?.message}
				<p class="error-banner">{form.message}</p>
			{/if}
			<label class="field-label" for="password">Hasło</label>
			<input id="password" name="password" class="field" type="password" required />
			<button type="submit" class="btn btn-primary btn-block">Zaloguj</button>
		</form>
	{:else}
		{#if form?.message}
			<p class="error-banner">{form.message}</p>
		{/if}

		{#if sets.length > 0}
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
						<button
								type="button"
								class="btn btn-secondary"
								disabled={bulkBusy}
								onclick={() => runBulkAction('publish', [...selectedIds])}
						>
							Publikuj
						</button>
						<button
								type="button"
								class="btn btn-secondary"
								disabled={bulkBusy}
								onclick={() => runBulkAction('hide', [...selectedIds])}
						>
							Ukryj
						</button>
						<button
								type="button"
								class="btn btn-secondary"
								disabled={bulkBusy}
								onclick={() => runBulkAction('feature', [...selectedIds])}
						>
							Wyróżnij
						</button>
						<button
								type="button"
								class="btn btn-secondary"
								disabled={bulkBusy}
								onclick={() => runBulkAction('unfeature', [...selectedIds])}
						>
							Odznacz wyróżnienie
						</button>
						<button type="button" class="btn btn-ghost danger" disabled={bulkBusy}
						        onclick={requestTrashSelected}>
							<Trash2 size={14} aria-hidden="true"/>
							Usuń zaznaczone
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<ul class="set-list">
			{#each sets as set (set.id)}
				<li class="set-row card">
					<div class="set-info">
						<label class="checkbox-hit">
							<input
									type="checkbox"
									class="set-checkbox"
									aria-label="Zaznacz „{set.title}”"
									checked={selectedIds.has(set.id)}
									onchange={() => toggleSelected(set.id)}
							/>
						</label>
						<SetTypeBadge type={set.type} />
						<span class="title">{set.title}</span>
						{#if set.isFeatured}
							<span class="featured-pill"><Star size={12} fill="currentColor" aria-hidden="true" /> Polecane</span>
						{/if}
						<span class="count mono">{set.questionCount} pytań</span>
					</div>
					<div class="links-row">
						<span class="link-pill mono">/set/{set.slug}</span>
						{#if set.customSlug}
							<span class="link-pill mono custom">/set/{set.customSlug}</span>
						{/if}
					</div>
					<form method="POST" action="?/setCustomSlug" use:enhance class="custom-slug-form">
						<input type="hidden" name="id" value={set.id} />
						<input
							name="customSlug"
							class="field mono"
							type="text"
							placeholder={set.isPublic ? 'niestandardowy-link (opcjonalnie)' : 'najpierw opublikuj zestaw'}
							value={set.customSlug ?? ''}
							disabled={!set.isPublic}
						/>
						<button type="submit" class="btn btn-secondary" disabled={!set.isPublic}>Zapisz link</button>
					</form>
					<div class="set-actions">
						<a href="/edit/{set.slug}" class="btn btn-secondary">Edytuj</a>
						<form method="POST" action="?/togglePublic" use:enhance>
							<input type="hidden" name="id" value={set.id} />
							<input type="hidden" name="isPublic" value={set.isPublic} />
							<button type="submit" class="btn btn-secondary">
								{set.isPublic ? 'Ukryj' : 'Publikuj'}
							</button>
						</form>
						<form method="POST" action="?/toggleFeatured" use:enhance>
							<input type="hidden" name="id" value={set.id} />
							<input type="hidden" name="isFeatured" value={set.isFeatured} />
							<button
								type="submit"
								class="btn btn-secondary"
								disabled={!set.isPublic}
								title={set.isPublic ? '' : 'Najpierw opublikuj zestaw'}
							>
								{set.isFeatured ? 'Odznacz wyróżnienie' : 'Wyróżnij'}
							</button>
						</form>
						<button
								type="button"
								class="btn btn-ghost danger"
								title="Przenieś do kosza (Shift+klik pomija potwierdzenie)"
								onclick={(e) => requestTrashOne(set, e)}
						>
							Usuń
						</button>
						<Tooltip text="Przytrzymaj Shift podczas klikania „Usuń”, aby pominąć okno potwierdzenia"/>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ConfirmDialog
		confirmLabel="Usuń"
		message={dialogMessage}
		onCancel={cancelPendingTrash}
		onConfirm={confirmPendingTrash}
		open={pendingTrashIds !== null}
		title="Przenieść do kosza?"
/>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-top: 8px;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.trash-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	h1 {
		font-size: 22px;
	}

	.login {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 20px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-soft);
	}

	.error-banner {
		background: var(--incorrect-soft);
		color: var(--incorrect);
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
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
		/* The whole label (checkbox + text) is already clickable; this just
		   pads out the tap target to the app's --tap-min without shifting
		   the surrounding layout (negative margin cancels the padding). */
		padding: 10px;
		margin: -10px;
		border-radius: var(--radius-sm);
	}

	/* Enlarges the per-row checkbox's clickable area well past its visible
	   18px box (closer to --tap-min) by wrapping it in a padded label —
	   clicking anywhere in the padding still toggles the input natively.
	   Negative margin cancels the extra padding so the row layout doesn't
	   shift. */
	.checkbox-hit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 13px;
		margin: -13px;
		cursor: pointer;
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
		gap: 10px;
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

	.featured-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 700;
		color: var(--accent-ink);
		background: var(--accent-soft);
		padding: 3px 8px;
		border-radius: 999px;
		letter-spacing: 0.02em;
	}

	.set-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.links-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.link-pill {
		font-size: 11px;
		color: var(--muted);
		background: var(--surface-soft, #f2f2f2);
		padding: 3px 8px;
		border-radius: 999px;
	}

	.link-pill.custom {
		color: var(--accent-ink);
		background: var(--accent-soft);
	}

	.custom-slug-form {
		display: flex;
		gap: 8px;
	}

	.custom-slug-form .field {
		flex: 1;
		font-size: 13px;
	}

	.danger {
		color: var(--incorrect);
	}
</style>
