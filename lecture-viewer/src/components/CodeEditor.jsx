import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';

// Custom theme to match our existing code editor styling
const customTheme = EditorView.theme({
    '&': {
        backgroundColor: 'transparent',
        fontSize: '0.875rem',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    },
    '.cm-content': {
        caretColor: '#6366f1',
        padding: '1rem 0',
    },
    '.cm-cursor': {
        borderLeftColor: '#6366f1',
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
    },
    '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#6a6a80',
    },
    '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 0.75rem 0 0.5rem',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    '.cm-scroller': {
        lineHeight: '1.6',
    },
});

function CodeEditor({ value, onChange, placeholder }) {
    const editorRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) return;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
                onChange(update.state.doc.toString());
            }
        });

        const state = EditorState.create({
            doc: value || '',
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                keymap.of([...defaultKeymap, indentWithTab]),
                cpp(),
                oneDark,
                customTheme,
                updateListener,
                EditorView.lineWrapping,
                EditorState.tabSize.of(4),
                EditorView.contentAttributes.of({
                    'aria-label': 'Code editor',
                    'data-placeholder': placeholder || 'Write your code here...'
                }),
            ],
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, []); // Only initialize once

    // Update content when value changes externally (e.g., reset button)
    useEffect(() => {
        if (viewRef.current) {
            const currentValue = viewRef.current.state.doc.toString();
            if (value !== currentValue) {
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: currentValue.length,
                        insert: value || '',
                    },
                });
            }
        }
    }, [value]);

    return <div ref={editorRef} className="codemirror-wrapper" />;
}

export default CodeEditor;
