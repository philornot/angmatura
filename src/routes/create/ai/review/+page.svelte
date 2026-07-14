<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
	import type { EditableQuestion } from '$lib/components/KwtQuestionEditor.svelte';
	import type { AiGeneratedSet, SetType } from '$lib/types';

	let { form } = $props();

	let ready = $state(false);
	let title = $state('');
	let sourceLabel = $state('');
	let type = $state<SetType>('kwt');
	let isPublic = $state(false);
	let questions = $state<EditableQuestion[]>([]);
	let submitting = $state(false);

	$effect(() => {
		const raw = sessionStorage.getItem('angmatura_ai_draft');
		if (!raw) {
			goto('/create/ai');
			return;
		}
		const draft = JSON.parse(raw) as AiGeneratedSet;
		type = draft.type;
		title = draft.suggestedTitle ?? '';
		questions = draft.questions.map((q) => ({
			sentence1: q.sentence1 ?? '',
			sentence2WithGap: q.sentence2WithGap,
			keyword: q.keyword ?? '',
			correctAnswer: q.correctAnswer,
			alternativeAnswers: q.alternativeAnswers ?? [],
			minWords: q.minWords ?? 0,
			maxWords: q.maxWords ?? 0
		}));
		ready = true;
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
				minWords: 0,
				maxWords: 0
			}
		];
	}

	function deleteQuestion(i: number) {
		questions = questions.filter((_, idx) => idx !== i);
	}

	function handleSaved() {
		sessionStorage.removeItem('angmatura_ai_draft');
	}
</script>

<svelte:head>
	<title>Sprawdź wygenerowany zestaw — AngMatura</title>
</svelte:head>

{#if ready}
	<div class="container page">
		<a href="/create/ai" class="back">← Wgraj inne zdjęcia</a>
		<h1>Sprawdź wygenerowany zestaw</h1>
		<p class="sub">AI wypisało {questions.length} pytań. Popraw literówki i dopisz warianty, jeśli trzeba.</p>

		{#if form?.message}
			<p class="error-banner">{form.message}</p>
		{/if}

		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					handleSaved();
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

			<button type="button" class="btn btn-secondary btn-block" onclick={addQuestion}
				>+ Dodaj pytanie ręcznie</button
			>

			<input type="hidden" name="questions" value={JSON.stringify(questions)} />

			<button type="submit" class="btn btn-primary btn-block" disabled={submitting || questions.length === 0}>
				{submitting ? 'Zapisuję…' : 'Zapisz zestaw'}
			</button>
		</form>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 8px;
	}

	.back {
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
