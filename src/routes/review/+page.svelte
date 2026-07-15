<script lang="ts">
	import QuestionCard from '$lib/components/QuestionCard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { getDeviceId } from '$lib/deviceId';
	import type { QuestionPrompt, SetType } from '$lib/types';
	import { ArrowLeft, PartyPopper } from '@lucide/svelte';

	interface DueItem {
		question: QuestionPrompt;
		setType: SetType;
		setTitle: string;
		setSlug: string;
	}

	let deviceId = $state('');
	let loading = $state(true);
	let items = $state<DueItem[]>([]);
	let index = $state(0);
	let done = $state(false);

	let current = $derived(items[index]);

	$effect(() => {
		deviceId = getDeviceId();
		if (!deviceId) {
			loading = false;
			return;
		}
		fetch(`/api/review?deviceId=${encodeURIComponent(deviceId)}`)
			.then((r) => r.json())
			.then((data: DueItem[]) => {
				items = data;
				loading = false;
			})
			.catch(() => {
				loading = false;
			});
	});

	function advance() {
		if (index + 1 < items.length) {
			index += 1;
		} else {
			done = true;
		}
	}
</script>

<svelte:head>
	<title>Powtórki — angmatura</title>
</svelte:head>

<div class="container page">
	<a href="/" class="back"><ArrowLeft size={14} aria-hidden="true" /> Strona główna</a>

	{#if loading}
		<p class="empty">Ładowanie…</p>
	{:else if items.length === 0}
		<div class="empty-state card">
			<h1>Nic teraz nie czeka na powtórzenie</h1>
			<p>Rozwiąż pierwszy zestaw, żeby tu coś się pojawiło.</p>
			<a href="/" class="btn btn-primary btn-block">Zobacz zestawy</a>
		</div>
	{:else if done}
		<div class="empty-state card">
			<h1 class="with-icon">Powtórki na dziś zrobione <PartyPopper size={22} aria-hidden="true" /></h1>
			<p>Wróć jutro — kolejne pytania będą czekać, gdy nadejdzie ich pora.</p>
			<a href="/" class="btn btn-primary btn-block">Strona główna</a>
		</div>
	{:else}
		<ProgressBar current={index + 1} total={items.length} />
		{#key current.question.id}
			<QuestionCard
				question={current.question}
				setType={current.setType}
				{deviceId}
				contextLabel={current.setTitle}
				onAdvance={advance}
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

	.with-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
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
