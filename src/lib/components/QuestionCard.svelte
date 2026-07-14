<script lang="ts">
	import type { QuestionPrompt, SetType, CheckResult } from '$lib/types';
	import StatusIcon from './StatusIcon.svelte';
	import StampBadge from './StampBadge.svelte';

	let {
		question,
		setType,
		deviceId,
		contextLabel,
		onAdvance
	}: {
		question: QuestionPrompt;
		setType: SetType;
		deviceId: string;
		contextLabel?: string;
		onAdvance: (wasCorrect: boolean) => void;
	} = $props();

	let given = $state('');
	let checking = $state(false);
	let result: CheckResult | null = $state(null);
	let hint: { firstLetter: string; wordCount: number } | null = $state(null);
	let hintLoading = $state(false);
	let explainLoading = $state(false);

	let gapParts = $derived(question.sentence2WithGap.split('______'));
	let wordHint = $derived(
		question.minWords && question.maxWords
			? question.minWords === question.maxWords
				? `${question.minWords} słowa`
				: `${question.minWords}–${question.maxWords} słów`
			: question.maxWords
				? `maks. ${question.maxWords} słów`
				: null
	);

	async function check() {
		if (!given.trim() || checking) return;
		checking = true;
		try {
			const res = await fetch(`/api/questions/${question.id}/check`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ given, deviceId })
			});
			result = await res.json();
		} finally {
			checking = false;
		}
	}

	async function requestHint() {
		if (hint || hintLoading) return;
		hintLoading = true;
		try {
			const res = await fetch(`/api/questions/${question.id}/hint`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deviceId })
			});
			hint = await res.json();
		} finally {
			hintLoading = false;
		}
	}

	async function requestExplanation() {
		if (!result || result.explanation || explainLoading) return;
		explainLoading = true;
		try {
			const res = await fetch(`/api/questions/${question.id}/explain`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				result = { ...result, explanation: data.explanation };
			}
		} finally {
			explainLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !result) {
			e.preventDefault();
			check();
		}
	}
</script>

<div class="card-wrap">
	{#if contextLabel}
		<p class="context-label">{contextLabel}</p>
	{/if}

	<article class="card" data-state={result ? (result.isCorrect ? 'correct' : 'incorrect') : 'pending'}>
		{#if result}
			<StampBadge correct={result.isCorrect} />
		{/if}

		<div class="body">
			{#if setType === 'kwt' && question.sentence1}
				<p class="source-sentence">{question.sentence1}</p>
				{#if question.keyword}
					<span class="keyword mono">{question.keyword}</span>
				{/if}
			{/if}

			<p class="gap-sentence">
				{gapParts[0]}<span class="gap-marker" aria-hidden="true">______</span>{gapParts[1] ?? ''}
			</p>

			{#if !result}
				<label class="visually-hidden" for="answer-input">Twoja odpowiedź</label>
				<input
					id="answer-input"
					class="field answer-input"
					type="text"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					placeholder="Twoja odpowiedź"
					bind:value={given}
					onkeydown={handleKeydown}
				/>
				{#if wordHint}
					<p class="word-hint">{wordHint}</p>
				{/if}

				{#if hint}
					<p class="hint-reveal">
						Podpowiedź: zaczyna się na <strong>„{hint.firstLetter}”</strong> · {hint.wordCount}
						{hint.wordCount === 1 ? 'słowo' : 'słowa/słów'}
					</p>
				{/if}

				<div class="actions">
					<button type="button" class="btn btn-ghost" onclick={requestHint} disabled={hintLoading || !!hint}>
						{hintLoading ? 'Chwila…' : 'Podpowiedź'}
					</button>
					<button type="button" class="btn btn-primary" onclick={check} disabled={!given.trim() || checking}>
						{checking ? 'Sprawdzam…' : 'Sprawdź'}
					</button>
				</div>
			{:else}
				<div class="feedback">
					<div class="feedback-head">
						<StatusIcon correct={result.isCorrect} />
						<div>
							{#if !result.isCorrect}
								<p class="feedback-given">Twoja odpowiedź: <s>{result.given}</s></p>
							{/if}
							<p class="feedback-answer">
								{result.isCorrect ? 'Poprawna odpowiedź' : 'Poprawna odpowiedź to'}: <strong>{result.correctAnswer}</strong>
							</p>
							{#if result.alternativeAnswers.length > 0}
								<p class="feedback-alt">lub: {result.alternativeAnswers.join(' / ')}</p>
							{/if}
						</div>
					</div>

					{#if result.explanation}
						<p class="feedback-explanation">{result.explanation}</p>
					{:else}
						<button
							type="button"
							class="btn btn-ghost explain-btn"
							onclick={requestExplanation}
							disabled={explainLoading}
						>
							{explainLoading ? 'Generuję wyjaśnienie…' : 'Wyjaśnij'}
						</button>
					{/if}

					<button type="button" class="btn btn-primary btn-block" onclick={() => onAdvance(result!.isCorrect)}>
						Dalej
					</button>
				</div>
			{/if}
		</div>
	</article>
</div>

<style>
	.card-wrap {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.context-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		padding: 0 4px;
	}

	.card {
		position: relative;
		border-radius: var(--radius-lg);
		background: var(--paper-raised);
		box-shadow: var(--shadow-card);
		border-left: 4px solid var(--rule);
		padding: 24px 20px;
		transition: border-color 0.15s ease;
	}

	.card[data-state='correct'] {
		border-left-color: var(--correct);
	}
	.card[data-state='incorrect'] {
		border-left-color: var(--incorrect);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.source-sentence {
		font-size: 15px;
		color: var(--ink-soft);
		font-style: italic;
	}

	.keyword {
		display: inline-block;
		align-self: flex-start;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.08em;
		background: var(--accent-soft);
		color: var(--accent-ink);
		padding: 3px 10px;
		border-radius: 6px;
		margin-top: -4px;
	}

	.gap-sentence {
		font-size: 19px;
		line-height: 1.5;
		color: var(--ink);
	}

	.gap-marker {
		display: inline-block;
		color: transparent;
		border-bottom: 2.5px solid var(--accent);
		padding-bottom: 1px;
		margin: 0 1px;
	}

	.answer-input {
		font-size: 18px;
	}

	.word-hint {
		font-size: 13px;
		color: var(--muted);
		margin-top: -6px;
	}

	.hint-reveal {
		font-size: 14px;
		color: var(--accent-ink);
		background: var(--accent-soft);
		padding: 8px 12px;
		border-radius: var(--radius-sm);
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.actions .btn-primary {
		flex: 1;
	}

	.feedback {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.feedback-head {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.feedback-given {
		font-size: 14px;
		color: var(--incorrect);
		margin-bottom: 2px;
	}

	.feedback-answer {
		font-size: 16px;
	}

	.feedback-alt {
		font-size: 14px;
		color: var(--muted);
		margin-top: 2px;
	}

	.feedback-explanation {
		font-size: 14px;
		color: var(--ink-soft);
		background: var(--paper);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
	}

	.explain-btn {
		align-self: flex-start;
	}
</style>
