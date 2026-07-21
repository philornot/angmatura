import {GoogleGenAI, Type} from '@google/genai';
import {env} from '$env/dynamic/private';
import type {AiGeneratedSet, Question, SetType} from '$lib/types';

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
							'The single main answer that fills the gap. Only use parentheses here for a fragment that can be genuinely DROPPED while the rest still stands alone as correct, e.g. "so noisy outside (that)" (both "so noisy outside" and "so noisy outside that" are valid). Never use parentheses to list alternative wordings — those go in alternativeAnswers as full separate strings instead.'
					},
					alternativeAnswers: {
						type: Type.ARRAY,
						items: { type: Type.STRING },
						description:
							'Other accepted phrasings, each written out IN FULL as its own array entry — never abbreviated with parentheses. E.g. if the answer key prints "was being served (by them / to me) / was being delivered", that is THREE full alternatives: "was being served by them", "was being served to me", "was being delivered" (with correctAnswer holding the base form "was being served"). Otherwise empty.'
					},
					exampleWrongAnswers: {
						type: Type.ARRAY,
						items: {type: Type.STRING},
						description:
							'Known INCORRECT answers explicitly listed on the worksheet/answer key (e.g. common mistakes the teacher marked as wrong, or distractor answers shown for comparison), each written out as its own full string — no compressed slash/parenthesis notation. Do NOT invent these — only include them if they are actually printed on the sheet. Otherwise empty.'
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

Answer keys often compress several accepted phrasings using slashes and parentheses, e.g. "was being served (by them / to me) / was being delivered / was being brought". Do NOT copy that compressed notation as-is. Instead:
- Put ONE base form in correctAnswer, e.g. "was being served".
- Expand every other accepted phrasing into its own COMPLETE string in alternativeAnswers — never leave a dangling parenthesis or a "/" inside a single entry. For the example above, alternativeAnswers would be: ["was being served by them", "was being served to me", "was being delivered", "was being brought"].
- Only keep a "(word)" parenthetical inside correctAnswer itself for a fragment that can be dropped while the remainder is still a complete, independently-correct answer (e.g. "so noisy outside (that)"). This is rare — most answer-key parentheses are actually listing alternatives, not marking something optional, so expand them into alternativeAnswers by default.

If the worksheet or answer key also shows known INCORRECT answers — for example common mistakes crossed out or annotated by a teacher, or distractor answers shown for comparison — transcribe them into exampleWrongAnswers, each as its own full string, with the same expansion rule (no compressed slash/parenthesis notation). Only include an answer here if it is actually visible on the sheet as wrong; never guess or invent plausible mistakes yourself.

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

/**
 * One cheap, cached-on-first-use explanation of *why* the correct answer is
 * what it is (spec 4.3). Earlier version only asked the model to name the
 * grammatical construction ("this tests the Third Conditional") in one
 * sentence — technically true but useless to a student who got it wrong,
 * since it never says how the source sentence's meaning leads to that
 * specific form. This version asks for a short walkthrough instead.
 */
export async function generateExplanation(question: Question, setType: SetType): Promise<string> {
	const prompt = `This is a ${typeLabels[setType]} question from the Polish English matura exam. A student answered incorrectly and needs to understand why, in Polish.
${question.sentence1 ? `Source sentence: ${question.sentence1}\n` : ''}Sentence with gap: ${question.sentence2WithGap}
${question.keyword ? `Key word: ${question.keyword}\n` : ''}Correct answer: ${question.correctAnswer}

Write a SHORT explanation in Polish — 2-3 sentences, no more — that actually teaches the transformation instead of just labeling it. Cover, briefly:
1. What grammatical construction/rule is being tested (name it in a few words, not a definition).
2. Why THIS specific sentence needs that form — connect its meaning/tense (or the key word's requirements) to the gap. Be concrete about this sentence, don't give a generic textbook explanation that could apply to any example of the construction.

Only mention a common mistake if it fits naturally in one short clause — don't force it in as a third point.

You may refer to fragments of the correct answer where needed (e.g. "ponieważ zdanie odnosi się do przeszłości, potrzebujemy 'would have + III forma'") — the student already sees the full answer separately, so this isn't redundant, it's the reasoning. Do not just restate the answer with no reasoning attached.

Formatting: plain prose. You may wrap at most one or two key words/phrases in **double asterisks** for emphasis if it genuinely helps (e.g. **would have + III forma**), but do not use headers, bullet lists, or numbered lists — this renders as a single short paragraph in the app.`;

	const response = await getClient().models.generateContent({
		model: getModel(),
		contents: [{ role: 'user', parts: [{ text: prompt }] }]
	});

	const text = response.text?.trim();
	if (!text) throw new Error('Gemini returned an empty explanation.');
	return text;
}
