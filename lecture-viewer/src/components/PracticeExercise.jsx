import { useState } from 'react';

function PracticeExercise({ exercise }) {
    const [code, setCode] = useState(exercise.starterCode);
    const [showSolution, setShowSolution] = useState(false);
    const [showHint, setShowHint] = useState(false);

    const handleReset = () => {
        setCode(exercise.starterCode);
        setShowSolution(false);
    };

    return (
        <div className="exercise-card">
            <div className="exercise-header">
                <h3 className="exercise-title">{exercise.title}</h3>
                <span className={`exercise-difficulty ${exercise.difficulty}`}>
                    {exercise.difficulty}
                </span>
            </div>

            <p className="exercise-description">{exercise.description}</p>

            {showHint && (
                <div className="exercise-hint">
                    <p className="exercise-hint-title">💡 Hint</p>
                    <p className="exercise-hint-text">{exercise.hint}</p>
                </div>
            )}

            <div className="code-editor">
                <div className="code-editor-header">
                    <span className="code-editor-dot red"></span>
                    <span className="code-editor-dot yellow"></span>
                    <span className="code-editor-dot green"></span>
                </div>
                <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck={false}
                    placeholder="Write your code here..."
                />
            </div>

            <div className="exercise-actions">
                {!showHint && (
                    <button className="btn btn-secondary" onClick={() => setShowHint(true)}>
                        💡 Show Hint
                    </button>
                )}
                <button className="btn btn-secondary" onClick={handleReset}>
                    🔄 Reset
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowSolution(!showSolution)}
                >
                    {showSolution ? '👁️ Hide Solution' : '✨ Show Solution'}
                </button>
            </div>

            {showSolution && (
                <div className="solution-box">
                    <h4 className="solution-title">✅ Solution</h4>
                    <div className="solution-code">
                        <pre><code>{exercise.solution}</code></pre>
                    </div>
                    <p className="solution-explanation">
                        <strong>Explanation: </strong>{exercise.explanation}
                    </p>
                </div>
            )}
        </div>
    );
}

export default PracticeExercise;
