// Lecture index - import all lectures here
import lecture1 from './lecture1';
import lecture2 from './lecture2';
import lecture3 from './lecture3';
import lecture4 from './lecture4';
import lecture5 from './lecture5';
import lecture6 from './lecture6';
import lecture7 from './lecture7';
import lecture8 from './lecture8';
import lecture9 from './lecture9';
import lecture10 from './lecture10';
import lecture11 from './lecture11';
import lecture12 from './lecture12';
import lecture13 from './lecture13';
import lecture14 from './lecture14';

// Section imports
import section2 from './section2';
import section3 from './section3';
import section4 from './section4';

// Assignment imports
import assign0 from './assign0';
import assign1 from './assign1';
import assign2 from './assign2';
import assign3 from './assign3';

// Export all lectures in an organized structure
export const lectures = {
    1: lecture1,
    2: lecture2,
    3: lecture3,
    4: lecture4,
    5: lecture5,
    6: lecture6,
    7: lecture7,
    8: lecture8,
    9: lecture9,
    10: lecture10,
    11: lecture11,
    12: lecture12,
    13: lecture13,
    14: lecture14,
};

// Export sections keyed by section ID string
export const sections = {
    s2: section2,
    s3: section3,
    s4: section4,
};

// Export assignments keyed by assignment ID string
export const assignments = {
    a0: assign0,
    a1: assign1,
    a2: assign2,
    a3: assign3,
};

// Get list of all available lectures for navigation
export const lectureList = Object.values(lectures).map(lecture => ({
    id: lecture.id,
    title: lecture.title,
    subtitle: lecture.subtitle,
}));

// Get list of all sections for navigation
export const sectionList = Object.values(sections).map(section => ({
    id: section.id,
    title: section.title,
    subtitle: section.subtitle,
}));

// Get list of all assignments for navigation
export const assignmentList = Object.values(assignments).map(assignment => ({
    id: assignment.id,
    title: assignment.title,
    subtitle: assignment.subtitle,
}));

// Get a specific lecture by ID
export function getLecture(id) {
    return lectures[id] || null;
}

// Get a specific section by ID
export function getSection(id) {
    return sections[id] || null;
}

// Get a specific assignment by ID
export function getAssignment(id) {
    return assignments[id] || null;
}

export default lectures;
