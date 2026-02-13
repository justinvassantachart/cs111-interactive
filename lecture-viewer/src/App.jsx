import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import LectureViewer from './components/LectureViewer';
import MobileNav from './components/MobileNav';
import SearchModal from './components/SearchModal';
import { lectures, lectureList, sections, sectionList, assignments, assignmentList } from './lectures';

function App() {
  const { lectureId, sectionId, assignId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine content type from URL
  let contentType, currentContent, currentContentId;
  if (location.pathname.startsWith('/section/')) {
    contentType = 'section';
    currentContentId = sectionId;
    currentContent = sections[sectionId];
  } else if (location.pathname.startsWith('/assignment/')) {
    contentType = 'assignment';
    currentContentId = assignId;
    currentContent = assignments[assignId];
  } else {
    contentType = 'lecture';
    currentContentId = parseInt(lectureId, 10);
    currentContent = lectures[currentContentId];
  }

  const [activeSection, setActiveSection] = useState(
    currentContent?.sections[0]?.id || ''
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Reset active section when content changes
  useEffect(() => {
    if (currentContent) {
      setActiveSection(currentContent.sections[0]?.id || '');
    }
  }, [currentContent]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Unified navigation handler for the dropdown
  const handleContentChange = (e) => {
    const value = e.target.value;
    // Values are formatted as "type:id" e.g. "lecture:4", "section:s2", "assignment:a0"
    const [type, id] = value.split(':');
    if (type === 'lecture') {
      navigate(`/lecture/${id}`);
    } else if (type === 'section') {
      navigate(`/section/${id}`);
    } else if (type === 'assignment') {
      navigate(`/assignment/${id}`);
    }
  };

  const handleSectionClick = useCallback((sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleSearchClick = () => {
    setIsSearchOpen(true);
  };

  // Build the current select value
  const currentSelectValue = `${contentType}:${currentContentId}`;

  // Handle invalid content IDs
  if (!currentContent) {
    return (
      <div className="app">
        <div className="error-container">
          <h1>Content not found</h1>
          <p>The requested {contentType} does not exist.</p>
          <button onClick={() => navigate('/lecture/4')}>Go to Lecture 4</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Mobile Navigation Drawer */}
      <MobileNav
        sections={currentContent.sections}
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
        lectureList={lectureList}
        sectionList={sectionList}
        assignmentList={assignmentList}
        currentSelectValue={currentSelectValue}
        onContentChange={handleContentChange}
        onSearchClick={handleSearchClick}
      />

      <header className="app-header">
        <div className="header-content">
          <h1 className="logo">
            <span className="logo-cs">CS</span>
            <span className="logo-num">111</span>
            <span className="logo-text">Interactive</span>
          </h1>
          <nav className="nav">
            {/* Search Button */}
            <button
              className="header-search-btn"
              onClick={handleSearchClick}
              aria-label="Search lectures"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Search...</span>
              <kbd className="header-search-shortcut">⌘K</kbd>
            </button>

            {/* Content Selector with optgroups */}
            <select
              className="lecture-select"
              value={currentSelectValue}
              onChange={handleContentChange}
            >
              <optgroup label="Lectures">
                {lectureList.map((lecture) => (
                  <option key={`lecture:${lecture.id}`} value={`lecture:${lecture.id}`}>
                    Lecture {lecture.id}: {lecture.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Sections">
                {sectionList.map((section) => (
                  <option key={`section:${section.id}`} value={`section:${section.id}`}>
                    Section {section.id.replace('s', '')}: {section.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Assignments">
                {assignmentList.map((assignment) => (
                  <option key={`assignment:${assignment.id}`} value={`assignment:${assignment.id}`}>
                    Assignment {assignment.id.replace('a', '')}: {assignment.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <LectureViewer
          key={currentSelectValue}
          lecture={currentContent}
          contentType={contentType}
          activeSection={activeSection}
          onActiveSectionChange={setActiveSection}
        />
      </main>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}

export default App;
