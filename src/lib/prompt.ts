/**
 * Prompt engineering for the Humanize AI editing engine
 * Uses Gemini API — focused on readability, never detection evasion
 */

export type Tone = 'formal' | 'professional' | 'conversational' | 'friendly' | 'academic';
export type Intensity = 'light' | 'moderate' | 'thorough';
export type VocabLevel = 'simplified' | 'standard' | 'advanced';
export type RewriteIntent = 'humanize' | 'clarify' | 'tighten' | 'concise' | 'persuasive';
export type RewritePreset = 'none' | 'email' | 'blog-post' | 'essay' | 'linkedin-post';

export interface HumanizeSettings {
    tone: Tone;
    intensity: Intensity;
    vocabLevel: VocabLevel;
    rewriteIntent: RewriteIntent;
    preserveLength: boolean;
}

export interface ExplanationRequest {
    originalText: string;
    revisedText: string;
}

export interface PolishRequest {
    originalText: string;
    candidateText: string;
    issues: string[];
}

export interface AlternateRewriteRequest {
    originalText: string;
    firstDraft: string;
    issues: string[];
}

const DEFAULT_PROMPT_SETTINGS: HumanizeSettings = {
    tone: 'professional',
    intensity: 'moderate',
    vocabLevel: 'standard',
    rewriteIntent: 'humanize',
    preserveLength: false,
};

interface InputSignals {
    perspective: string;
    structure: string[];
    risks: string[];
}

interface RewriteDiagnostics {
    priorities: string[];
    preserve: string[];
}

interface StyleProfile {
    cadence: string[];
    voice: string[];
}

interface PromptExample {
    before: string;
    after: string;
    matches: (text: string, preset: RewritePreset) => boolean;
}

const COMMON_CAPITALIZED_WORDS = new Set([
    'A', 'An', 'And', 'As', 'At', 'But', 'By', 'For', 'From', 'He', 'Her', 'His', 'I', 'If', 'In',
    'It', 'Its', 'My', 'Of', 'On', 'Or', 'Our', 'She', 'That', 'The', 'Their', 'There', 'These',
    'They', 'This', 'Those', 'To', 'We', 'With', 'You', 'Your',
]);

const TONE_DESCRIPTIONS: Record<Tone, string> = {
    formal: 'Use formal language with proper grammar, structured sentences, and authoritative phrasing suitable for official documents and reports.',
    professional: 'Use clear, confident, and polished language appropriate for business communication, presentations, and professional emails.',
    conversational: 'Use relaxed, natural language as if speaking to a colleague — approachable but still articulate.',
    friendly: 'Use warm, engaging language with a welcoming feel — the kind of tone used in blog posts, newsletters, and social media.',
    academic: 'Use precise, scholarly language with appropriate hedging, citations awareness, and formal structure suitable for academic writing.',
};

const INTENSITY_INSTRUCTIONS: Record<Intensity, string> = {
    light: 'Make minimal changes. Focus only on the most obvious awkward phrasing, redundancies, and mechanical-sounding constructions. Preserve the original structure and vocabulary as much as possible.',
    moderate: 'Make balanced improvements. Fix awkward phrasing, improve sentence variety, reduce redundancy, and enhance transitions. Maintain the overall structure but refine the prose.',
    thorough: 'Perform a comprehensive rewrite. Significantly improve flow, sentence variety, transitions, and vocabulary. Restructure paragraphs where needed for better coherence while preserving the core meaning.',
};

const VOCAB_INSTRUCTIONS: Record<VocabLevel, string> = {
    simplified: 'Use simple, everyday vocabulary. Prefer short, common words over complex alternatives. Target a general audience with no specialized knowledge.',
    standard: 'Use a natural mix of common and moderately sophisticated vocabulary. Appropriate for educated general audiences.',
    advanced: 'Use rich, varied vocabulary including precise technical or literary terms where appropriate. Suitable for expert or academic audiences.',
};

