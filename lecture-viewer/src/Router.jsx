import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { lectureList } from './lectures';

// Get the first available lecture ID
const firstLectureId = lectureList.length > 0 ? lectureList[0].id : 4;

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Navigate to={`/lecture/${firstLectureId}`} replace />,
    },
    {
        path: '/lecture/:lectureId',
        element: <App />,
    },
    {
        path: '/section/:sectionId',
        element: <App />,
    },
    {
        path: '/assignment/:assignId',
        element: <App />,
    },
    {
        // Catch-all redirect to first lecture
        path: '*',
        element: <Navigate to={`/lecture/${firstLectureId}`} replace />,
    },
]);

export default router;
