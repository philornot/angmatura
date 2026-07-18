<script lang="ts">
	import QuestionCard from '$lib/components/QuestionCard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { getDeviceId } from '$lib/deviceId';
	import type { QuestionPrompt } from '$lib/types';
	import { ArrowLeft, PartyPopper } from '@lucide/svelte';

	let { data } = $props();
	let set = $derived(data.set);
	let questions = $derived(data.questions);
	let byId = $derived(new Map<number, QuestionPrompt>(questions.map((q: QuestionPrompt) => [q.id, q])));

	const deviceId = getDeviceId();

	// Deliberately only captures the initial value on mount — the $effect
	// below (guarded by firstRun) is what handles re-seeding the session when
	// SvelteKit reuses this component for a genuinely different question list.
	// svelte-ignore state_referenced_locally
	let queue = $state<QuestionPrompt[]>(questions.slice());
	let index = $state(0);
	let wrongIds = $state<number[]>([]);
	let round = $state(1);
	let roundFinished = $state(false);

	// Re-seed the whole session whenever the loaded question list changes —
	// covers SvelteKit reusing this component when navigating from one set's
	// Study mode straight to another's. (Harmless no-op on first mount, since
	// it reproduces the initializer above.)
	let firstRun = true;
	$effect(() => {
		questions; // establish the dependency
		if (firstRun) {
			firstRun = false;
			return;
		}
		queue = questions.slice();
		index = 0;
		wrongIds = [];
		round = 1;
		roundFinished = false;
	});

	let current = $derived(queue[index]);

	function handleAdvance(wasCorrect: boolean) {
		if (!wasCorrect) wrongIds = [...wrongIds, current.id];
		if (index + 1 < queue.length) {
			index += 1;
		} else {
			roundFinished = true;
		}
	}

	function repeatMistakesOnly() {
		queue = wrongIds.map((id) => byId.get(id)!).filter(Boolean);
		wrongIds = [];
		index = 0;
		round += 1;
		roundFinished = false;
	}
</script>

<svelte:head>
	<title>Nauka — {set.title}</title>
</svelte:head>

<div class="container page">
	{#if !roundFinished}
		<div class="top">
			<a href="/set/{set.slug}" class="back"><ArrowLeft size={14} aria-hidden="true" /> {set.title}</a>
			<ProgressBar current={index + 1} total={queue.length} />
		</div>

		{#key current.id}
			<QuestionCard
				question={current}
				setType={set.type}
				{deviceId}
				onAdvance={handleAdvance}
			/>
		{/key}
	{:else}
		<div class="summary card">
			{#if wrongIds.length === 0}
				<p class="summary-eyebrow mono">runda {round}</p>
				<h1 class="with-icon">Zero błędów. 🎉</h1>
				<p class="summary-sub">Ukończono {queue.length} {queue.length === 1 ? 'pytanie' : 'pytań'} bez pomyłki.</p>
				<a href="/set/{set.slug}" class="btn btn-primary btn-block">Wróć do zestawu</a>
			{:else}
				<p class="summary-eyebrow mono">runda {round}</p>
				<h1>{queue.length - wrongIds.length} / {queue.length} poprawnie</h1>
				<p class="summary-sub">
					Zostało {wrongIds.length} {wrongIds.length === 1 ? 'pytanie' : 'pytań'} do powtórzenia.
				</p>
				<button type="button" class="btn btn-primary btn-block" onclick={repeatMistakesOnly}>
					Powtórz tylko błędy
				</button>
				<a href="/set/{set.slug}" class="btn btn-ghost btn-block">Zakończ na dziś</a>
			{/if}
		</div>
	{/if}
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
		flex-direction: column;
		gap: 10px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--muted);
		text-decoration: none;
	}

	.with-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.summary {
		padding: 32px 24px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		text-align: center;
		margin-top: 40px;
	}

	.summary-eyebrow {
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.summary h1 {
		font-size: 24px;
	}

	.summary-sub {
		color: var(--ink-soft);
		font-size: 14px;
		margin-bottom: 10px;
	}
</style>