const INTENT_INSTRUCTIONS: Record<RewriteIntent, string> = {
    humanize: 'Make the draft sound more natural, lived-in, and less templated while keeping the meaning intact.',
    clarify: 'Prioritize clarity, logical flow, and easier comprehension. Make the message easier to follow without oversimplifying it.',
    tighten: 'Trim drag, redundancy, and soft phrasing. Make the writing sharper and more deliberate without sounding abrupt.',
    concise: 'Make the draft materially leaner. Remove nonessential words, repeated ideas, and soft setup while preserving the core message.',
    persuasive: 'Increase conviction, momentum, and emphasis while staying credible. Make the writing more compelling without becoming hype-heavy or salesy.',
};

const PRESET_INSTRUCTIONS: Record<Exclude<RewritePreset, 'none'>, string> = {
    email: 'Shape the output like a polished email: clear subject-adjacent opening, concise body, practical transitions, and a professional close-ready tone.',
    'blog-post': 'Shape the output like a blog post: engaging opening, smooth flow, readable pacing, and an approachable structure suitable for online readers.',
    essay: 'Shape the output like an essay: coherent argument flow, formal structure, and transitions that support analytical development.',
    'linkedin-post': 'Shape the output like a LinkedIn post: concise, punchy, professional, and easy to scan while still sounding thoughtful and human.',
};

function getPresetInstruction(preset: RewritePreset): string {
    if (preset === 'none') {
        return 'Do not force a special document format beyond the chosen tone and editing controls.';
    }

    return PRESET_INSTRUCTIONS[preset];
}

function getIntentInstruction(intent: RewriteIntent): string {
    return INTENT_INSTRUCTIONS[intent];
}

function detectPerspective(text: string): string {
    const normalized = text.toLowerCase();
    const firstPerson = (normalized.match(/\b(i|we|me|us|my|our|ours)\b/g) ?? []).length;
    const secondPerson = (normalized.match(/\b(you|your|yours)\b/g) ?? []).length;
    const thirdPerson = (normalized.match(/\b(he|she|they|them|their|theirs|it|its)\b/g) ?? []).length;

    if (firstPerson > secondPerson && firstPerson > thirdPerson) {
        return 'Keep the first-person point of view and do not flatten it into generic corporate language.';
    }

    if (secondPerson > firstPerson && secondPerson >= thirdPerson) {
        return 'Keep the direct second-person address so the piece still speaks to the reader.';
    }

    if (thirdPerson > 0) {
        return 'Keep the existing third-person framing and avoid switching to a more personal voice.';
    }

    return 'Keep the writer’s implied point of view consistent throughout the rewrite.';
}

function detectStructureSignals(text: string): string[] {
    const signals: string[] = [
        'Preserve names, numbers, dates, URLs, references, and factual claims unless the source text is clearly wrong.',
    ];

    if (/\n\s*\n/.test(text)) {
        signals.push('Preserve the paragraph structure unless a small merge or split clearly improves flow.');
    }

    if (/^\s*[-*•]\s+/m.test(text) || /^\s*\d+[.)]\s+/m.test(text)) {
        signals.push('Preserve the list structure and keep the output easy to scan.');
    }

    if (/[?]/.test(text)) {
        signals.push('Keep any direct questions if they help the original intent or pacing.');
    }

    if (/["“”']/.test(text)) {
        signals.push('Preserve quoted wording or attributed language unless it is clearly being edited for grammar or punctuation.');
    }

    return signals;
}

