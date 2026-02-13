import { useMemo, useState, useCallback } from 'react';
import { lectures, sections, assignments } from '../lectures';

/**
 * Hook for searching across all content (lectures, sections, assignments)
 * Returns search results with content type, section, and match context
 */
export function useSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    // Build search index from all content on first load
    const searchIndex = useMemo(() => {
        const index = [];

        // Helper to index a content item (works for lectures, sections, and assignments)
        const indexContent = (item, contentType, routePrefix) => {
            const itemId = item.id;

            // Index title and subtitle
            index.push({
                type: contentType,
                contentType,
                contentId: itemId,
                lectureId: itemId, // kept for backwards compatibility with SearchModal
                lectureTitle: item.title,
                sectionId: null,
                sectionTitle: null,
                text: `${item.title} ${item.subtitle}`,
                preview: item.subtitle,
                priority: 1,
                route: `${routePrefix}/${itemId}`
            });

            // Index key takeaway
            if (item.keyTakeaway) {
                index.push({
                    type: 'takeaway',
                    contentType,
                    contentId: itemId,
                    lectureId: itemId,
                    lectureTitle: item.title,
                    sectionId: null,
                    sectionTitle: 'Key Takeaway',
                    text: item.keyTakeaway,
                    preview: item.keyTakeaway,
                    priority: 2,
                    route: `${routePrefix}/${itemId}`
                });
            }

            // Index each section
            if (item.sections) {
                item.sections.forEach((section) => {
                    // Section title and content
                    index.push({
                        type: 'section',
                        contentType,
                        contentId: itemId,
                        lectureId: itemId,
                        lectureTitle: item.title,
                        sectionId: section.id,
                        sectionTitle: section.title,
                        text: `${section.title} ${section.content || ''}`,
                        preview: section.content?.substring(0, 150) || section.title,
                        priority: 2,
                        route: `${routePrefix}/${itemId}`
                    });

                    // Key points
                    if (section.keyPoints) {
                        section.keyPoints.forEach((point) => {
                            index.push({
                                type: 'keypoint',
                                contentType,
                                contentId: itemId,
                                lectureId: itemId,
                                lectureTitle: item.title,
                                sectionId: section.id,
                                sectionTitle: section.title,
                                text: point,
                                preview: point,
                                priority: 3,
                                route: `${routePrefix}/${itemId}`
                            });
                        });
                    }

                    // Code examples
                    if (section.codeExample) {
                        index.push({
                            type: 'code',
                            contentType,
                            contentId: itemId,
                            lectureId: itemId,
                            lectureTitle: item.title,
                            sectionId: section.id,
                            sectionTitle: section.title,
                            text: `${section.codeExample.title} ${section.codeExample.code}`,
                            preview: section.codeExample.title,
                            priority: 4,
                            route: `${routePrefix}/${itemId}`
                        });

                        // Code annotations
                        if (section.codeExample.annotations) {
                            section.codeExample.annotations.forEach((anno) => {
                                index.push({
                                    type: 'annotation',
                                    contentType,
                                    contentId: itemId,
                                    lectureId: itemId,
                                    lectureTitle: item.title,
                                    sectionId: section.id,
                                    sectionTitle: section.title,
                                    text: `${anno.match} ${anno.explanation}`,
                                    preview: `${anno.match}: ${anno.explanation.substring(0, 100)}`,
                                    priority: 5,
                                    route: `${routePrefix}/${itemId}`
                                });
                            });
                        }
                    }
                });
            }

            // Index exercises
            if (item.exercises) {
                item.exercises.forEach((exercise) => {
                    index.push({
                        type: 'exercise',
                        contentType,
                        contentId: itemId,
                        lectureId: itemId,
                        lectureTitle: item.title,
                        sectionId: 'exercises',
                        sectionTitle: exercise.title,
                        text: `${exercise.title} ${exercise.description} ${exercise.hint || ''}`,
                        preview: exercise.description.substring(0, 150),
                        priority: 3,
                        route: `${routePrefix}/${itemId}`
                    });
                });
            }
        };

        // Index all lectures
        Object.values(lectures).forEach((item) => indexContent(item, 'lecture', '/lecture'));

        // Index all sections
        Object.values(sections).forEach((item) => indexContent(item, 'section', '/section'));

        // Index all assignments
        Object.values(assignments).forEach((item) => indexContent(item, 'assignment', '/assignment'));

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

        // Deduplicate by contentId + sectionId (keep highest scoring)
        const seen = new Set();
        const deduplicated = filtered.filter((entry) => {
            const key = `${entry.contentType}-${entry.contentId}-${entry.sectionId}`;
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
