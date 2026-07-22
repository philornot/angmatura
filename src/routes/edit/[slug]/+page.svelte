<script lang="ts">
	import {enhance} from '$app/forms';
	import {goto} from '$app/navigation';
	import type {EditableQuestion} from '$lib/components/KwtQuestionEditor.svelte';
	import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import {getDeviceId} from '$lib/deviceId';
	import {ArrowLeft, Plus, Trash2} from '@lucide/svelte';

	let { data, form } = $props();
	let set = $derived(data.set);

	// Used only to fill the fork form's hidden field, falling back to
	// whatever the server already resolved from the device-id cookie.
	// svelte-ignore state_referenced_locally
	let deviceId = $state(data.deviceId ?? '');
	$effect(() => {
		deviceId = getDeviceId();
	});
	let forking = $state(false);

	function toEditable(q: (typeof data.questions)[number]): EditableQuestion {
		return {
			sentence1: q.sentence1,
			sentence2WithGap: q.sentence2WithGap,
			keyword: q.keyword,
			correctAnswer: q.correctAnswer,
			alternativeAnswers: q.alternativeAnswers,
			exampleWrongAnswers: q.exampleWrongAnswers,
			minWords: q.minWords,
			maxWords: q.maxWords
		};
	}

	// These deliberately only capture the initial value: the form must hold the
	// user's edits and NOT get overwritten every time `data` reloads (e.g. after
	// an unrelated invalidation). Resync only happens explicitly below, when the
	// slug actually changes (see the $effect further down).
	// svelte-ignore state_referenced_locally
	let title = $state(data.set.title);
	// svelte-ignore state_referenced_locally
	let sourceLabel = $state(data.set.sourceLabel ?? '');
	// svelte-ignore state_referenced_locally
	let isPublic = $state(data.set.isPublic);
	// svelte-ignore state_referenced_locally
	let questions = $state<EditableQuestion[]>(data.questions.map(toEditable));
	let submitting = $state(false);
	let savedFlash = $state(false);

	// Deleting a set (moves it to the trash — same endpoint as the "my sets"
	// list). Deliberately no Shift-to-skip shortcut here, unlike the list
	// view: this page shows one set at a time and deleting the *wrong* one by
	// habit-clicking through a shortcut would be a much costlier mistake than
	// on a list where you can see exactly what you selected.
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	function requestDelete() {
		deleteError = null;
		showDeleteConfirm = true;
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}

	async function confirmDelete() {
		deleting = true;
		try {
			const res = await fetch(`/api/sets/${data.set.id}/trash`, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({deviceId})
			});
			if (!res.ok) throw new Error('request failed');
			showDeleteConfirm = false;
			await goto('/my-sets');
		} catch {
			deleteError = 'Nie udało się usunąć zestawu. Spróbuj ponownie.';
			deleting = false;
			showDeleteConfirm = false;
		}
	}

	// If SvelteKit reuses this component while navigating between different
	// sets' edit pages, reload the editable copies from the newly loaded set.
	// `loadedSlug` is intentionally just a one-time baseline snapshot, compared
	// against inside the $effect below (which is what actually stays reactive).
	// svelte-ignore state_referenced_locally
	let loadedSlug = data.set.slug;
	$effect(() => {
		if (data.set.slug === loadedSlug) return;
		loadedSlug = data.set.slug;
		title = data.set.title;
		sourceLabel = data.set.sourceLabel ?? '';
		isPublic = data.set.isPublic;
		questions = data.questions.map(toEditable);
	});

	function addQuestion() {
		questions = [
			...questions,
			{
				sentence1: '',
				sentence2WithGap: '',
				keyword: '',
				correctAnswer: '',
				alternativeAnswers: [],
				exampleWrongAnswers: [],
				minWords: 0,
				maxWords: 0
			}
		];
	}

	function deleteQuestion(i: number) {
		questions = questions.filter((_, idx) => idx !== i);
	}
</script>

<svelte:head>
	<title>Edytuj: {set.title}</title>
</svelte:head>