function detectRewriteRisks(text: string): string[] {
    const risks: string[] = [
        'Do not pad the draft with generic throat-clearing, scene-setting, or motivational filler.',
        'Avoid polished-but-empty AI phrasing such as "delve," "tapestry," "in today\'s fast-paced world," "it is important to note," "overall," or "moreover" used mechanically.',
        'Do not overwrite distinctive details with vaguer synonyms.',
        'If a sentence already works, leave it mostly intact instead of rewriting for the sake of rewriting.',
    ];

    const longSentenceMatches = text.match(/[^.!?]+[.!?]/g) ?? [];
    const longSentenceCount = longSentenceMatches.filter(sentence => sentence.trim().split(/\s+/).length >= 26).length;

    if (longSentenceCount > 0) {
        risks.push('Shorten or split only the sentences that feel overloaded; do not make the whole draft choppy.');
    }

    const repeatedTransitionCount = (text.match(/\b(additionally|furthermore|moreover|therefore|however)\b/gi) ?? []).length;
    if (repeatedTransitionCount >= 2) {
        risks.push('Replace formulaic transitions with smoother movement between ideas.');
    }

    return risks;
}

function detectRepeatedTransitionPriority(text: string): string | null {
    const repeatedTransitionCount = (text.match(/\b(additionally|furthermore|moreover|therefore|however|overall)\b/gi) ?? []).length;

    return repeatedTransitionCount >= 2
        ? 'Replace repeated formulaic transitions with smoother links between ideas.'
        : null;
}

function detectLongSentencePriority(text: string): string | null {
    const longSentenceMatches = text.match(/[^.!?]+[.!?]/g) ?? [];
    const longSentenceCount = longSentenceMatches.filter(sentence => sentence.trim().split(/\s+/).length >= 28).length;

    return longSentenceCount > 0
        ? 'Shorten or split the most overloaded sentences so the draft breathes more naturally.'
        : null;
}

function detectWeakOpeningPriority(text: string): string | null {
    const weakOpenings = (text.match(/(?:^|[.!?]\s+)(there (?:is|are|was|were)|it (?:is|was|can be|could be))/gi) ?? []).length;

    return weakOpenings > 0
        ? 'Strengthen weak sentence openings like "There is" or "It is" when a more direct construction would read better.'
        : null;
}

function detectPassiveVoicePriority(text: string): string | null {
    const passiveMatches = (text.match(/\b(?:is|are|was|were|be|been|being)\s+\w+(?:ed|en)\b/gi) ?? []).length;

    return passiveMatches >= 2
        ? 'Convert passive constructions to active ones where that improves clarity and momentum.'
        : null;
}

function detectFillerPriority(text: string): string | null {
    const fillerMatches = (text.match(/\b(really|very|quite|basically|actually|in order to|kind of|sort of)\b/gi) ?? []).length;

    return fillerMatches >= 2
        ? 'Trim filler and verbal padding so the prose feels more deliberate.'
        : null;
}

function detectRepetitionPriority(text: string): string | null {
    const normalizedWords = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 5);
    const counts = new Map<string, number>();

    normalizedWords.forEach(word => {
        counts.set(word, (counts.get(word) ?? 0) + 1);
    });

    const repeatedWord = [...counts.entries()].find(([, count]) => count >= 4);

    return repeatedWord
        ? 'Reduce obvious word repetition and vary phrasing where the draft keeps leaning on the same language.'
        : null;
}

function detectPreserveSignals(text: string): string[] {
    const preserve: string[] = [];

    if (/[0-9]/.test(text)) {
        preserve.push('Keep concrete figures, dates, and numeric details intact.');
    }

    if (/\b(?:https?:\/\/|www\.)\S+/i.test(text)) {
        preserve.push('Preserve URLs and referenced resources exactly.');
    }

    if (/["“”']/.test(text)) {
        preserve.push('Keep quoted or attributed wording anchored to the original meaning.');
    }

    if (/^\s*[-*•]\s+/m.test(text) || /^\s*\d+[.)]\s+/m.test(text)) {
        preserve.push('Keep the scannable list structure while improving phrasing inside each item.');
    }

    if (/\b(i|we|my|our|me|us)\b/i.test(text)) {
        preserve.push('Keep the writer’s personal voice instead of flattening it into generic corporate copy.');
    }

    return preserve;
}

