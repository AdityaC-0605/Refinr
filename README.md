# Refinr

Refinr is an ethical AI writing assistant that transforms stiff, robotic AI-generated text into natural, professional prose. Unlike tools designed to "bypass" AI detectors, Refinr focuses on transparency and legitimate writing assistance — improving readability, sentence variety, flow, and tone.

## Features

- 🛡️ **Ethics-First Design**: Built to polish text, not hide its origins.
- ✏️ **Split-Pane Editor**: Real-time side-by-side view with word counters and text file uploads.
- 🎛️ **Granular Controls**: Select from 5 tones (Formal, Professional, Conversational, Friendly, Academic), 3 editing intensities, and 3 vocabulary levels.
- 🔍 **Word-Level Diff Viewer**: See exactly what changed with color-coded additions and removals.
- 📊 **Readability Scoring**: Compare before/after Flesch-Kincaid grade levels and scores.
- 🎨 **Premium UI**: Dark theme with glassmorphism, responsive design, and smooth animations.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Engine**: [Google Gemini 2.0 Flash](https://ai.google.dev/) (via `@google/generative-ai`)
- **Styling**: Vanilla CSS with custom CSS variables and design tokens
- **Text Diffing**: [`diff`](https://www.npmjs.com/package/diff) library

## Getting Started

First, clone the repository and install the dependencies:

```bash
git clone https://github.com/AdityaC-0605/Refinr.git
cd Refinr
npm install
```

Next, create a `.env.local` file in the root directory and add your Google Gemini API key:

```env
GEMINI_API_KEY=your_actual_key_here
```

Finally, start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

1. **Input text**: Paste your AI-generated draft into the left pane (or upload a `.txt` file).
2. **Choose settings**: Adjust the tone, intensity, and vocabulary level using the toolbar at the top.
3. **Refine**: Click the "✨ Refine Text" button.
4. **Review**: Examine the changes using the Diff view, check your new readability score, and review the change summary.
5. **Export**: Copy your final polished text to your clipboard.

## Ethical Commitment

Refinr is a transparent writing assistant. We proudly state what this tool does (improves sentence variety, adjusts tone, reduces filler words) and what it does *not* do (bypass AI detection tools or facilitate academic dishonesty). Let's make AI writing better, not just harder to find.
