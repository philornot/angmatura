<script lang="ts">
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';

	let { data } = $props();
	let set = $derived(data.set);
</script>

<svelte:head>
	<title>{set.title} — angmatura</title>
</svelte:head>

<div class="container page">
	<div class="head">
		<SetTypeBadge type={set.type} />
		<h1>{set.title}</h1>
		{#if set.sourceLabel}
			<p class="source">{set.sourceLabel}</p>
		{/if}
		<p class="count mono">{set.questionCount} pytań</p>
	</div>

	<div class="modes">
		<a href="/set/{set.slug}/study" class="mode-card card">
			<h2>Nauka</h2>
			<p>Jedno pytanie na raz, z natychmiastową informacją zwrotną i podpowiedziami.</p>
		</a>
		<a href="/set/{set.slug}/exam" class="mode-card card">
			<h2>Egzamin</h2>
			<p>Cały zestaw na raz, jak na maturze. Wynik na końcu, bez podpowiedzi po drodze.</p>
		</a>
	</div>

	<a href="/edit/{set.slug}" class="edit-link">Edytuj / forkuj ten zestaw</a>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding-top: 8px;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.head h1 {
		font-size: 24px;
	}

	.source,
	.count {
		font-size: 13px;
		color: var(--muted);
	}

	.modes {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.mode-card {
		display: block;
		padding: 20px;
		text-decoration: none;
		color: var(--ink);
		border-left: 4px solid var(--accent);
	}

	.mode-card h2 {
		font-size: 18px;
		margin-bottom: 6px;
	}

	.mode-card p {
		font-size: 14px;
		color: var(--ink-soft);
	}

	.edit-link {
		align-self: center;
		font-size: 13px;
		color: var(--muted);
		text-decoration: underline;
	}
</style>