function extractProtectedTerms(text: string): string[] {
    const terms = new Set<string>();

    const addMatches = (pattern: RegExp, maxItems = 8) => {
        const matches = text.match(pattern) ?? [];

        matches.slice(0, maxItems).forEach(match => {
            const cleaned = match.replace(/^[“"]|[”"]$/g, '').trim();
            if (cleaned.length >= 2) {
                terms.add(cleaned);
            }
        });
    };

    addMatches(/\b\d[\d,]*(?:\.\d+)?%?\b/g);
    addMatches(/\b(?:https?:\/\/|www\.)\S+\b/gi, 4);
    addMatches(/\b[A-Z]{2,}(?:[-/][A-Z0-9]{2,})*\b/g, 6);
    addMatches(/[“"][^”"\n]{3,80}[”"]/g, 4);

    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? [];
    capitalizedPhrases.forEach(phrase => {
        if (phrase.includes(' ') && !COMMON_CAPITALIZED_WORDS.has(phrase)) {
            terms.add(phrase.trim());
        }
    });

    const camelCaseMatches = text.match(/\b[A-Z][a-z]+[A-Z][A-Za-z0-9]+\b/g) ?? [];
    camelCaseMatches.forEach(match => terms.add(match.trim()));

    return [...terms].slice(0, 8);
}

function getRewriteDiagnostics(text: string): RewriteDiagnostics {
    const priorities = [
        detectRepeatedTransitionPriority(text),
        detectLongSentencePriority(text),
        detectWeakOpeningPriority(text),
        detectPassiveVoicePriority(text),
        detectFillerPriority(text),
        detectRepetitionPriority(text),
    ].filter((item): item is string => Boolean(item));

    if (priorities.length === 0) {
        priorities.push('Focus on rhythm, precision, and natural phrasing without over-editing lines that already work.');
    }

    return {
        priorities: priorities.slice(0, 4),
        preserve: detectPreserveSignals(text),
    };
}

function getSentenceWordLengths(text: string): number[] {
    return (text.match(/[^.!?]+[.!?]?/g) ?? [])
        .map(sentence => sentence.trim())
        .filter(Boolean)
        .map(sentence => sentence.split(/\s+/).filter(Boolean).length)
        .filter(length => length > 0);
}

function buildStyleProfile(text: string, settings: HumanizeSettings): StyleProfile {
    const sentenceLengths = getSentenceWordLengths(text);
    const shortSentences = sentenceLengths.filter(length => length <= 9).length;
    const longSentences = sentenceLengths.filter(length => length >= 22).length;
    const contractions = (text.match(/\b\w+(?:'|’)(?:t|re|ve|ll|d|s|m)\b/gi) ?? []).length;
    const questions = (text.match(/\?/g) ?? []).length;
    const exclamations = (text.match(/!/g) ?? []).length;

    const cadence: string[] = [];
    const voice: string[] = [];

    if (shortSentences >= 2 && shortSentences >= longSentences) {
        cadence.push('Keep some short, punchy sentences so the draft does not lose its snap.');
    }

    if (longSentences >= 2) {
        cadence.push('Keep some longer flowing sentences where they help momentum, but trim the overloaded ones.');
    }

    if (questions > 0) {
        voice.push('Preserve the draft’s use of direct questions where they shape the voice or pacing.');
    }

    if (exclamations > 0 && (settings.tone === 'friendly' || settings.tone === 'conversational')) {
        voice.push('Keep the energy of emphatic lines without overdoing punctuation.');
    }

    if (contractions > 0 && (settings.tone === 'friendly' || settings.tone === 'conversational')) {
        voice.push('Keep a natural spoken feel with contractions where that fits the original voice.');
    }

    if (contractions === 0 && (settings.tone === 'formal' || settings.tone === 'academic')) {
        voice.push('Avoid introducing casual contractions that would weaken the formal register.');
    }

    if (voice.length === 0) {
        voice.push('Keep the original draft’s voice markers instead of flattening everything into one generic register.');
    }

    if (cadence.length === 0) {
        cadence.push('Keep sentence rhythm varied enough to sound written, not templated.');
    }

    return { cadence, voice };
}

const PROMPT_EXAMPLES: PromptExample[] = [
    {
        before: 'Additionally, our team is excited to leverage this initiative in order to drive meaningful impact across the organization.',
        after: 'Our team is using this initiative to make the work more useful across the organization.',
        matches: text => /\b(additionally|leverage|meaningful impact|in order to)\b/i.test(text),
    },
    {
        before: 'The report, which was prepared over several months and reviewed by multiple stakeholders, was ultimately designed to provide a comprehensive overview of the market while also outlining several strategic options for future consideration.',
        after: 'The report was prepared over several months and reviewed by multiple stakeholders. It gives a clear view of the market and outlines several strategic options.',
        matches: text => (text.match(/[^.!?]+[.!?]/g) ?? []).some(sentence => sentence.trim().split(/\s+/).length >= 28),
    },
    {
        before: 'There are several reasons the policy was updated, and it was decided that clearer language would be used in the final version.',
        after: 'The policy was updated for several reasons, and the final version uses clearer language.',
        matches: text => /(?:^|[.!?]\s+)(there (?:is|are|was|were)|it (?:is|was|can be|could be))/i.test(text),
    },
    {
        before: 'In today’s fast-paced world, it is important to note that we are excited to share this update with our community.',
        after: 'We’re glad to share this update with our community.',
        matches: (text, preset) => /\bin today['’]s fast-paced world\b|\bit is important to note\b|\bwe are excited to\b/i.test(text)
            || preset === 'blog-post'
            || preset === 'linkedin-post',
    },
];

function getInputSignals(text: string): InputSignals {
    return {
        perspective: detectPerspective(text),
        structure: detectStructureSignals(text),
        risks: detectRewriteRisks(text),
    };
}

function buildInputSignalsBlock(text: string): string {
    const signals = getInputSignals(text);

    return `## INPUT-SPECIFIC GUARDRAILS
- ${signals.perspective}
${signals.structure.map(item => `- ${item}`).join('\n')}
${signals.risks.map(item => `- ${item}`).join('\n')}`;
}

function buildRewriteDiagnosticsBlock(text: string): string {
    const diagnostics = getRewriteDiagnostics(text);
    const protectedTerms = extractProtectedTerms(text);

    return `## PRIMARY ISSUES TO FIX
${diagnostics.priorities.map(item => `- ${item}`).join('\n')}
${diagnostics.preserve.length > 0 ? `\n## DETAILS TO PRESERVE\n${diagnostics.preserve.map(item => `- ${item}`).join('\n')}` : ''}
${protectedTerms.length > 0 ? `\n## CONCRETE DETAILS TO KEEP ANCHORED\n- Keep these exact details unless the original itself is clearly wrong: ${protectedTerms.join(', ')}` : ''}`;
}

function buildExamplesBlock(text: string, preset: RewritePreset): string {
    const matches = PROMPT_EXAMPLES
        .filter(example => example.matches(text, preset))
        .slice(0, 2);

    if (matches.length === 0) {
        return '';
    }

    return `## MICRO EXAMPLES OF THE KIND OF EDIT TO MAKE
${matches.map((example, index) => `${index + 1}. Before: ${example.before}\n   Better: ${example.after}`).join('\n')}`;
}

function buildStyleProfileBlock(text: string, settings: HumanizeSettings): string {
    const profile = buildStyleProfile(text, settings);

    return `## STYLE TO PRESERVE
${profile.cadence.map(item => `- ${item}`).join('\n')}
${profile.voice.map(item => `- ${item}`).join('\n')}`;
}

export function buildSystemPrompt(settings: HumanizeSettings, preset: RewritePreset = 'none'): string {
    return `You are an expert editorial assistant specializing in improving the readability and natural flow of text. Your role is to transform stiff, formulaic, or awkwardly written prose into clear, engaging, and natural-sounding writing.

## YOUR ROLE
- You are a writing editor, NOT a detection evasion tool
- Your goal is to improve READABILITY and QUALITY, never to make text "undetectable"
- You help writers create better prose, period

## EDITING GUIDELINES

### Tone
${TONE_DESCRIPTIONS[settings.tone]}

### Editing Intensity
${INTENSITY_INSTRUCTIONS[settings.intensity]}

### Vocabulary Level
${VOCAB_INSTRUCTIONS[settings.vocabLevel]}

### Rewrite Intent
${getIntentInstruction(settings.rewriteIntent)}

### Target Format
${getPresetInstruction(preset)}

${settings.preserveLength ? '### Length Constraint\nKeep the output approximately the same length as the input. Do not significantly expand or reduce the text.' : ''}

## SPECIFIC IMPROVEMENTS TO MAKE
1. **Sentence Variety**: Mix short punchy sentences with longer flowing ones. Avoid starting consecutive sentences the same way.
2. **Transition Quality**: Use natural transitions between ideas, not formulaic connectors like "Furthermore," "Moreover," "Additionally" in sequence.
3. **Redundancy Removal**: Cut filler words, unnecessary qualifiers, and repetitive phrases.
4. **Active Voice**: Prefer active voice unless passive is specifically appropriate for context.
5. **Concrete Language**: Replace vague abstract phrasing with specific, vivid language where possible.
6. **Natural Rhythm**: Read the text aloud mentally — it should sound like a real person wrote it, not a template.
7. **Selective Editing**: Keep what already works. Improve weak sentences, but do not homogenize the whole draft into one bland voice.

## CRITICAL ETHICAL BOUNDARIES
- Do NOT optimize for AI detection scores
- Do NOT alter the statistical properties of text to fool classifiers
- Do NOT add deliberate misspellings, typos, or grammatical errors
- If the text appears to be an academic submission, add a note in the change_summary encouraging the user to follow their institution's AI disclosure policy

## OUTPUT FORMAT
You MUST respond with valid JSON only, no markdown code fences, no extra text. Use this exact format:
{
  "edited_text": "The improved version of the text",
  "change_summary": [
    "Brief description of change 1",
    "Brief description of change 2"
  ]
}`;
}

export function buildUserPrompt(
    text: string,
    preset: RewritePreset = 'none',
    settings: HumanizeSettings = DEFAULT_PROMPT_SETTINGS
): string {
    return `Please improve the following text according to your editorial guidelines. First, silently diagnose the biggest issues in rhythm, clarity, repetition, and tone. Then revise only what needs revision.

${buildInputSignalsBlock(text)}
${buildRewriteDiagnosticsBlock(text)}
${buildExamplesBlock(text, preset)}
${buildStyleProfileBlock(text, settings)}

## REVISION STANDARD
- Keep the meaning, evidence, and factual content intact.
- Make the prose sound written by a thoughtful human editor, not a template engine.
- Prefer precise, grounded phrasing over inflated or generic language.
- Keep strong sentences strong; do not over-process them.
- Primary intent: ${getIntentInstruction(settings.rewriteIntent)}

Return ONLY valid JSON with "edited_text" and "change_summary" fields.

TEXT TO EDIT:
${text}`;
}

export function buildStreamingSystemPrompt(settings: HumanizeSettings, preset: RewritePreset = 'none', voicePromptFragment?: string): string {
    const voiceDnaBlock = voicePromptFragment
        ? `\n## VOICE DNA — AUTHOR'S PERSONAL STYLE\nVoice DNA takes priority over generic tone preset. Preserve the author's voice above all else.\n${voicePromptFragment}\n`
        : '';

    return `You are an expert editorial assistant specializing in improving the readability and natural flow of text. Your role is to transform stiff, formulaic, or awkward prose into clear, engaging, natural-sounding writing.

## YOUR ROLE
- You are a writing editor, NOT a detection evasion tool
- Your goal is to improve readability and quality, never to make text "undetectable"
- Keep the meaning intact while making the writing feel more natural and polished
${voiceDnaBlock}
## EDITING GUIDELINES

### Tone
${TONE_DESCRIPTIONS[settings.tone]}

### Editing Intensity
${INTENSITY_INSTRUCTIONS[settings.intensity]}

### Vocabulary Level
${VOCAB_INSTRUCTIONS[settings.vocabLevel]}

### Rewrite Intent
${getIntentInstruction(settings.rewriteIntent)}

### Target Format
${getPresetInstruction(preset)}

${settings.preserveLength ? '### Length Constraint\nKeep the output approximately the same length as the input. Do not significantly expand or reduce the text.' : ''}

## SPECIFIC IMPROVEMENTS TO MAKE
1. Improve sentence variety and rhythm.
2. Remove redundancy, filler, and robotic phrasing.
3. Prefer natural transitions over formulaic ones.
4. Use active voice where appropriate.
5. Match the requested tone and vocabulary level.
6. Keep strong lines intact and focus the rewrite on the parts that actually feel stiff.

## CRITICAL ETHICAL BOUNDARIES
- Do NOT optimize for AI detection scores
- Do NOT alter the statistical properties of text to fool classifiers
- Do NOT add deliberate mistakes, typos, or grammatical errors

## OUTPUT FORMAT
Return ONLY the rewritten text itself.
- No JSON
- No markdown code fences
- No commentary
- No labels
- No bullet list
- No explanation`;
}

export function buildStreamingUserPrompt(
    text: string,
    preset: RewritePreset = 'none',
    settings: HumanizeSettings = DEFAULT_PROMPT_SETTINGS
): string {
    return `Rewrite the following text according to your editorial guidelines. Silently diagnose what should stay, what should tighten, and what should be recast for better rhythm.

${buildInputSignalsBlock(text)}
${buildRewriteDiagnosticsBlock(text)}
${buildExamplesBlock(text, preset)}
${buildStyleProfileBlock(text, settings)}

## REVISION STANDARD
- Keep the meaning, concrete details, and factual content intact.
- Sound natural and deliberate, not over-produced.
- Avoid AI-cliche phrasing and generic filler.
- Return a clean final draft, not commentary.
- Primary intent: ${getIntentInstruction(settings.rewriteIntent)}

Return only the refined text.

TEXT TO EDIT:
${text}`;
}

export function buildPolishSystemPrompt(settings: HumanizeSettings, preset: RewritePreset = 'none'): string {
    return `You are a senior line editor performing a final polish on an already-rewritten draft.

Your job is NOT to start over from scratch. Your job is to keep the strong parts of the candidate draft and fix only the remaining signs of stiffness, generic AI phrasing, weak rhythm, or over-formality.

## TARGET STYLE
### Tone
${TONE_DESCRIPTIONS[settings.tone]}

### Editing Intensity
${INTENSITY_INSTRUCTIONS[settings.intensity]}

### Vocabulary Level
${VOCAB_INSTRUCTIONS[settings.vocabLevel]}

### Rewrite Intent
${getIntentInstruction(settings.rewriteIntent)}

### Target Format
${getPresetInstruction(preset)}

${settings.preserveLength ? '### Length Constraint\nKeep the output approximately the same length as the input. Do not significantly expand or reduce the text.' : ''}

## POLISH RULES
- Use the ORIGINAL text as the source of truth for meaning and facts.
- Use the CANDIDATE draft as the base to improve.
- Keep what already sounds strong and human.
- Remove only the remaining robotic, inflated, repetitive, or generic phrasing.
- Do not add filler, scene-setting, or motivational fluff.
- Preserve names, numbers, dates, references, and factual claims.
- Return only the final polished text.
- No JSON
- No markdown
- No commentary`;
}

export function buildPolishUserPrompt(
    request: PolishRequest,
    settings: HumanizeSettings = DEFAULT_PROMPT_SETTINGS
): string {
    return `Polish the candidate rewrite below so it sounds more natural, specific, and human while keeping the meaning intact.

${buildInputSignalsBlock(request.originalText)}
${buildRewriteDiagnosticsBlock(request.originalText)}
${buildStyleProfileBlock(request.originalText, settings)}

## PRIMARY INTENT
- ${getIntentInstruction(settings.rewriteIntent)}

## ISSUES TO FIX
${request.issues.map(issue => `- ${issue}`).join('\n')}

## ORIGINAL
${request.originalText}

## CANDIDATE DRAFT
${request.candidateText}`;
}

export function buildAlternativeRewriteSystemPrompt(settings: HumanizeSettings, preset: RewritePreset = 'none'): string {
    return `You are a senior editor generating an alternative rewrite of the same draft.

Your job is to produce a second, distinct rewrite that still preserves meaning and factual content, but solves the draft's remaining stiffness, generic phrasing, weak rhythm, or over-formality better than the first attempt.

## TARGET STYLE
### Tone
${TONE_DESCRIPTIONS[settings.tone]}

### Editing Intensity
${INTENSITY_INSTRUCTIONS[settings.intensity]}

### Vocabulary Level
${VOCAB_INSTRUCTIONS[settings.vocabLevel]}

### Rewrite Intent
${getIntentInstruction(settings.rewriteIntent)}

### Target Format
${getPresetInstruction(preset)}

${settings.preserveLength ? '### Length Constraint\nKeep the output approximately the same length as the input. Do not significantly expand or reduce the text.' : ''}

## RULES
- Keep the original meaning, facts, names, dates, numbers, references, and structure unless a small structural change clearly improves readability.
- Do not copy the first draft too closely if it still sounds generic or mechanical.
- Do not add filler, motivational fluff, or vague abstractions.
- Keep good lines intact if they already sound natural.
- Return only the alternative rewrite.
- No JSON
- No markdown
- No commentary`;
}

export function buildAlternativeRewriteUserPrompt(
    request: AlternateRewriteRequest,
    preset: RewritePreset = 'none',
    settings: HumanizeSettings = DEFAULT_PROMPT_SETTINGS
): string {
    return `Write a stronger alternative version of the draft below.

${buildInputSignalsBlock(request.originalText)}
${buildRewriteDiagnosticsBlock(request.originalText)}
${buildExamplesBlock(request.originalText, preset)}
${buildStyleProfileBlock(request.originalText, settings)}

## PRIMARY INTENT
- ${getIntentInstruction(settings.rewriteIntent)}

## WHAT TO FIX BETTER THAN THE FIRST DRAFT
${request.issues.map(issue => `- ${issue}`).join('\n')}

## ORIGINAL
${request.originalText}

## FIRST DRAFT
${request.firstDraft}`;
}

export function buildExplanationSystemPrompt(): string {
    return `You are an editorial analyst explaining how a revision changed a piece of writing.

Your job is to compare the original and revised text, then identify only the changed sentences or clauses that materially differ.

Rules:
- Return ONLY valid JSON
- No markdown code fences
- No commentary outside the JSON
- Keep each reason to one plain-English sentence
- Focus on readability, clarity, tone, structure, concision, flow, or emphasis
- Do not mention AI detection or classifier evasion
- Only include changed pairs you can confidently match

Use this exact shape:
[
  {
    "original": "original sentence or clause",
    "revised": "revised sentence or clause",
    "reason": "plain-English explanation"
  }
]`;
}

export function buildExplanationUserPrompt(request: ExplanationRequest): string {
    return `Compare the following before-and-after text and return a JSON array of changed sentence or clause pairs with one short reason for each.

ORIGINAL:
${request.originalText}

REVISED:
${request.revisedText}`;
}
