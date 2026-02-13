import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSearch from '../hooks/useSearch';

function SearchModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { query, results, search, clearSearch } = useSearch();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            clearSearch();
            setSelectedIndex(0);
        }
    }, [isOpen, clearSearch]);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.max(prev - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (results[selectedIndex]) {
                        handleResultClick(results[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        if (resultsRef.current && results.length > 0) {
            const selectedElement = resultsRef.current.children[selectedIndex];
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, results.length]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        search(value);
        setSelectedIndex(0);
    };

    const handleResultClick = useCallback((result) => {
        // Navigate using the route from search index
        const path = result.route || `/lecture/${result.lectureId}`;
        navigate(path);

        // Close modal
        onClose();

        // Scroll to section after a brief delay
        if (result.sectionId) {
            setTimeout(() => {
                const element = document.getElementById(result.sectionId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }
    }, [navigate, onClose]);

    const getTypeIcon = (type) => {
        switch (type) {
            case 'lecture': return '📖';
            case 'section': return '📑';
            case 'keypoint': return '💡';
            case 'code': return '💻';
            case 'annotation': return '📝';
            case 'exercise': return '🏋️';
            case 'takeaway': return '⭐';
            default: return '📄';
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'lecture': return 'Lecture';
            case 'section': return 'Section';
            case 'keypoint': return 'Key Point';
            case 'code': return 'Code';
            case 'annotation': return 'Annotation';
            case 'exercise': return 'Exercise';
            case 'takeaway': return 'Takeaway';
            default: return 'Content';
        }
    };

    const highlightMatch = (text, query) => {
        if (!query.trim()) return text;

        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        let result = text;

        words.forEach((word) => {
            const regex = new RegExp(`(${word})`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
        });

        return result;
    };

    if (!isOpen) return null;

    return (
        <div className="search-modal-overlay" onClick={onClose}>
            <div className="search-modal" onClick={(e) => e.stopPropagation()}>
                {/* Search Input */}
                <div className="search-modal-header">
                    <div className="search-input-wrapper">
                        <svg
                            className="search-input-icon"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            className="search-input"
                            placeholder="Search lectures, code, concepts..."
                            value={query}
                            onChange={handleInputChange}
                            autoComplete="off"
                        />
                        {query && (
                            <button
                                className="search-clear-btn"
                                onClick={() => {
                                    clearSearch();
                                    inputRef.current?.focus();
                                }}
                                aria-label="Clear search"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="search-tips">
                        <span className="search-tip">↑↓ Navigate</span>
                        <span className="search-tip">↵ Select</span>
                        <span className="search-tip">Esc Close</span>
                    </div>
                </div>

                {/* Results */}
                <div className="search-modal-body">
                    {query && results.length === 0 && (
                        <div className="search-no-results">
                            <p>No results found for "{query}"</p>
                            <p className="search-no-results-hint">Try different keywords or check spelling</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <ul className="search-results" ref={resultsRef}>
                            {results.map((result, index) => (
                                <li
                                    key={`${result.lectureId}-${result.sectionId}-${index}`}
                                    className={`search-result ${index === selectedIndex ? 'selected' : ''}`}
                                    onClick={() => handleResultClick(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className="search-result-icon">
                                        {getTypeIcon(result.type)}
                                    </div>
                                    <div className="search-result-content">
                                        <div className="search-result-header">
                                            <span
                                                className="search-result-title"
                                                dangerouslySetInnerHTML={{
                                                    __html: highlightMatch(result.sectionTitle || result.lectureTitle, query)
                                                }}
                                            />
                                            <span className="search-result-type">
                                                {getTypeLabel(result.type)}
                                            </span>
                                        </div>
                                        <div
                                            className="search-result-preview"
                                            dangerouslySetInnerHTML={{
                                                __html: highlightMatch(result.preview.substring(0, 100), query) + (result.preview.length > 100 ? '...' : '')
                                            }}
                                        />
                                        <div className="search-result-meta">
                                            {(result.contentType === 'section' ? 'Section' : result.contentType === 'assignment' ? 'Assignment' : 'Lecture')} {result.lectureId}: {result.lectureTitle}
                                        </div>
                                    </div>
                                    <div className="search-result-arrow">
                                        →
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {!query && (
                        <div className="search-empty-state">
                            <div className="search-empty-icon">🔍</div>
                            <p className="search-empty-title">Search all lectures</p>
                            <p className="search-empty-hint">
                                Find sections, code examples, key concepts, and exercises
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="search-modal-footer">
                    <button className="search-close-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SearchModal;
