<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, X } from '@lucide/svelte';

	let files = $state<File[]>([]);
	let previews = $state<string[]>([]);
	let generating = $state(false);
	let errorMessage = $state<string | null>(null);
	let dragOver = $state(false);
	let fileInput: HTMLInputElement;

	function addFiles(list: FileList | File[]) {
		const arr = Array.from(list).filter((f) => f.type.startsWith('image/'));
		files = [...files, ...arr];
		previews = [...previews, ...arr.map((f) => URL.createObjectURL(f))];
	}

	function removeFile(i: number) {
		URL.revokeObjectURL(previews[i]);
		files = files.filter((_, idx) => idx !== i);
		previews = previews.filter((_, idx) => idx !== i);
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		const pasted: File[] = [];
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) pasted.push(file);
			}
		}
		if (pasted.length > 0) addFiles(pasted);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
	}

	async function generate() {
		if (files.length === 0) return;
		generating = true;
		errorMessage = null;
		try {
			const form = new FormData();
			for (const f of files) form.append('images', f);
			const res = await fetch('/api/ai-generate-set', { method: 'POST', body: form });
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || 'Nie udało się wygenerować zestawu.');
			}
			const draft = await res.json();
			sessionStorage.setItem('angmatura_ai_draft', JSON.stringify(draft));
			await goto('/create/ai/review');
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Coś poszło nie tak.';
		} finally {
			generating = false;
		}
	}
</script>

<svelte:window onpaste={handlePaste} />

<svelte:head>
	<title>Stwórz zestaw ze zdjęcia — angmatura</title>
</svelte:head>

<div class="container page">
	<a href="/" class="back"><ArrowLeft size={14} aria-hidden="true" /> Strona główna</a>
	<h1>Stwórz zestaw ze zdjęcia</h1>
	<p class="sub">
		Wklej (Ctrl+V) lub przeciągnij zrzuty ekranu całego zadania z arkusza CKE. AI rozpozna typ
		zadania i wypisze wszystkie pytania.
	</p>

	<div
		class="dropzone card"
		class:drag-over={dragOver}
		role="button"
		tabindex="0"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={handleDrop}
		onclick={() => fileInput.click()}
		onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
	>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			class="visually-hidden"
			onchange={(e) => e.currentTarget.files && addFiles(e.currentTarget.files)}
		/>
		<p class="dropzone-text">Kliknij, wklej lub przeciągnij zrzuty ekranu tutaj</p>
	</div>

	{#if previews.length > 0}
		<div class="thumbs">
			{#each previews as src, i (src)}
				<div class="thumb">
					<img {src} alt="Zrzut ekranu {i + 1}" />
					<button type="button" class="remove" onclick={() => removeFile(i)} aria-label="Usuń">
						<X size={14} aria-hidden="true" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if errorMessage}
		<p class="error-banner">{errorMessage}</p>
	{/if}

	<button
		type="button"
		class="btn btn-primary btn-block"
		disabled={files.length === 0 || generating}
		onclick={generate}
	>
		{generating ? 'Analizuję zdjęcia…' : `Generuj zestaw (${files.length})`}
	</button>
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

	.sub {
		color: var(--ink-soft);
		font-size: 14px;
	}

	.dropzone {
		border: 2px dashed var(--rule);
		background: var(--paper-raised);
		padding: 36px 20px;
		text-align: center;
		cursor: pointer;
		box-shadow: none;
	}

	.dropzone.drag-over {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.dropzone-text {
		color: var(--muted);
		font-size: 14px;
	}

	.thumbs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 10px;
	}

	.thumb {
		position: relative;
		aspect-ratio: 3 / 4;
		border-radius: var(--radius-sm);
		overflow: hidden;
		box-shadow: var(--shadow-card);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.55);
		color: white;
		line-height: 1;
		cursor: pointer;
	}

	.error-banner {
		background: var(--incorrect-soft);
		color: var(--incorrect);
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}
</style>
