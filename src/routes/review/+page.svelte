<script lang="ts">
	import QuestionCard from '$lib/components/QuestionCard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import {getDeviceId} from '$lib/deviceId';
	import {pytanieForm, zostaloForm} from '$lib/polishPlural';
	import type {QuestionPrompt, SetType} from '$lib/types';
	import {ArrowLeft} from '@lucide/svelte';

	interface DueItem {
		question: QuestionPrompt;
		setType: SetType;
		setTitle: string;
		setSlug: string;
	}

	let deviceId = $state('');
	let loading = $state(true);

	// `allItems` is the full due set fetched once from the server. `queue` is
	// the active round — starts as a copy of allItems, and on a "popraw błędy"
	// restart becomes just the questions missed in the previous round, so we
	// can requeue them without a round-trip (the server's next_due_at for a
	// miss is already "now", so a re-fetch would return the same items anyway).
	let allItems = $state<DueItem[]>([]);
	let queue = $state<DueItem[]>([]);
	let index = $state(0);
	let wrongIds = $state<number[]>([]);
	let round = $state(1);
	let roundFinished = $state(false);

	let current = $derived(queue[index]);

	$effect(() => {
		deviceId = getDeviceId();
		if (!deviceId) {
			loading = false;
			return;
		}
		fetch(`/api/review?deviceId=${encodeURIComponent(deviceId)}`)
			.then((r) => r.json())
			.then((data: DueItem[]) => {
				allItems = data;
				queue = data.slice();
				loading = false;
			})
			.catch(() => {
				loading = false;
			});
	});

	function handleAdvance(wasCorrect: boolean) {
		if (!wasCorrect) wrongIds = [...wrongIds, current.question.id];
		if (index + 1 < queue.length) {
			index += 1;
		} else {
			roundFinished = true;
		}
	}

	function repeatMistakesOnly() {
		const byId = new Map(allItems.map((item) => [item.question.id, item]));
		queue = wrongIds.map((id) => byId.get(id)).filter((item): item is DueItem => !!item);
		wrongIds = [];
		index = 0;
		round += 1;
		roundFinished = false;
	}
</script>

<svelte:head>
	<title>Powtórki — angmatura</title>
</svelte:head>

<div class="container page">
	<a href="/" class="back"><ArrowLeft size={14} aria-hidden="true" /> Strona główna</a>

	{#if loading}
		<p class="empty">Ładowanie…</p>
	{:else if allItems.length === 0}
		<div class="empty-state card">
			<h1>Nic teraz nie czeka na powtórzenie</h1>
			<p>Rozwiąż pierwszy zestaw, żeby tu coś się pojawiło.</p>
			<a href="/" class="btn btn-primary btn-block">Zobacz zestawy</a>
		</div>
	{:else if roundFinished}
		<div class="empty-state card">
			{#if wrongIds.length === 0}
				<p class="summary-eyebrow mono">runda {round}</p>
				<h1>Powtórki na dziś zrobione 🎉</h1>
				<p>Wróć jutro na kolejną rundę powtórek.</p>
				<a href="/" class="btn btn-primary btn-block">Strona główna</a>
			{:else}
				<p class="summary-eyebrow mono">runda {round}</p>
				<h1>{queue.length - wrongIds.length} / {queue.length} poprawnie</h1>
				<p>
					{zostaloForm(wrongIds.length)} {wrongIds.length} {pytanieForm(wrongIds.length)} do poprawienia.
				</p>
				<button type="button" class="btn btn-primary btn-block" onclick={repeatMistakesOnly}>
					Popraw błędy
				</button>
				<a href="/" class="btn btn-ghost btn-block">Strona główna</a>
			{/if}
		</div>
	{:else}
		<ProgressBar current={index + 1} total={queue.length}/>
		{#key current.question.id}
			<QuestionCard
				question={current.question}
				setType={current.setType}
				{deviceId}
				contextLabel={current.setTitle}
				onAdvance={handleAdvance}
			/>
		{/key}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 18px;
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

	.summary-eyebrow {
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.empty {
		color: var(--muted);
		text-align: center;
		padding: 60px 0;
	}

	.empty-state {
		padding: 32px 24px;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 20px;
	}

	.empty-state h1 {
		font-size: 22px;
	}

	.empty-state p {
		color: var(--ink-soft);
		font-size: 14px;
		margin-bottom: 8px;
	}
</style>
