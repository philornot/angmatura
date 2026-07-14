import { GoogleGenAI, Type } from '@google/genai';
import { env } from '$env/dynamic/private';
import type { AiGeneratedSet, Question, SetType } from '$lib/types';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
	if (!env.GEMINI_API_KEY) {
		throw new Error(
			'GEMINI_API_KEY is not set. Add it to your .env file to use the AI import feature.'
		);
	}
	if (!client) {
		client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
	}
	return client;
}

function getModel(): string {
	return env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export interface ImagePart {
	base64Data: string;
	mimeType: string;
}

const SET_RESPONSE_SCHEMA = {
	type: Type.OBJECT,
	properties: {
		type: {
			type: Type.STRING,
			enum: ['kwt', 'grammar', 'translation'],
			description:
				'Which of the three Polish-matura English exercise types this worksheet is.'
		},
		suggestedTitle: {
			type: Type.STRING,
			description: 'A short title for this worksheet, e.g. "Matura maj 2023 - transformacje"'
		},
		questions: {
			type: Type.ARRAY,
			items: {
				type: Type.OBJECT,
				properties: {
					sentence1: {
						type: Type.STRING,
						description: 'Source sentence. Empty string for grammar/translation tasks.'
					},
					sentence2WithGap: {
						type: Type.STRING,
						description: 'The sentence containing the gap, with the gap written as ______'
					},
					keyword: {
						type: Type.STRING,
						description: 'The key word in capitals, for KWT tasks only. Empty string otherwise.'
					},
					correctAnswer: {
						type: Type.STRING,
						description:
							'The words that fill the gap. Wrap optional fragments in parentheses, e.g. "so noisy outside (that)".'
					},
					alternativeAnswers: {
						type: Type.ARRAY,
						items: { type: Type.STRING },
						description: 'Other accepted phrasings, if the answer key lists any. Otherwise empty.'
					},
					maxWords: {
						type: Type.NUMBER,
						description: 'Max number of words allowed in the gap, if specified on the sheet. Else 0.'
					},
					minWords: {
						type: Type.NUMBER,
						description: 'Min number of words allowed in the gap, if specified on the sheet. Else 0.'
					}
				},
				required: ['sentence2WithGap', 'correctAnswer']
			}
		}
	},
	required: ['type', 'questions']
};

const IMPORT_PROMPT = `You will be given one or more screenshots that together show a single English-exam task from the Polish "matura rozszerzona" exam (CKE).

Analyze ALL attached images as one task and list EVERY question visible across all of them, not just the first one.

Identify the exercise type:
- "kwt": Key Word Transformation — a source sentence, a capitalized key word, and a second sentence with a gap that must be completed using a form of the key word.
- "grammar": a single sentence with a gap and a word in brackets that must be transformed to fit.
- "translation": a Polish sentence fragment (or full sentence) that must be translated into English to fill a gap in an English sentence.

For each question, transcribe the source text exactly as printed. Represent the gap in "sentence2WithGap" using six underscores: ______
If the official answer key on the screenshots allows alternative phrasings, list them in alternativeAnswers. If part of the correct answer is optional, wrap that part in parentheses instead of duplicating the whole answer, e.g. "so noisy outside (that)".

Return only the structured data — no commentary.`;

export async function generateSetFromImages(images: ImagePart[]): Promise<AiGeneratedSet> {
	if (images.length === 0) throw new Error('At least one image is required.');

	const response = await getClient().models.generateContent({
		model: getModel(),
		contents: [
			{
				role: 'user',
				parts: [
					{ text: IMPORT_PROMPT },
					...images.map((img) => ({
						inlineData: { data: img.base64Data, mimeType: img.mimeType }
					}))
				]
			}
		],
		config: {
			responseMimeType: 'application/json',
			responseSchema: SET_RESPONSE_SCHEMA
		}
	});

	const text = response.text;
	if (!text) throw new Error('Gemini returned an empty response.');

	const parsed = JSON.parse(text) as AiGeneratedSet;
	if (!Array.isArray(parsed.questions)) {
		throw new Error('Gemini response did not include a question list.');
	}
	return parsed;
}

const typeLabels: Record<SetType, string> = {
	kwt: 'Key Word Transformation',
	grammar: 'gap-filling grammar exercise',
	translation: 'partial-sentence translation'
};

/** One cheap, cached-on-first-use explanation of the grammar being tested (spec 4.3). */
export async function generateExplanation(question: Question, setType: SetType): Promise<string> {
	const prompt = `This is a ${typeLabels[setType]} question from the Polish English matura exam.
${question.sentence1 ? `Source sentence: ${question.sentence1}\n` : ''}Sentence with gap: ${question.sentence2WithGap}
${question.keyword ? `Key word: ${question.keyword}\n` : ''}Correct answer: ${question.correctAnswer}

In exactly one sentence, in Polish, explain what grammatical construction this transformation is testing. Do not restate the answer, just name and briefly explain the construction.`;

	const response = await getClient().models.generateContent({
		model: getModel(),
		contents: [{ role: 'user', parts: [{ text: prompt }] }]
	});

	const text = response.text?.trim();
	if (!text) throw new Error('Gemini returned an empty explanation.');
	return text;
}
