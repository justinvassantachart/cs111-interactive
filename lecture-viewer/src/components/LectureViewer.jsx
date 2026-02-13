import { useEffect, useRef } from 'react';
import PracticeExercise from './PracticeExercise';
import CodeBlock from './CodeBlock';

const sectionIcons = {
    'recap': '📋',
    'small-file': '📁',
    'large-file': '📦',
    'directories': '📂',
    'lookup': '🔍',
    'directory-search': '🔎',
    'file-getblock': '💾',
    'summary': '✨'
};

function LectureViewer({ lecture, contentType = 'lecture', activeSection, onActiveSectionChange }) {
    const isScrollingRef = useRef(false);

    // Use internal state if no props provided (backwards compatibility)
    const currentActiveSection = activeSection || lecture.sections[0]?.id;
    const setActiveSection = onActiveSectionChange || (() => { });

    // Scroll-spy: Update activeSection based on scroll position
    useEffect(() => {
        // Get all section IDs including exercises
        const sectionIds = [...lecture.sections.map(s => s.id), 'exercises'];

        const observer = new IntersectionObserver(
            (entries) => {
                // Don't update if user just clicked a nav link (smooth scrolling)
                if (isScrollingRef.current) return;

                // Find the topmost visible section
                const visibleEntries = entries.filter(entry => entry.isIntersecting);

                if (visibleEntries.length > 0) {
                    // Sort by their position in the viewport (top to bottom)
                    const sorted = visibleEntries.sort((a, b) => {
                        return a.boundingClientRect.top - b.boundingClientRect.top;
                    });

                    // Use the section closest to the top of viewport
                    setActiveSection(sorted[0].target.id);
                }
            },
            {
                // Trigger when section is 20% visible from the top
                rootMargin: '-20% 0px -70% 0px',
                threshold: 0
            }
        );

        // Observe all sections
        sectionIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [lecture.sections, setActiveSection]);

    const scrollToSection = (sectionId) => {
        setActiveSection(sectionId);
        isScrollingRef.current = true;

        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });

            // Reset the scrolling flag after animation completes
            setTimeout(() => {
                isScrollingRef.current = false;
            }, 1000);
        }
    };

    return (
        <div className="lecture-viewer">
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <p className="sidebar-title">Sections</p>
                <nav className="sidebar-nav">
                    {lecture.sections.map((section) => (
                        <button
                            key={section.id}
                            className={`sidebar-link ${currentActiveSection === section.id ? 'active' : ''}`}
                            onClick={() => scrollToSection(section.id)}
                        >
                            <span className="sidebar-link-icon">{sectionIcons[section.id] || '📄'}</span>
                            {section.title}
                        </button>
                    ))}
                    <button
                        className={`sidebar-link ${currentActiveSection === 'exercises' ? 'active' : ''}`}
                        onClick={() => scrollToSection('exercises')}
                    >
                        <span className="sidebar-link-icon">💻</span>
                        Practice Exercises
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="content-area">
                <div className="content-inner">
                    {/* Lecture Header */}
                    <header className="lecture-header">
                        <span className="lecture-number">
                            {contentType === 'lecture' && `Lecture ${lecture.id}`}
                            {contentType === 'section' && `Section ${lecture.id.replace('s', '')}`}
                            {contentType === 'assignment' && `Assignment ${lecture.id.replace('a', '')}`}
                        </span>
                        <h1 className="lecture-title">{lecture.title}</h1>
                        <p className="lecture-subtitle">{lecture.subtitle}</p>
                    </header>

                    {/* Sections */}
                    {lecture.sections.map((section) => (
                        <section key={section.id} id={section.id} className="section">
                            <div className="section-header">
                                <div className="section-icon">{sectionIcons[section.id] || '📄'}</div>
                                <h2 className="section-title">{section.title}</h2>
                            </div>

                            <p className="section-content" dangerouslySetInnerHTML={{
                                __html: section.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }} />

                            {section.keyPoints && (
                                <div className="key-points">
                                    <h3 className="key-points-title">🎯 Key Points</h3>
                                    <ul className="key-points-list">
                                        {section.keyPoints.map((point, idx) => (
                                            <li key={idx}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {section.diagram && (
                                <div className="diagram">
                                    <pre>{section.diagram}</pre>
                                </div>
                            )}

                            {section.codeExample && (
                                <CodeBlock codeExample={section.codeExample} />
                            )}

                            {section.advantages && section.disadvantages && (
                                <div className="pros-cons">
                                    <div className="pros">
                                        <h4 className="pros-title">✓ Advantages</h4>
                                        <ul>
                                            {section.advantages.map((adv, idx) => (
                                                <li key={idx}>{adv}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="cons">
                                        <h4 className="cons-title">✗ Disadvantages</h4>
                                        <ul>
                                            {section.disadvantages.map((dis, idx) => (
                                                <li key={idx}>{dis}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </section>
                    ))}

                    {/* Practice Exercises */}
                    <section id="exercises" className="exercises-section">
                        <header className="exercises-header">
                            <h2 className="exercises-title">Practice Exercises</h2>
                            <p className="exercises-subtitle">
                                Test your understanding with hands-on coding practice
                            </p>
                        </header>

                        {lecture.exercises.map((exercise) => (
                            <PracticeExercise key={exercise.id} exercise={exercise} />
                        ))}
                    </section>

                    {/* Key Takeaway */}
                    <div className="takeaway-box">
                        <h3 className="takeaway-title">📌 Key Takeaway</h3>
                        <p className="takeaway-text">{lecture.keyTakeaway}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LectureViewer;
