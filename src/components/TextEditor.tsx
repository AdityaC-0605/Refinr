'use client';

import { useRef, ChangeEvent } from 'react';
import { countWords, countCharacters, validateInput } from '@/lib/sanitize';
import styles from './TextEditor.module.css';

interface TextEditorProps {
    value: string;
    onChange: (text: string) => void;
    disabled?: boolean;
}

export default function TextEditor({ value, onChange, disabled }: TextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const words = countWords(value);
    const chars = countCharacters(value);
    const validation = value.trim().length > 0 ? validateInput(value) : { valid: true };

    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.txt')) {
            alert('Please upload a .txt file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            onChange(text);
        };
        reader.readAsText(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getWordCountClass = () => {
        if (words > 5000) return styles.wordCountError;
        if (words > 4500) return styles.wordCountWarning;
        return '';
    };

    return (
        <div className={styles.container}>
            <div className={styles.editorHeader}>
                <span className={styles.editorTitle}>✏️ Input</span>
                <div className={styles.actions}>
                    <label className={styles.uploadLabel}>
                        📄 Upload .txt
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt"
                            className={styles.uploadInput}
                            onChange={handleFileUpload}
                            disabled={disabled}
                        />
                    </label>
                    {value.length > 0 && (
                        <button
                            className={styles.clearBtn}
                            onClick={() => onChange('')}
                            disabled={disabled}
                            type="button"
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.textareaWrapper}>
                <textarea
                    className={styles.textarea}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={`Paste or type your AI-generated text here...\n\nTip: For best results, use complete paragraphs with at least 10 words.`}
                    disabled={disabled}
                    spellCheck={false}
                    aria-label="Text input"
                    id="text-input"
                />
            </div>

            {!validation.valid && (
                <div className={styles.validationError}>{validation.error}</div>
            )}

            <div className={styles.footer}>
                <span className={`${styles.wordCount} ${getWordCountClass()}`}>
                    {words.toLocaleString()} / 5,000 words
                </span>
                <span className={styles.charCount}>
                    {chars.toLocaleString()} characters
                </span>
            </div>
        </div>
    );
}
