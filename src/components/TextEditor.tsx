'use client';

import { useRef, useState, ChangeEvent } from 'react';
import { MAX_INPUT_WORDS, MIN_INPUT_WORDS } from '@/lib/config';
import { countWords, countCharacters, validateInput } from '@/lib/sanitize';
import styles from './TextEditor.module.css';

interface TextEditorProps {
    value: string;
    onChange: (text: string) => void;
    disabled?: boolean;
}

export default function TextEditor({ value, onChange, disabled }: TextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const words = countWords(value);
    const chars = countCharacters(value);
    const validation = value.trim().length > 0 ? validateInput(value) : { valid: true };

    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.txt')) {
            setUploadError('Please upload a .txt file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setUploadError(null);
            onChange(text);
        };
        reader.onerror = () => {
            setUploadError('The selected file could not be read.');
        };
        reader.readAsText(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getWordCountClass = () => {
        if (words > MAX_INPUT_WORDS) return styles.wordCountError;
        if (words > Math.floor(MAX_INPUT_WORDS * 0.9)) return styles.wordCountWarning;
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
                            onClick={() => {
                                setUploadError(null);
                                onChange('');
                            }}
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
                    placeholder={`Paste or type your AI-generated text here...\n\nTip: For best results, use complete paragraphs with at least ${MIN_INPUT_WORDS} words.`}
                    disabled={disabled}
                    spellCheck={false}
                    aria-label="Text input"
                    id="text-input"
                />
            </div>

            {(uploadError || !validation.valid) && (
                <div className={styles.validationError}>{uploadError || validation.error}</div>
            )}

            <div className={styles.footer}>
                <span className={`${styles.wordCount} ${getWordCountClass()}`}>
                    {words.toLocaleString()} / {MAX_INPUT_WORDS.toLocaleString()} words
                </span>
                <span className={styles.charCount}>
                    {chars.toLocaleString()} characters
                </span>
            </div>
        </div>
    );
}
