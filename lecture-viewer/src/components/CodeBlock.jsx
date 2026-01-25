import { useState, useRef, useEffect } from 'react';

/**
 * CodeBlock - A syntax-highlighted code display with clickable annotations
 * 
 * Usage in lecture data:
 * {
 *   codeExample: {
 *     title: "Example title",
 *     language: "cpp",
 *     code: `your code here`,
 *     annotations: [
 *       { match: "function_name", explanation: "What this function does..." },
 *       { match: "variable", explanation: "What this variable represents..." },
 *     ]
 *   }
 * }
 */

// Syntax highlighting patterns for C++
const tokenize = (code) => {
    const tokens = [];
    let remaining = code;
    let pos = 0;

    const patterns = [
        // Comments
        { type: 'comment', regex: /^\/\/.*/ },
        { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
        // Strings
        { type: 'string', regex: /^"(?:[^"\\]|\\.)*"/ },
        { type: 'string', regex: /^'(?:[^'\\]|\\.)*'/ },
        // Numbers
        { type: 'number', regex: /^0x[0-9a-fA-F]+/ },
        { type: 'number', regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
        // Keywords
        { type: 'keyword', regex: /^(?:alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq)\b/ },
        // Types (common ones)
        { type: 'type', regex: /^(?:size_t|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|string|vector|map|set|pair|unique_ptr|shared_ptr|optional|variant|tuple|array|deque|list|queue|stack|unordered_map|unordered_set|std::\w+)\b/ },
        // Preprocessor
        { type: 'preprocessor', regex: /^#\w+/ },
        // Operators
        { type: 'operator', regex: /^(?:->|<<|>>|<=|>=|==|!=|&&|\|\||[+\-*/%=<>&|^!~?:])/ },
        // Punctuation
        { type: 'punctuation', regex: /^[{}()\[\];,.]/ },
        // Identifiers
        { type: 'identifier', regex: /^[a-zA-Z_]\w*/ },
        // Whitespace
        { type: 'whitespace', regex: /^\s+/ },
        // Anything else
        { type: 'plain', regex: /^./ },
    ];

    while (remaining.length > 0) {
        let matched = false;
        for (const pattern of patterns) {
            const match = remaining.match(pattern.regex);
            if (match) {
                tokens.push({
                    type: pattern.type,
                    value: match[0],
                    start: pos,
                    end: pos + match[0].length
                });
                pos += match[0].length;
                remaining = remaining.substring(match[0].length);
                matched = true;
                break;
            }
        }
        if (!matched) {
            tokens.push({ type: 'plain', value: remaining[0], start: pos, end: pos + 1 });
            pos++;
            remaining = remaining.substring(1);
        }
    }

    return tokens;
};

// Find which annotation applies to a token
const findAnnotation = (token, annotations) => {
    if (!annotations) return null;
    for (const annotation of annotations) {
        // Check if the token value matches the annotation pattern
        if (typeof annotation.match === 'string') {
            // Exact match or word boundary match
            if (token.value === annotation.match ||
                token.value.includes(annotation.match)) {
                return annotation;
            }
        } else if (annotation.match instanceof RegExp) {
            if (annotation.match.test(token.value)) {
                return annotation;
            }
        }
    }
    return null;
};

function CodeBlock({ codeExample }) {
    const [activeAnnotation, setActiveAnnotation] = useState(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const codeRef = useRef(null);
    const popoverRef = useRef(null);

    const { title, language, code, annotations } = codeExample;
    const tokens = tokenize(code);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) &&
                !e.target.classList.contains('annotated-token')) {
                setActiveAnnotation(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleTokenClick = (e, annotation) => {
        e.stopPropagation();
        if (activeAnnotation === annotation) {
            setActiveAnnotation(null);
            return;
        }

        const rect = e.target.getBoundingClientRect();
        const codeRect = codeRef.current.getBoundingClientRect();

        setPopoverPos({
            x: rect.left - codeRect.left + rect.width / 2,
            y: rect.bottom - codeRect.top + 8
        });
        setActiveAnnotation(annotation);
    };

    return (
        <div className="code-block">
            <div className="code-header">
                <span className="code-title">
                    📝 {title}
                </span>
                <span className="code-lang">{language}</span>
            </div>
            <div className="code-content" ref={codeRef}>
                <pre>
                    <code>
                        {tokens.map((token, idx) => {
                            const annotation = findAnnotation(token, annotations);
                            const className = `token token-${token.type}${annotation ? ' annotated-token' : ''}`;

                            if (annotation) {
                                return (
                                    <span
                                        key={idx}
                                        className={className}
                                        onClick={(e) => handleTokenClick(e, annotation)}
                                        title="Click for explanation"
                                    >
                                        {token.value}
                                    </span>
                                );
                            }

                            return (
                                <span key={idx} className={className}>
                                    {token.value}
                                </span>
                            );
                        })}
                    </code>
                </pre>

                {/* Annotation Popover */}
                {activeAnnotation && (
                    <div
                        ref={popoverRef}
                        className="annotation-popover"
                        style={{
                            left: popoverPos.x,
                            top: popoverPos.y
                        }}
                    >
                        <div className="annotation-popover-arrow" />
                        <div className="annotation-popover-content">
                            <div className="annotation-popover-header">
                                <code className="annotation-match">{activeAnnotation.match}</code>
                            </div>
                            <p className="annotation-explanation">{activeAnnotation.explanation}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CodeBlock;
