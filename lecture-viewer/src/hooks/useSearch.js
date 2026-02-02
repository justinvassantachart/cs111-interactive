import { useMemo, useState, useCallback } from 'react';
import { lectures } from '../lectures';

/**
 * Hook for searching across all lecture content
 * Returns search results with lecture, section, and match context
 */
export function useSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    // Build search index from all lectures on first load
    const searchIndex = useMemo(() => {
        const index = [];

        Object.values(lectures).forEach((lecture) => {
            // Index lecture title and subtitle
            index.push({
                type: 'lecture',
                lectureId: lecture.id,
                lectureTitle: lecture.title,
                sectionId: null,
                sectionTitle: null,
                text: `${lecture.title} ${lecture.subtitle}`,
                preview: lecture.subtitle,
                priority: 1 // High priority for titles
            });

            // Index key takeaway
            if (lecture.keyTakeaway) {
                index.push({
                    type: 'takeaway',
                    lectureId: lecture.id,
                    lectureTitle: lecture.title,
                    sectionId: null,
                    sectionTitle: 'Key Takeaway',
                    text: lecture.keyTakeaway,
                    preview: lecture.keyTakeaway,
                    priority: 2
                });
            }

            // Index each section
            lecture.sections.forEach((section) => {
                // Section title and content
                index.push({
                    type: 'section',
                    lectureId: lecture.id,
                    lectureTitle: lecture.title,
                    sectionId: section.id,
                    sectionTitle: section.title,
                    text: `${section.title} ${section.content || ''}`,
                    preview: section.content?.substring(0, 150) || section.title,
                    priority: 2
                });

                // Key points
                if (section.keyPoints) {
                    section.keyPoints.forEach((point, idx) => {
                        index.push({
                            type: 'keypoint',
                            lectureId: lecture.id,
                            lectureTitle: lecture.title,
                            sectionId: section.id,
                            sectionTitle: section.title,
                            text: point,
                            preview: point,
                            priority: 3
                        });
                    });
                }

                // Code examples
                if (section.codeExample) {
                    index.push({
                        type: 'code',
                        lectureId: lecture.id,
                        lectureTitle: lecture.title,
                        sectionId: section.id,
                        sectionTitle: section.title,
                        text: `${section.codeExample.title} ${section.codeExample.code}`,
                        preview: section.codeExample.title,
                        priority: 4
                    });

                    // Code annotations
                    if (section.codeExample.annotations) {
                        section.codeExample.annotations.forEach((anno) => {
                            index.push({
                                type: 'annotation',
                                lectureId: lecture.id,
                                lectureTitle: lecture.title,
                                sectionId: section.id,
                                sectionTitle: section.title,
                                text: `${anno.match} ${anno.explanation}`,
                                preview: `${anno.match}: ${anno.explanation.substring(0, 100)}`,
                                priority: 5
                            });
                        });
                    }
                }
            });

            // Index exercises
            if (lecture.exercises) {
                lecture.exercises.forEach((exercise) => {
                    index.push({
                        type: 'exercise',
                        lectureId: lecture.id,
                        lectureTitle: lecture.title,
                        sectionId: 'exercises',
                        sectionTitle: exercise.title,
                        text: `${exercise.title} ${exercise.description} ${exercise.hint || ''}`,
                        preview: exercise.description.substring(0, 150),
                        priority: 3
                    });
                });
            }
        });

        return index;
    }, []);

    // Perform search with fuzzy matching
    const search = useCallback((searchQuery) => {
        setQuery(searchQuery);

        if (!searchQuery.trim()) {
            setResults([]);
            return [];
        }

        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

        // Score each index entry
        const scored = searchIndex.map((entry) => {
            const text = entry.text.toLowerCase();
            let score = 0;

            // Exact phrase match (highest score)
            if (text.includes(normalizedQuery)) {
                score += 100;
            }

            // Word-by-word matching
            queryWords.forEach((word) => {
                if (text.includes(word)) {
                    score += 20;

                    // Bonus for word at start of text
                    if (text.startsWith(word)) {
                        score += 10;
                    }

                    // Bonus for word in title
                    if (entry.sectionTitle?.toLowerCase().includes(word)) {
                        score += 15;
                    }
                }
            });

            // Priority bonus (lectures and sections score higher)
            score += (6 - entry.priority) * 5;

            return { ...entry, score };
        });

        // Filter and sort by score
        const filtered = scored
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20); // Limit to 20 results

        // Deduplicate by lectureId + sectionId (keep highest scoring)
        const seen = new Set();
        const deduplicated = filtered.filter((entry) => {
            const key = `${entry.lectureId}-${entry.sectionId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 10); // Limit to 10 unique results

        setResults(deduplicated);
        return deduplicated;
    }, [searchIndex]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults([]);
    }, []);

    return {
        query,
        results,
        search,
        clearSearch,
        totalIndexed: searchIndex.length
    };
}

export default useSearch;
