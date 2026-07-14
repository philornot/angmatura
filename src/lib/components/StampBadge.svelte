<script lang="ts">
	let { correct }: { correct: boolean } = $props();
</script>

<div class="stamp" class:correct class:incorrect={!correct}>
	{correct ? 'poprawnie' : 'niepoprawnie'}
</div>

<style>
	.stamp {
		position: absolute;
		top: -12px;
		right: 18px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		padding: 6px 12px;
		border-radius: 6px;
		border: 1.5px dashed currentColor;
		background: var(--paper-raised);
		transform: rotate(-4deg);
		animation: stamp-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}

	.correct {
		color: var(--correct);
	}

	.incorrect {
		color: var(--incorrect);
	}

	@keyframes stamp-in {
		from {
			opacity: 0;
			transform: rotate(-4deg) scale(1.4);
		}
		to {
			opacity: 1;
			transform: rotate(-4deg) scale(1);
		}
	}
</style>
