# Refinr

Refinr is an ethical AI writing assistant that transforms stiff, robotic AI-generated text into natural, professional prose. Unlike tools designed to "bypass" AI detectors, Refinr focuses on transparency and legitimate writing assistance — improving readability, sentence variety, flow, and tone.

## Features

- 🛡️ **Ethics-First Design**: Built to polish text, not hide its origins.
- ✏️ **Split-Pane Editor**: Real-time side-by-side view with word counters and text file uploads.
- 🎛️ **Granular Controls**: Select from 5 tones (Formal, Professional, Conversational, Friendly, Academic), 3 editing intensities, and 3 vocabulary levels.
- 📝 **Format Presets**: Shape your output specifically for Emails, Blog Posts, Essays, or LinkedIn Posts.
- ⚡ **Real-Time Streaming**: Watch your refined text generate in real-time with streaming AI responses.
- 🔍 **Word-Level Diff & Explanations**: See exactly what changed with color-coded diffs, and read AI explanations for why each sentence was modified.
- ✅ **Grammar Check**: Catch and resolve spelling, grammar, and stylistic errors with one-click inline replacements.
- 🎯 **Tone Consistency Check**: Automatically flag sentences that stray from your target tone, with an option to selectively re-refine them.
- 🔐 **Accounts & Document Storage**: Sign in via Firebase Authentication to save, view, and manage your previous document revisions.
- 📊 **Readability Scoring**: Compare before/after Flesch-Kincaid grade levels and scores.
- 🎨 **Premium UI**: Dark theme with glassmorphism, responsive design, interactive 3D tilt effects, and smooth page transitions.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Engine**: [Google Gemini 2.0 Flash](https://ai.google.dev/) (via `@google/generative-ai`)
- **Backend & Auth**: [Firebase](https://firebase.google.com/) for authentication and Firestore document storage
- **Styling**: Vanilla CSS with custom CSS variables and smooth motion effects
- **Text Diffing**: [`diff`](https://www.npmjs.com/package/diff) library

## Getting Started

First, clone the repository and install the dependencies:

```bash
git clone https://github.com/AdityaC-0605/Refinr.git
cd Refinr
npm install
```

Next, create a `.env.local` file in the root directory and add your Google Gemini and Firebase configuration keys:

```env
GEMINI_API_KEY=your_actual_key_here

# Firebase Client configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin configuration
FIREBASE_PROJECT_ID=your_admin_project_id
FIREBASE_CLIENT_EMAIL=your_admin_client_email
FIREBASE_PRIVATE_KEY="your_admin_private_key"
```

Finally, start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

1. **Sign In (Optional)**: Log in to save your documents and track revision history.
2. **Input text**: Paste your AI-generated draft into the left pane (or upload a `.txt` file).
3. **Choose settings**: Adjust the tone, intensity, vocabulary level, and format preset (e.g., Email, Essay) in the top toolbar.
4. **Refine**: Click the "✨ Refine Text" button to start generating the streamed revision.
5. **Review**: Examine the changes using the Diff view, read AI explanations for modified sentences, and check your readability score.
6. **Export / Save**: Copy your final polished text to your clipboard or save it to your account.

## Ethical Commitment

Refinr is a transparent writing assistant. We proudly state what this tool does (improves sentence variety, adjusts tone, reduces filler words) and what it does *not* do (bypass AI detection tools or facilitate academic dishonesty). Let's make AI writing better, not just harder to find.
