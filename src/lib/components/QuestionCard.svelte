<script lang="ts">
	import type {CheckResult, QuestionPrompt, SetType} from '$lib/types';
	import StatusIcon from './StatusIcon.svelte';
	import StampBadge from './StampBadge.svelte';
	import {renderExplanationMarkdown} from '$lib/markdownLite';

	let {
		question,
		setType,
		deviceId,
		contextLabel,
		onAdvance,
		initialGiven = '',
		initialResult = null
	}: {
		question: QuestionPrompt;
		setType: SetType;
		deviceId: string;
		contextLabel?: string;
		onAdvance: (wasCorrect: boolean, given: string, result: CheckResult) => void;
		// Used when this card is being re-shown via the "Wróć" (go back) action —
		// restores the answer/feedback the user already saw instead of a blank input.
		initialGiven?: string;
		initialResult?: CheckResult | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let given = $state(initialGiven);
	let checking = $state(false);
	// svelte-ignore state_referenced_locally
	let result: CheckResult | null = $state(initialResult);
	let hint: { firstLetter: string; wordCount: number } | null = $state(null);
	let hintLoading = $state(false);
	let explainLoading = $state(false);
	let checkError = $state<string | null>(null);
	let answerInputEl: HTMLInputElement | undefined = $state();

	// Guards the "Enter/Spacja przechodzi dalej" shortcut against a fast
	// double key-press: the first press submits the check (async), and if the
	// second press's keydown lands after the result has already come back,
	// it would otherwise immediately trigger "Dalej" before the feedback was
	// ever seen. A short cooldown after the result appears fixes that.
	let canAdvanceViaKeyboard = $state(false);
	$effect(() => {
		if (!result) {
			canAdvanceViaKeyboard = false;
			return;
		}
		canAdvanceViaKeyboard = false;
		const id = setTimeout(() => {
			canAdvanceViaKeyboard = true;
		}, 250);
		return () => clearTimeout(id);
	});

	function focusAnswerInput() {
		answerInputEl?.focus();
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (!result || e.repeat) return;
		if (e.key !== 'Enter' && e.key !== ' ') return;
		// Prevent scrolling (Space) or double form-ish submission (Enter) even
		// during the cooldown — we just don't advance yet.
		e.preventDefault();
		if (!canAdvanceViaKeyboard) return;
		onAdvance(result.isCorrect, given, result);
	}

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
		checkError = null;
		try {
			const res = await fetch(`/api/questions/${question.id}/check`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ given, deviceId })
			});
			if (!res.ok) throw new Error('bad response');
			result = await res.json();
		} catch {
			// Surface the failure instead of silently doing nothing — otherwise
			// tapping Sprawdź on a flaky connection looks like the button is
			// simply unresponsive.
			checkError = 'Nie udało się sprawdzić odpowiedzi. Spróbuj ponownie.';
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
			if (!res.ok) throw new Error('bad response');
			hint = await res.json();
		} catch {
			// Silent failure here just means no hint appears — not worth a
			// banner, but we still must not leave hintLoading stuck true.
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

<svelte:window onkeydown={handleWindowKeydown}/>

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

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<p
					class="gap-sentence"
					class:tappable={!result}
					onclick={() => !result && focusAnswerInput()}
			>
				{gapParts[0]}<span class="gap-marker" aria-hidden="true">______</span>{gapParts[1] ?? ''}
			</p>

			{#if !result}
				<label class="visually-hidden" for="answer-input">Twoja odpowiedź</label>
				<input
						bind:this={answerInputEl}
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

				{#if checkError}
					<p class="check-error">{checkError}</p>
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
						<div style="flex: 1;">
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
						<!-- Przycisk "Wyjaśnij" pojawia się tylko gdy brak wyjaśnienia -->
						{#if !result.explanation}
							<button
								type="button"
								class="btn btn-outline btn-sm explain-btn"
								onclick={requestExplanation}
								disabled={explainLoading}
							>
								<!-- Ikona info (SVG inline) -->
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
								</svg>
								{explainLoading ? 'Generuję…' : 'Wyjaśnij'}
							</button>
						{/if}
					</div>

					{#if result.explanation}
						<div class="feedback-explanation">{@html renderExplanationMarkdown(result.explanation)}</div>
					{/if}

					<button
							type="button"
							class="btn btn-primary btn-block"
							onclick={() => onAdvance(result!.isCorrect, given, result!)}
					>
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

	/* Tapping anywhere in the sentence (not just precisely on the thin
	   underline) focuses the real input — much easier to hit on mobile. */
	.gap-sentence.tappable {
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.gap-sentence.tappable .gap-marker {
		cursor: text;
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

	.check-error {
		font-size: 14px;
		color: var(--incorrect);
		background: var(--incorrect-soft);
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

	.feedback-head > div:first-of-type {
		flex: 1; /* aby tekst zajmował dostępną przestrzeń, a przycisk był z prawej */
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

	/* renderExplanationMarkdown() wraps each paragraph in its own <p>, which
	   would otherwise bring the browser's default paragraph margins along. */
	.feedback-explanation :global(p) {
		margin: 0;
	}

	.feedback-explanation :global(p + p) {
		margin-top: 8px;
	}

	.feedback-explanation :global(strong) {
		color: var(--ink);
	}

	.feedback-explanation :global(code) {
		background: var(--surface, rgba(0, 0, 0, 0.06));
		padding: 1px 4px;
		border-radius: 4px;
		font-size: 13px;
	}

	/* Styl przycisku "Wyjaśnij" – mniejszy, z obramowaniem */
	.btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid var(--muted);
		color: var(--ink-soft);
		padding: 4px 12px;
		border-radius: var(--radius-sm);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		white-space: nowrap;
	}

	.btn-outline:hover:not(:disabled) {
		background: var(--paper);
		border-color: var(--accent);
		color: var(--accent-ink);
	}

	.btn-outline:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.btn-sm {
		padding: 4px 10px;
		font-size: 12px;
	}
</style>
