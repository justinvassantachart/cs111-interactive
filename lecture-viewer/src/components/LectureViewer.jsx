import { useState } from 'react';
import PracticeExercise from './PracticeExercise';

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

function LectureViewer({ lecture }) {
    const [activeSection, setActiveSection] = useState(lecture.sections[0]?.id);

    const scrollToSection = (sectionId) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
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
                            className={`sidebar-link ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => scrollToSection(section.id)}
                        >
                            <span className="sidebar-link-icon">{sectionIcons[section.id] || '📄'}</span>
                            {section.title}
                        </button>
                    ))}
                    <button
                        className={`sidebar-link ${activeSection === 'exercises' ? 'active' : ''}`}
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
                        <span className="lecture-number">Lecture {lecture.id}</span>
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
                                <div className="code-block">
                                    <div className="code-header">
                                        <span className="code-title">
                                            📝 {section.codeExample.title}
                                        </span>
                                        <span className="code-lang">{section.codeExample.language}</span>
                                    </div>
                                    <div className="code-content">
                                        <pre><code>{section.codeExample.code}</code></pre>
                                    </div>
                                </div>
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
