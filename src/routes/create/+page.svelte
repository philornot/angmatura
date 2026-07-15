<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Stwórz nowy zestaw — angmatura</title>
</svelte:head>

<div class="container page">
	<a href="/" class="back"><ArrowLeft size={14} aria-hidden="true" /> Strona główna</a>
	<h1>Stwórz nowy zestaw</h1>

	<div class="options">
		<a href="/create/ai" class="option-card card">
			<h2>Ze zdjęcia (AI)</h2>
			<p>Wklej zrzuty ekranu zadania z arkusza CKE, a AI wypisze wszystkie pytania za Ciebie.</p>
		</a>
		<a href="/create/manual" class="option-card card">
			<h2>Ręcznie</h2>
			<p>Wpisz zdania, luki i odpowiedzi samodzielnie.</p>
		</a>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
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

	h1 {
		font-size: 22px;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 8px;
	}

	.option-card {
		display: block;
		padding: 20px;
		text-decoration: none;
		color: var(--ink);
		border-left: 4px solid var(--accent);
	}

	.option-card h2 {
		font-size: 18px;
		margin-bottom: 6px;
	}

	.option-card p {
		font-size: 14px;
		color: var(--ink-soft);
	}
</style>
