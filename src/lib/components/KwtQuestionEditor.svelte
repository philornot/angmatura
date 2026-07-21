<script lang="ts">
	import {tick} from 'svelte';
	import type {SetType} from '$lib/types';
	import {ChevronDown, X} from '@lucide/svelte';

	export interface EditableQuestion {
		sentence1: string;
		sentence2WithGap: string;
		keyword: string;
		correctAnswer: string;
		alternativeAnswers: string[];
		exampleWrongAnswers: string[];
		minWords: number;
		maxWords: number;
	}

	let {
		question,
		setType,
		index,
		onDelete
	}: {
		question: EditableQuestion;
		setType: SetType;
		index: number;
		onDelete: () => void;
	} = $props();

	let newAlt = $state('');
	let newWrong = $state('');
	let expanded = $state(false);

	function addAlternative() {
		const value = newAlt.trim();
		if (!value) return;
		question.alternativeAnswers = [...question.alternativeAnswers, value];
		newAlt = '';
	}

	function removeAlternative(i: number) {
		question.alternativeAnswers = question.alternativeAnswers.filter((_, idx) => idx !== i);
	}

	function addWrongAnswer() {
		const value = newWrong.trim();
		if (!value) return;
		question.exampleWrongAnswers = [...question.exampleWrongAnswers, value];
		newWrong = '';
	}

	function removeWrongAnswer(i: number) {
		question.exampleWrongAnswers = question.exampleWrongAnswers.filter((_, idx) => idx !== i);
	}

	// Typing a single "_" auto-expands into the "______" gap marker used by
	// study/exam rendering (see gapParts() in QuestionCard.svelte and the exam
	// page). Guarded to only fire on a genuinely isolated underscore — not a
	// paste, and not one typed next to an existing gap — so it doesn't fight
	// with someone editing a gap that's already there.
	async function handleGapInput(e: Event) {
		const inputEvent = e as InputEvent;
		if (inputEvent.inputType !== 'insertText' || inputEvent.data !== '_') return;

		const el = e.currentTarget as HTMLTextAreaElement;
		const pos = el.selectionStart ?? 0;
		const value = el.value;
		const isIsolatedUnderscore =
			value[pos - 1] === '_' && value[pos - 2] !== '_' && value[pos] !== '_';
		if (!isIsolatedUnderscore) return;

		question.sentence2WithGap = value.slice(0, pos - 1) + '______' + value.slice(pos);
		await tick();
		el.setSelectionRange(pos + 5, pos + 5);
	}
</script>

<div class="editor card">
	<button type="button" class="editor-head" onclick={() => (expanded = !expanded)}>
		<span class="index mono">#{index + 1}</span>
		<span class="preview">{question.sentence2WithGap || 'Nowe pytanie'}</span>
		<ChevronDown class={expanded ? 'chevron open' : 'chevron'} size={18} aria-hidden="true" />
	</button>

	{#if expanded}
		<div class="editor-body">
			{#if setType === 'kwt'}
				<label class="field-label" for="s1-{index}">Zdanie źródłowe</label>
				<input id="s1-{index}" class="field" type="text" bind:value={question.sentence1} />

				<label class="field-label" for="kw-{index}">Słowo kluczowe</label>
				<input id="kw-{index}" class="field mono" type="text" bind:value={question.keyword} />
			{/if}

			<label class="field-label" for="gap-{index}">
				Zdanie z luką <span class="hint">(wpisz _ żeby wstawić lukę)</span>
			</label>
			<textarea
				id="gap-{index}"
				class="field"
				rows="2"
				bind:value={question.sentence2WithGap}
				oninput={handleGapInput}
			></textarea>

			<label class="field-label" for="ans-{index}">Poprawna odpowiedź</label>
			<input id="ans-{index}" class="field" type="text" bind:value={question.correctAnswer} />

			<div class="alt-block">
				<span class="field-label">Warianty odpowiedzi</span>
				<div class="chips">
					{#each question.alternativeAnswers as alt, i (alt + i)}
						<span class="chip">
							{alt}
							<button type="button" aria-label="Usuń wariant" onclick={() => removeAlternative(i)}>
								<X size={14} aria-hidden="true" />
							</button>
						</span>
					{/each}
				</div>
				<div class="alt-add">
					<input
						class="field"
						type="text"
						placeholder="Dodaj wariant…"
						bind:value={newAlt}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlternative())}
					/>
					<button type="button" class="btn btn-secondary" onclick={addAlternative}>Dodaj</button>
				</div>
			</div>

			<div class="alt-block wrong-block">
				<span class="field-label">Znane błędne odpowiedzi</span>
				<div class="chips">
					{#each question.exampleWrongAnswers as wrong, i (wrong + i)}
						<span class="chip chip-wrong">
							{wrong}
							<button
									type="button"
									aria-label="Usuń błędną odpowiedź"
									onclick={() => removeWrongAnswer(i)}
							>
								<X size={14} aria-hidden="true"/>
							</button>
						</span>
					{/each}
				</div>
				<div class="alt-add">
					<input
							class="field"
							type="text"
							placeholder="Dodaj znaną błędną odpowiedź…"
							bind:value={newWrong}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addWrongAnswer())}
					/>
					<button type="button" class="btn btn-secondary" onclick={addWrongAnswer}>Dodaj</button>
				</div>
			</div>

			<div class="word-row">
				<label>
					<span class="field-label">Min. słów</span>
					<input class="field" type="number" min="0" bind:value={question.minWords} />
				</label>
				<label>
					<span class="field-label">Maks. słów</span>
					<input class="field" type="number" min="0" bind:value={question.maxWords} />
				</label>
			</div>

			<button type="button" class="btn btn-ghost delete-btn" onclick={onDelete}>Usuń pytanie</button>
		</div>
	{/if}
</div>

<style>
	.editor {
		padding: 0;
		overflow: hidden;
	}

	.editor-head {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: var(--tap-min);
		padding: 12px 16px;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
	}

	.index {
		font-size: 12px;
		font-weight: 700;
		color: var(--accent-ink);
		background: var(--accent-soft);
		border-radius: 6px;
		padding: 2px 6px;
		flex-shrink: 0;
	}

	.preview {
		flex: 1;
		font-size: 14px;
		color: var(--ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.chevron) {
		color: var(--muted);
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}
	:global(.chevron.open) {
		transform: rotate(180deg);
	}

	.editor-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 4px 16px 18px;
		border-top: 1px solid var(--rule);
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-soft);
		margin-top: 10px;
	}

	.hint {
		font-weight: 400;
		color: var(--muted);
	}

	.alt-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		background: var(--paper);
		border-radius: 999px;
		padding: 4px 6px 4px 10px;
	}

	.chip-wrong {
		background: var(--incorrect-soft);
		color: var(--incorrect);
	}

	.chip button {
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--muted);
		line-height: 1;
		cursor: pointer;
		padding: 2px;
	}

	.alt-add {
		display: flex;
		gap: 8px;
	}

	.word-row {
		display: flex;
		gap: 12px;
	}
	.word-row label {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.delete-btn {
		margin-top: 14px;
		color: var(--incorrect);
		align-self: flex-start;
	}
</style>
