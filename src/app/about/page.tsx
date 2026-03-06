import Link from 'next/link';
import Header from '@/components/Header';
import styles from './page.module.css';

export const metadata = {
    title: 'About — Refinr',
    description: 'Learn about Refinr: an ethical writing assistant that improves readability and natural flow without detection evasion.',
};

export default function AboutPage() {
    return (
        <div className={styles.aboutPage}>
            <Header />

            <main className={styles.aboutMain}>
                {/* Hero */}
                <section className={styles.aboutHero}>
                    <div className={styles.aboutBadge}>
                        <span>🛡️</span>
                        Ethical AI Writing Tool
                    </div>
                    <h1 className={styles.aboutTitle}>
                        Better writing,{' '}
                        <span className="gradient-text">not better hiding</span>
                    </h1>
                    <p className={styles.aboutSubtitle}>
                        Refinr is a transparent writing assistant that polishes AI-generated
                        text for readability and style. We are not a detection bypass tool — and we
                        never will be.
                    </p>
                </section>

                {/* How It Works */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>How it works</h2>
                    <p className={styles.sectionText}>
                        Paste your AI-generated draft, choose a tone and editing intensity, and
                        our AI editor will improve the readability, sentence variety, and natural
                        flow — the same things a human editor would focus on.
                    </p>
                    <div className={styles.cardGrid}>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>✏️</div>
                            <h3 className={styles.cardTitle}>Paste your text</h3>
                            <p className={styles.cardDesc}>
                                Drop in any AI-generated draft — up to 5,000 words per request.
                            </p>
                        </div>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>🎛️</div>
                            <h3 className={styles.cardTitle}>Choose your settings</h3>
                            <p className={styles.cardDesc}>
                                Pick a tone (formal, conversational, etc.), editing intensity, and
                                vocabulary level.
                            </p>
                        </div>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>✨</div>
                            <h3 className={styles.cardTitle}>Get polished output</h3>
                            <p className={styles.cardDesc}>
                                See the improved text alongside a color-coded diff showing exactly
                                what changed.
                            </p>
                        </div>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>📊</div>
                            <h3 className={styles.cardTitle}>Readability scoring</h3>
                            <p className={styles.cardDesc}>
                                Before and after Flesch-Kincaid scores so you can measure the
                                improvement.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Ethics */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Our ethical commitment</h2>
                    <p className={styles.sectionText}>
                        We believe AI writing tools should be honest about what they do.
                        Here&apos;s how we&apos;re different from the &quot;undetectable AI&quot; tools:
                    </p>
                    <div className={styles.comparisonGrid}>
                        <div className={`${styles.comparisonCard} ${styles.comparisonUs}`}>
                            <h3 className={styles.comparisonTitle}>✅ Refinr</h3>
                            <ul className={styles.comparisonList}>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Improves readability and natural flow
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Shows diff of all changes made
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Includes AI-assistance disclosure prompts
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Never claims output is &quot;undetectable&quot;
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Encourages responsible, transparent use
                                </li>
                            </ul>
                        </div>
                        <div className={`${styles.comparisonCard} ${styles.comparisonThem}`}>
                            <h3 className={styles.comparisonTitle}>🚫 Bypass tools</h3>
                            <ul className={styles.comparisonList}>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Optimize for detection scores
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Add artificial errors to fool classifiers
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Market as &quot;100% undetectable&quot;
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> Facilitate academic dishonesty
                                </li>
                                <li className={styles.comparisonItem}>
                                    <span>→</span> No transparency about changes made
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Who It's For */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Who this is for</h2>
                    <div className={styles.cardGrid}>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>💼</div>
                            <h3 className={styles.cardTitle}>Professionals</h3>
                            <p className={styles.cardDesc}>
                                Polish AI-drafted emails, reports, and presentations into
                                natural, on-brand prose.
                            </p>
                        </div>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>📝</div>
                            <h3 className={styles.cardTitle}>Content creators</h3>
                            <p className={styles.cardDesc}>
                                Refine AI-generated articles, blog posts, and social media copy
                                for better reader engagement.
                            </p>
                        </div>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>🌍</div>
                            <h3 className={styles.cardTitle}>ESL writers</h3>
                            <p className={styles.cardDesc}>
                                Get natural-sounding English output that helps you learn
                                better phrasing and sentence structure.
                            </p>
                        </div>
                        <div className={styles.card}>
                            <div className={styles.cardIcon}>🏢</div>
                            <h3 className={styles.cardTitle}>Businesses</h3>
                            <p className={styles.cardDesc}>
                                Maintain a consistent, professional tone across all
                                AI-assisted communications.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className={styles.ctaSection}>
                    <h2 className={styles.ctaTitle}>
                        Ready to <span className="gradient-text">write better</span>?
                    </h2>
                    <p className={styles.ctaText}>
                        No signup required. Just paste, polish, and publish.
                    </p>
                    <Link href="/" className={styles.ctaBtn}>
                        ✨ Try the editor
                    </Link>
                </section>
            </main>
        </div>
    );
}