<div class="container page">
	<a href="/set/{set.slug}" class="back"><ArrowLeft size={14} aria-hidden="true" /> {set.title}</a>
	<div class="title-row">
		<h1>Edytuj zestaw</h1>
		{#if data.isOwner}
			<button type="button" class="btn btn-ghost delete-set-btn" disabled={deleting} onclick={requestDelete}>
				<Trash2 size={16} aria-hidden="true"/>
				<span class="delete-set-label">Usuń zestaw</span>
			</button>
		{/if}
	</div>
	{#if data.isOwner}
		<div class="owner-note">
			{#if data.isFork}
				<span>To Twoja kopia (fork) innego zestawu.</span>
			{:else}
				<span>To oryginalny zestaw.</span>
			{/if}
			{#if data.offerFork}
				<form
						method="POST"
						action="?/fork"
						class="fork-form"
						use:enhance={() => {
						forking = true;
						return async ({ update }) => {
							await update();
							forking = false;
						};
					}}
				>
					<input type="hidden" name="deviceId" value={deviceId}/>
					<button type="submit" class="fork-link" disabled={forking}>
						{forking ? 'Tworzę kopię…' : 'Zamiast tego stwórz kopię (fork)'}
					</button>
				</form>
			{/if}
		</div>
	{:else}
		<p class="private-note">To Twoja prywatna kopia. Zmiany nie wpłyną na oryginał.</p>
	{/if}

	{#if form?.message}
		<p class="error-banner">{form.message}</p>
	{/if}
	{#if savedFlash}
		<p class="saved-banner">Zapisano zmiany.</p>
	{/if}

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			submitting = true;
			savedFlash = false;
			return async ({ update }) => {
				// `update()` defaults to also calling the form's native
				// `reset()`. Our text inputs are bound via `bind:value` to
				// Svelte state (not an HTML `value` attribute), so their
				// `defaultValue` is empty — a native reset blanks them out
				// visually even though the underlying state (and the saved
				// data) is still correct. `reset: false` keeps the fields
				// showing what the user actually has.
				await update({ reset: false });
				submitting = false;
				savedFlash = true;
			};
		}}
	>
		<div class="meta card">
			<label class="field-label" for="title">Tytuł zestawu</label>
			<input id="title" name="title" class="field" type="text" bind:value={title} required />

			<label class="field-label" for="sourceLabel">Źródło (opcjonalnie)</label>
			<input id="sourceLabel" name="sourceLabel" class="field" type="text" bind:value={sourceLabel} />

			<label class="checkbox-row">
				<input type="checkbox" name="isPublic" bind:checked={isPublic} />
				Zestaw publiczny (widoczny na stronie głównej)
			</label>
		</div>

		<div class="editors">
			{#each questions as q, i (i)}
				<KwtQuestionEditor question={q} setType={set.type} index={i} onDelete={() => deleteQuestion(i)} />
			{/each}
		</div>

		<button type="button" class="btn btn-secondary btn-block" onclick={addQuestion}>
			<Plus size={16} aria-hidden="true" /> Dodaj pytanie
		</button>

		<input type="hidden" name="questions" value={JSON.stringify(questions)} />
		<input name="deviceId" type="hidden" value={deviceId}/>

		<button type="submit" class="btn btn-primary btn-block" disabled={submitting || questions.length === 0}>
			{submitting ? 'Zapisuję…' : 'Zapisz zmiany'}
		</button>
	</form>

	{#if deleteError}
		<p class="error-banner">{deleteError}</p>
	{/if}
</div>

<ConfirmDialog
		confirmLabel={deleting ? 'Usuwam…' : 'Usuń'}
		message="Czy na pewno chcesz usunąć „{set.title}”?"
		onCancel={cancelDelete}
		onConfirm={confirmDelete}
		open={showDeleteConfirm}
		title="Usunąć ten zestaw?"
/>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h1 {
		font-size: 22px;
		margin-top: 4px;
	}

	.private-note {
		font-size: 13px;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.owner-note {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		font-size: 13px;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.fork-form {
		display: contents;
	}

	.fork-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: 13px;
		color: var(--muted);
		text-decoration: underline;
		cursor: pointer;
	}

	.fork-link:hover {
		color: var(--ink-soft);
	}

	.fork-link:disabled {
		cursor: default;
		opacity: 0.6;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.meta {
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-soft);
		margin-top: 8px;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		margin-top: 10px;
	}

	.editors {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.error-banner {
		background: var(--incorrect-soft);
		color: var(--incorrect);
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.saved-banner {
		background: var(--correct-soft);
		color: var(--correct);
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.delete-set-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		color: var(--incorrect);
		white-space: nowrap;
	}

	.delete-set-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	@media (max-width: 480px) {
		.delete-set-label {
			display: none;
		}

		.delete-set-btn {
			padding: 6px;
		}
	}
</style>
