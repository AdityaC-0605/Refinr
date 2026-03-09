# Refinr

Refinr is an AI writing assistant designed to transform stiff, robotic AI-generated text into natural, professional prose. Instead of focusing on "bypassing" AI detectors, Refinr prioritizes genuine writing assistance by improving readability, sentence variety, flow, and tone.

## Features

- 🛡️ **Ethics-First Design**: Built to polish text, not to obscure its AI origins.
- ✏️ **Split-Pane Editor**: Offers a real-time, side-by-side view with word counters and file upload capabilities.
- 🎛️ **Granular Controls**: Customize your output with 5 tone options (Formal, Professional, Conversational, Friendly, Academic), 3 editing intensities, and 3 vocabulary levels.
- 📝 **Format Presets**: Tailor your refined text for specific formats like Emails, Blog Posts, Essays, or LinkedIn Posts.
- ⚡ **Real-Time Streaming**: Witness your refined text generate live with streaming AI responses.
- 🔍 **Word-Level Diff & Explanations**: Clearly see every change with color-coded diffs and read AI-generated explanations for why sentences were modified.
- ✅ **Grammar Check**: Quickly fix spelling, grammar, and stylistic errors with one-click inline replacements.
- 🎯 **Tone Consistency Check**: Automatically highlights sentences that deviate from your chosen tone, allowing for selective re-refinement.
- 🔐 **Accounts & Document Storage**: Use Firebase Authentication to sign in and save, view, and manage your past document revisions.
- 📊 **Readability Scoring**: Compare Flesch-Kincaid grade levels and scores before and after refinement.
- 🎨 **Premium UI**: Features a dark theme with glassmorphism, responsive design, interactive 3D tilt effects, and smooth page transitions.

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

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. **Sign In (Optional)**: Log in to save your documents and track revision history.
2. **Input Text**: Paste your AI-generated draft into the left pane, or upload a `.txt` file.
3. **Choose Settings**: Adjust the tone, intensity, vocabulary level, and format preset (e.g., Email, Essay) from the top toolbar.
4. **Refine**: Click the "✨ Refine Text" button to begin the streamed revision.
5. **Review**: Examine the changes in the Diff view, read AI explanations for modified sentences, and check your readability score.
6. **Export / Save**: Copy your final polished text to your clipboard or save it to your account.

## Ethical Commitment

Refinr operates as a transparent writing assistant. We clearly state what this tool does—improving sentence variety, adjusting tone, reducing filler words—and what it does *not* do, such as bypassing AI detection tools or facilitating academic dishonesty. Our goal is to enhance AI writing responsibly, not just make it harder to identify.