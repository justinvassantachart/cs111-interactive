import { useState } from 'react';
import './App.css';
import LectureViewer from './components/LectureViewer';
import { lectures, lectureList } from './lectures';

function App() {
  const [currentLectureId, setCurrentLectureId] = useState(4);
  const currentLecture = lectures[currentLectureId];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="logo">
            <span className="logo-cs">CS</span>
            <span className="logo-num">111</span>
            <span className="logo-text">Interactive</span>
          </h1>
          <nav className="nav">
            <select
              className="lecture-select"
              value={currentLectureId}
              onChange={(e) => setCurrentLectureId(Number(e.target.value))}
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
        <LectureViewer key={currentLectureId} lecture={currentLecture} />
      </main>
    </div>
  );
}

export default App;
