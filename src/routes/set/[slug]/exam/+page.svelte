<script lang="ts">
	import { enhance } from '$app/forms';
	import type { QuestionPrompt, SetType } from '$lib/types';

	let { data, form } = $props();
	let set = $derived(data.set);
	let questions = $derived(data.questions);

	const DEFAULT_MINUTES: Record<SetType, number> = { kwt: 10, grammar: 8, translation: 10 };

	let timerVisible = $state(true);
	// Deliberately only captures the initial value on mount — resetting the
	// timer whenever `data` merely reloads (without the exam actually
	// changing) would also un-dismiss it and wipe an in-progress countdown.
	// The $effect below handles the one case that should reset it: navigating
	// to a genuinely different exam (set.type changes).
	// svelte-ignore state_referenced_locally
	let secondsLeft = $state(DEFAULT_MINUTES[data.set.type as SetType] * 60);
	let submitting = $state(false);

	let firstRun = true;
	$effect(() => {
		const type = set.type as SetType;
		if (firstRun) {
			firstRun = false;
			return;
		}
		timerVisible = true;
		secondsLeft = DEFAULT_MINUTES[type] * 60;
	});

	$effect(() => {
		if (!timerVisible) return;
		const id = setInterval(() => {
			secondsLeft = Math.max(0, secondsLeft - 1);
		}, 1000);
		return () => clearInterval(id);
	});

	let timeLabel = $derived(
		`${Math.floor(secondsLeft / 60)
			.toString()
			.padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`
	);

	function gapParts(q: QuestionPrompt) {
		return q.sentence2WithGap.split('______');
	}

	function wordHint(q: QuestionPrompt) {
		if (q.minWords && q.maxWords) {
			return q.minWords === q.maxWords ? `${q.minWords} słowa` : `${q.minWords}–${q.maxWords} słów`;
		}
		if (q.maxWords) return `maks. ${q.maxWords} słów`;
		return null;
	}
</script>

<svelte:head>
	<title>Egzamin — {set.title}</title>
</svelte:head>

<div class="container page">
	<div class="top">
		<a href="/set/{set.slug}" class="back">← {set.title}</a>
		{#if timerVisible}
			<div class="timer mono" class:urgent={secondsLeft <= 60}>
				<span>{timeLabel}</span>
				<button type="button" class="dismiss" onclick={() => (timerVisible = false)} aria-label="Ukryj timer"
					>×</button
				>
			</div>
		{/if}
	</div>

	{#if form?.message}
		<p class="error-banner">{form.message}</p>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<ol class="questions">
			{#each questions as q, i (q.id)}
				{@const parts = gapParts(q)}
				<li class="question card">
					<span class="q-index mono">{i + 1}</span>
					{#if set.type === 'kwt' && q.sentence1}
						<p class="source-sentence">{q.sentence1}</p>
						{#if q.keyword}
							<span class="keyword mono">{q.keyword}</span>
						{/if}
					{/if}
					<p class="gap-sentence">
						{parts[0]}<span class="gap-marker" aria-hidden="true">______</span>{parts[1] ?? ''}
					</p>
					<label class="visually-hidden" for="q-{q.id}">Odpowiedź do pytania {i + 1}</label>
					<input
						id="q-{q.id}"
						name="q-{q.id}"
						class="field"
						type="text"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
					/>
					{#if wordHint(q)}
						<p class="word-hint">{wordHint(q)}</p>
					{/if}
				</li>
			{/each}
		</ol>

		<button type="submit" class="btn btn-primary btn-block submit-btn" disabled={submitting}>
			{submitting ? 'Sprawdzam…' : 'Zakończ i sprawdź'}
		</button>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding-top: 8px;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		position: sticky;
		top: 0;
		background: var(--paper);
		padding: 8px 0;
		z-index: 5;
	}

	.back {
		font-size: 13px;
		color: var(--muted);
		text-decoration: none;
	}

	.timer {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		background: var(--paper-raised);
		border-radius: 999px;
		padding: 6px 12px;
		box-shadow: var(--shadow-card);
	}

	.timer.urgent {
		color: var(--incorrect);
	}

	.timer .dismiss {
		border: none;
		background: none;
		color: var(--muted);
		font-size: 16px;
		cursor: pointer;
		line-height: 1;
	}

	.error-banner {
		background: var(--incorrect-soft);
		color: var(--incorrect);
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.questions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.question {
		position: relative;
		padding: 20px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		border-left: 4px solid var(--rule);
	}

	.q-index {
		font-size: 12px;
		font-weight: 700;
		color: var(--accent-ink);
		background: var(--accent-soft);
		border-radius: 6px;
		padding: 2px 7px;
		align-self: flex-start;
	}

	.source-sentence {
		font-size: 14px;
		font-style: italic;
		color: var(--ink-soft);
	}

	.keyword {
		align-self: flex-start;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.08em;
		background: var(--accent-soft);
		color: var(--accent-ink);
		padding: 3px 10px;
		border-radius: 6px;
	}

	.gap-sentence {
		font-size: 17px;
		line-height: 1.5;
	}

	.gap-marker {
		display: inline-block;
		color: transparent;
		border-bottom: 2.5px solid var(--accent);
		padding-bottom: 1px;
		margin: 0 1px;
	}

	.word-hint {
		font-size: 13px;
		color: var(--muted);
		margin-top: -6px;
	}

	.submit-btn {
		margin-top: 4px;
	}
</style>
