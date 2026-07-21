<script lang="ts">
	import {enhance} from '$app/forms';
	import type {EditableQuestion} from '$lib/components/KwtQuestionEditor.svelte';
	import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
	import type {SetType} from '$lib/types';
	import {ArrowLeft, Plus} from '@lucide/svelte';

	let { form } = $props();

	let title = $state('');
	let sourceLabel = $state('');
	let type = $state<SetType>('kwt');
	let isPublic = $state(false);
	let questions = $state<EditableQuestion[]>([blankQuestion()]);
	let submitting = $state(false);

	function blankQuestion(): EditableQuestion {
		return {
			sentence1: '',
			sentence2WithGap: '',
			keyword: '',
			correctAnswer: '',
			alternativeAnswers: [],
			exampleWrongAnswers: [],
			minWords: 0,
			maxWords: 0
		};
	}

	function addQuestion() {
		questions = [...questions, blankQuestion()];
	}

	function deleteQuestion(i: number) {
		questions = questions.filter((_, idx) => idx !== i);
	}
</script>

<svelte:head>
	<title>Dodaj zestaw ręcznie — angmatura</title>
</svelte:head>

<div class="container page">
	<a href="/create" class="back"><ArrowLeft size={14} aria-hidden="true" /> Wybierz inny sposób</a>
	<h1>Dodaj zestaw ręcznie</h1>
	<p class="sub">Wpisz pytania ręcznie.</p>

	{#if form?.message}
		<p class="error-banner">{form.message}</p>
	{/if}

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<div class="meta card">
			<label class="field-label" for="title">Tytuł zestawu</label>
			<input id="title" name="title" class="field" type="text" bind:value={title} required />

			<label class="field-label" for="sourceLabel">Źródło (opcjonalnie)</label>
			<input
				id="sourceLabel"
				name="sourceLabel"
				class="field"
				type="text"
				placeholder="np. Matura maj 2023"
				bind:value={sourceLabel}
			/>

			<label class="field-label" for="type">Typ zadania</label>
			<select id="type" name="type" class="field" bind:value={type}>
				<option value="kwt">Key Word Transformations</option>
				<option value="grammar">Gramatykalizacja</option>
				<option value="translation">Tłumaczenia</option>
			</select>

			<label class="checkbox-row">
				<input type="checkbox" name="isPublic" bind:checked={isPublic} />
				Zestaw publiczny (widoczny na stronie głównej)
			</label>
		</div>

		<div class="editors">
			{#each questions as q, i (i)}
				<KwtQuestionEditor question={q} setType={type} index={i} onDelete={() => deleteQuestion(i)} />
			{/each}
		</div>

		<button type="button" class="btn btn-secondary btn-block" onclick={addQuestion}>
			<Plus size={16} aria-hidden="true" /> Dodaj pytanie
		</button>

		<input type="hidden" name="questions" value={JSON.stringify(questions)} />

		<button type="submit" class="btn btn-primary btn-block" disabled={submitting || questions.length === 0}>
			{submitting ? 'Zapisuję…' : 'Zapisz zestaw'}
		</button>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
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

	.sub {
		color: var(--ink-soft);
		font-size: 14px;
		margin-bottom: 6px;
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
</style>
