import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './App.css';
import LectureViewer from './components/LectureViewer';
import MobileNav from './components/MobileNav';
import { lectures, lectureList } from './lectures';

function App() {
  const { lectureId } = useParams();
  const navigate = useNavigate();

  const currentLectureId = parseInt(lectureId, 10);
  const currentLecture = lectures[currentLectureId];

  const [activeSection, setActiveSection] = useState(
    currentLecture?.sections[0]?.id || ''
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Reset active section when lecture changes
  useEffect(() => {
    if (currentLecture) {
      setActiveSection(currentLecture.sections[0]?.id || '');
    }
  }, [currentLecture]);

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

  const handleLectureChange = (e) => {
    const newLectureId = e.target.value;
    navigate(`/lecture/${newLectureId}`);
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

  // Handle invalid lecture IDs
  if (!currentLecture) {
    return (
      <div className="app">
        <div className="error-container">
          <h1>Lecture not found</h1>
          <p>The requested lecture does not exist.</p>
          <button onClick={() => navigate('/lecture/4')}>Go to Lecture 4</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Mobile Navigation Drawer */}
      <MobileNav
        sections={currentLecture.sections}
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
        lectureList={lectureList}
        currentLectureId={currentLectureId}
        onLectureChange={handleLectureChange}
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

            {/* Lecture Selector */}
            <select
              className="lecture-select"
              value={currentLectureId}
              onChange={handleLectureChange}
            >
              {lectureList.map((lecture) => (
                <option key={lecture.id} value={lecture.id}>
                  Lecture {lecture.id}: {lecture.title}
                </option>
              ))}
            </select>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <LectureViewer
          key={currentLectureId}
          lecture={currentLecture}
          activeSection={activeSection}
          onActiveSectionChange={setActiveSection}
        />
      </main>

      {/* Search Modal - to be implemented */}
      {isSearchOpen && (
        <div
          className="search-modal-overlay"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="search-modal-placeholder"
            onClick={(e) => e.stopPropagation()}
          >
            <p>Search functionality coming soon...</p>
            <button onClick={() => setIsSearchOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

