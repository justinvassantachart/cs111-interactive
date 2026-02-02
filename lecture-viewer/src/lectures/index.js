// Lecture index - import all lectures here
import lecture4 from './lecture4';
import lecture5 from './lecture5';
import lecture6 from './lecture6';
import lecture7 from './lecture7';
import lecture8 from './lecture8';
import lecture9 from './lecture9';
import lecture10 from './lecture10';
import lecture11 from './lecture11';
import lecture12 from './lecture12';

// Export all lectures in an organized structure
export const lectures = {
    4: lecture4,
    5: lecture5,
    6: lecture6,
    7: lecture7,
    8: lecture8,
    9: lecture9,
    10: lecture10,
    11: lecture11,
    12: lecture12,
};

// Get list of all available lectures for navigation
export const lectureList = Object.values(lectures).map(lecture => ({
    id: lecture.id,
    title: lecture.title,
    subtitle: lecture.subtitle,
}));

// Get a specific lecture by ID
export function getLecture(id) {
    return lectures[id] || null;
}

export default lectures;
