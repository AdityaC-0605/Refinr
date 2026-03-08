import Link from 'next/link';
import InteractiveTilt from '@/components/InteractiveTilt';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
                <section className={styles.aboutHero}>
                    <div className={styles.aboutHeroCopy}>
                        <div className={styles.aboutBadge}>
                            <span>🛡️</span>
                            Ethical AI writing system
                        </div>
                        <h1 className={styles.aboutTitle}>
                            Better writing,
                            <span className={styles.aboutTitleAccent}> not better hiding</span>
                        </h1>
                        <p className={styles.aboutSubtitle}>
                            Refinr is a transparent writing assistant for polishing AI-generated
                            drafts into stronger prose. It is built to improve clarity, tone, and
                            rhythm, not to imitate human authorship or game detection tools.
                        </p>
                        <div className={styles.aboutHeroActions}>
                            <Link href="/" className={styles.primaryAction}>
                                Open the editor
                            </Link>
                            <a href="#principles" className={styles.secondaryAction}>
                                Read the principles
                            </a>
                        </div>
                    </div>
                    <div className={styles.aboutHeroStage}>
                        <InteractiveTilt className={styles.manifestoTilt} maxTilt={10}>
                        <div className={styles.manifestoCard}>
                            <span className={styles.manifestoLabel}>Manifesto</span>
                            <h2 className={styles.manifestoTitle}>Editing should be visible, intentional, and accountable.</h2>
                            <ul className={styles.manifestoList}>
                                <li>Readable before/after review</li>
                                <li>Audience-aware tone control</li>
                                <li>Disclosure-friendly workflows</li>
                            </ul>
                        </div>
                        </InteractiveTilt>
                    </div>
                </section>

                <section className={styles.principlesStrip} id="principles">
                    <InteractiveTilt className={styles.principleTilt} maxTilt={7}>
                    <article className={styles.principleCard}>
                        <span className={styles.principleIndex}>01</span>
                        <h2 className={styles.principleTitle}>Transparent by design</h2>
                        <p className={styles.principleText}>
                            The product is framed as an editor, not a disguise. The UI, prompts, and messaging all reinforce that.
                        </p>
                    </article>
                    </InteractiveTilt>
                    <InteractiveTilt className={styles.principleTilt} maxTilt={7}>
                    <article className={styles.principleCard}>
                        <span className={styles.principleIndex}>02</span>
                        <h2 className={styles.principleTitle}>Improvement over deception</h2>
                        <p className={styles.principleText}>
                            Refinr focuses on readability, sentence variety, flow, and tone instead of detector scores or artificial “humanization.”
                        </p>
                    </article>
                    </InteractiveTilt>
                    <InteractiveTilt className={styles.principleTilt} maxTilt={7}>
                    <article className={styles.principleCard}>
                        <span className={styles.principleIndex}>03</span>
                        <h2 className={styles.principleTitle}>Reviewable outputs</h2>
                        <p className={styles.principleText}>
                            Diffs, change summaries, and readability data make the editing process inspectable instead of opaque.
                        </p>
                    </article>
                    </InteractiveTilt>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionEyebrow}>Workflow</p>
                        <h2 className={styles.sectionTitle}>How the product works</h2>
                        <p className={styles.sectionText}>
                            Paste your AI-generated draft, tune the editorial controls, then review the rewritten result with visibility into both the wording and the rationale.
                        </p>
                    </div>
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

                <section className={styles.section}>
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionEyebrow}>Positioning</p>
                        <h2 className={styles.sectionTitle}>Why Refinr is different</h2>
                        <p className={styles.sectionText}>
                            We believe AI writing tools should state plainly what they optimize for. Refinr is built to improve writing quality, not to help people misrepresent machine-generated work.
                        </p>
                    </div>
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

                <section className={styles.section}>
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionEyebrow}>Audience</p>
                        <h2 className={styles.sectionTitle}>Who it is for</h2>
                        <p className={styles.sectionText}>
                            The best fit is anyone using AI as a drafting partner but still wanting the final writing to sound deliberate, human-readable, and responsible.
                        </p>
                    </div>
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

                <section className={styles.ctaSection}>
                    <div className={styles.ctaContent}>
                        <p className={styles.sectionEyebrow}>Start here</p>
                        <h2 className={styles.ctaTitle}>
                            Ready to <span className="gradient-text">rewrite with intent</span>?
                        </h2>
                        <p className={styles.ctaText}>
                            No signup required. Open the editor, shape the tone, and review the output with full visibility.
                        </p>
                    </div>
                    <Link href="/" className={styles.ctaBtn}>
                        ✨ Try the editor
                    </Link>
                </section>
            </main>
            <Footer />
        </div>
    );
}
