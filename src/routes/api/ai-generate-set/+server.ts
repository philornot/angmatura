import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSetFromImages, type ImagePart } from '$lib/server/gemini';

const MAX_IMAGES = 12;
const MAX_BYTES_PER_IMAGE = 8 * 1024 * 1024;

export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData().catch(() => null);
	if (!form) error(400, 'Expected multipart/form-data.');

	const files = form.getAll('images').filter((f): f is File => f instanceof File);
	if (files.length === 0) error(400, 'Attach at least one screenshot.');
	if (files.length > MAX_IMAGES) error(400, `Attach at most ${MAX_IMAGES} images at once.`);

	const images: ImagePart[] = [];
	for (const file of files) {
		if (file.size > MAX_BYTES_PER_IMAGE) error(400, `${file.name} is too large (max 8 MB).`);
		if (!file.type.startsWith('image/')) error(400, `${file.name} is not an image.`);
		const buffer = Buffer.from(await file.arrayBuffer());
		images.push({ base64Data: buffer.toString('base64'), mimeType: file.type });
	}

	try {
		const generated = await generateSetFromImages(images);
		return json(generated);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'AI generation failed.';
		error(502, message);
	}
};
