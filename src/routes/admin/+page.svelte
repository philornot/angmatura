<script lang="ts">
	import { enhance } from '$app/forms';
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
	import { Star } from '@lucide/svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Admin — angmatura</title>
</svelte:head>

<div class="container page">
	<h1>Panel administratora</h1>

	{#if !data.authed}
		<form method="POST" action="?/login" use:enhance class="login card">
			{#if form?.message}
				<p class="error-banner">{form.message}</p>
			{/if}
			<label class="field-label" for="password">Hasło</label>
			<input id="password" name="password" class="field" type="password" required />
			<button type="submit" class="btn btn-primary btn-block">Zaloguj</button>
		</form>
	{:else}
		<form method="POST" action="?/logout" use:enhance class="logout-row">
			<button type="submit" class="btn btn-ghost">Wyloguj</button>
		</form>

		{#if form?.message}
			<p class="error-banner">{form.message}</p>
		{/if}

		<ul class="set-list">
			{#each data.sets as set (set.id)}
				<li class="set-row card">
					<div class="set-info">
						<SetTypeBadge type={set.type} />
						<span class="title">{set.title}</span>
						{#if set.isFeatured}
							<span class="featured-pill"><Star size={12} fill="currentColor" aria-hidden="true" /> Polecane</span>
						{/if}
						<span class="count mono">{set.questionCount} pytań</span>
					</div>
					<div class="links-row">
						<span class="link-pill mono">/set/{set.slug}</span>
						{#if set.customSlug}
							<span class="link-pill mono custom">/set/{set.customSlug}</span>
						{/if}
					</div>
					<form method="POST" action="?/setCustomSlug" use:enhance class="custom-slug-form">
						<input type="hidden" name="id" value={set.id} />
						<input
							name="customSlug"
							class="field mono"
							type="text"
							placeholder={set.isPublic ? 'niestandardowy-link (opcjonalnie)' : 'najpierw opublikuj zestaw'}
							value={set.customSlug ?? ''}
							disabled={!set.isPublic}
						/>
						<button type="submit" class="btn btn-secondary" disabled={!set.isPublic}>Zapisz link</button>
					</form>
					<div class="set-actions">
						<a href="/edit/{set.slug}" class="btn btn-secondary">Edytuj</a>
						<form method="POST" action="?/togglePublic" use:enhance>
							<input type="hidden" name="id" value={set.id} />
							<input type="hidden" name="isPublic" value={set.isPublic} />
							<button type="submit" class="btn btn-secondary">
								{set.isPublic ? 'Ukryj' : 'Publikuj'}
							</button>
						</form>
						<form method="POST" action="?/toggleFeatured" use:enhance>
							<input type="hidden" name="id" value={set.id} />
							<input type="hidden" name="isFeatured" value={set.isFeatured} />
							<button
								type="submit"
								class="btn btn-secondary"
								disabled={!set.isPublic}
								title={set.isPublic ? '' : 'Najpierw opublikuj zestaw'}
							>
								{set.isFeatured ? 'Odznacz' : 'Wyróżnij'}
							</button>
						</form>
						<form
							method="POST"
							action="?/delete"
							use:enhance={({ cancel }) => {
								if (!confirm(`Usunąć „${set.title}” na stałe?`)) cancel();
							}}
						>
							<input type="hidden" name="id" value={set.id} />
							<button type="submit" class="btn btn-ghost danger">Usuń</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-top: 8px;
	}

	h1 {
		font-size: 22px;
	}

	.login {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 20px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-soft);
	}

	.error-banner {
		background: var(--incorrect-soft);
		color: var(--incorrect);
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.logout-row {
		display: flex;
		justify-content: flex-end;
	}

	.set-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.set-row {
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.set-info {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.title {
		font-weight: 600;
		flex: 1;
	}

	.count {
		font-size: 12px;
		color: var(--muted);
	}

	.featured-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 700;
		color: var(--accent-ink);
		background: var(--accent-soft);
		padding: 3px 8px;
		border-radius: 999px;
		letter-spacing: 0.02em;
	}

	.set-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.links-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.link-pill {
		font-size: 11px;
		color: var(--muted);
		background: var(--surface-soft, #f2f2f2);
		padding: 3px 8px;
		border-radius: 999px;
	}

	.link-pill.custom {
		color: var(--accent-ink);
		background: var(--accent-soft);
	}

	.custom-slug-form {
		display: flex;
		gap: 8px;
	}

	.custom-slug-form .field {
		flex: 1;
		font-size: 13px;
	}

	.danger {
		color: var(--incorrect);
	}
</style>