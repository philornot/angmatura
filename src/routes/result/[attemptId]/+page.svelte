<script lang="ts">
	import StatusIcon from '$lib/components/StatusIcon.svelte';

	let { data } = $props();
	let attempt = $derived(data.attempt);
	let rows = $derived(data.rows);
	let set = $derived(data.set);

	let pct = $derived(attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0);
</script>

<svelte:head>
	<title>Wynik — {set?.title ?? 'zestaw'}</title>
</svelte:head>

<div class="container page">
	<div class="score-card card">
		<p class="eyebrow mono">wynik egzaminu</p>
		<h1>{attempt.score} / {attempt.total}</h1>
		<p class="pct">{pct}% poprawnych odpowiedzi</p>
	</div>

	<ol class="rows">
		{#each rows as row, i (i)}
			<li class="row card" data-state={row.isCorrect ? 'correct' : 'incorrect'}>
				<StatusIcon correct={row.isCorrect} size={20} />
				<div class="row-body">
					<p class="gap-sentence">{row.question.sentence2WithGap.replace('______', '▁▁▁▁▁▁')}</p>
					<p class="given">
						Twoja odpowiedź: <strong>{row.given || '—'}</strong>
					</p>
					{#if !row.isCorrect}
						<p class="correct-answer">
							Poprawna odpowiedź: <strong>{row.question.correctAnswer}</strong>
							{#if row.question.alternativeAnswers.length > 0}
								<span class="alt"> (lub: {row.question.alternativeAnswers.join(' / ')})</span>
							{/if}
						</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>

	{#if set}
		<div class="actions">
			<a href="/set/{set.slug}/exam" class="btn btn-secondary btn-block">Spróbuj ponownie</a>
			<a href="/set/{set.slug}/study" class="btn btn-primary btn-block">Przećwicz w trybie Nauka</a>
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding-top: 8px;
	}

	.score-card {
		padding: 28px 22px;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.eyebrow {
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.score-card h1 {
		font-size: 34px;
	}

	.pct {
		color: var(--ink-soft);
		font-size: 14px;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.row {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		border-left: 4px solid var(--rule);
	}

	.row[data-state='correct'] {
		border-left-color: var(--correct);
	}
	.row[data-state='incorrect'] {
		border-left-color: var(--incorrect);
	}

	.row-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.gap-sentence {
		font-size: 15px;
	}

	.given,
	.correct-answer {
		font-size: 13px;
		color: var(--ink-soft);
	}

	.correct-answer {
		color: var(--correct);
	}

	.alt {
		color: var(--muted);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
</style>
