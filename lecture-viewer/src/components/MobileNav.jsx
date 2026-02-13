import { useState, useEffect } from 'react';

function MobileNav({
    sections,
    activeSection,
    onSectionClick,
    lectureList,
    sectionList = [],
    assignmentList = [],
    currentSelectValue,
    onContentChange,
    onSearchClick
}) {
    const [isOpen, setIsOpen] = useState(false);

    // Close drawer when pressing Escape
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSectionClick = (sectionId) => {
        onSectionClick(sectionId);
        setIsOpen(false);
    };

    const handleContentChange = (e) => {
        onContentChange(e);
        setIsOpen(false);
    };

    const sectionIcons = {
        'recap': '📋',
        'small-file': '📁',
        'large-file': '📦',
        'directories': '📂',
        'lookup': '🔍',
        'directory-search': '🔎',
        'file-getblock': '💾',
        'summary': '✨',
        'exercises': '💻'
    };

    return (
        <>
            {/* Hamburger Button */}
            <button
                className="hamburger-btn"
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isOpen}
            >
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
            </button>

            {/* Overlay */}
            <div
                className={`mobile-overlay ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(false)}
                aria-hidden={!isOpen}
            />

            {/* Drawer */}
            <aside
                className={`mobile-drawer ${isOpen ? 'open' : ''}`}
                aria-hidden={!isOpen}
            >
                <div className="mobile-drawer-header">
                    <h2 className="mobile-drawer-title">
                        <span className="logo-cs">CS</span>
                        <span className="logo-num">111</span>
                    </h2>
                    <button
                        className="mobile-drawer-close"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close navigation menu"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Search Button */}
                <button
                    className="mobile-search-btn"
                    onClick={() => {
                        onSearchClick();
                        setIsOpen(false);
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span>Search lectures...</span>
                </button>

                {/* Content Selector */}
                <div className="mobile-drawer-section">
                    <p className="mobile-drawer-section-title">Content</p>
                    <select
                        className="mobile-lecture-select"
                        value={currentSelectValue}
                        onChange={handleContentChange}
                    >
                        <optgroup label="Lectures">
                            {lectureList.map((lecture) => (
                                <option key={`lecture:${lecture.id}`} value={`lecture:${lecture.id}`}>
                                    {lecture.id}: {lecture.title}
                                </option>
                            ))}
                        </optgroup>
                        {sectionList.length > 0 && (
                            <optgroup label="Sections">
                                {sectionList.map((section) => (
                                    <option key={`section:${section.id}`} value={`section:${section.id}`}>
                                        Section {section.id.replace('s', '')}: {section.title}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        {assignmentList.length > 0 && (
                            <optgroup label="Assignments">
                                {assignmentList.map((assignment) => (
                                    <option key={`assignment:${assignment.id}`} value={`assignment:${assignment.id}`}>
                                        Assign {assignment.id.replace('a', '')}: {assignment.title}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                {/* Sections */}
                <div className="mobile-drawer-section">
                    <p className="mobile-drawer-section-title">Sections</p>
                    <nav className="mobile-drawer-nav">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                className={`mobile-drawer-link ${activeSection === section.id ? 'active' : ''}`}
                                onClick={() => handleSectionClick(section.id)}
                            >
                                <span className="mobile-drawer-link-icon">
                                    {sectionIcons[section.id] || '📄'}
                                </span>
                                <span className="mobile-drawer-link-text">{section.title}</span>
                            </button>
                        ))}
                        <button
                            className={`mobile-drawer-link ${activeSection === 'exercises' ? 'active' : ''}`}
                            onClick={() => handleSectionClick('exercises')}
                        >
                            <span className="mobile-drawer-link-icon">💻</span>
                            <span className="mobile-drawer-link-text">Practice Exercises</span>
                        </button>
                    </nav>
                </div>
            </aside>
        </>
    );
}

export default MobileNav;
