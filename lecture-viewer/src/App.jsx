import { useState } from 'react';
import './App.css';
import LectureViewer from './components/LectureViewer';
import lecture4 from './lectures/lecture4';

function App() {
  const [currentLecture] = useState(lecture4);

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
            <button className="nav-btn active">Lecture 4</button>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <LectureViewer lecture={currentLecture} />
      </main>
    </div>
  );
}

export default App;
