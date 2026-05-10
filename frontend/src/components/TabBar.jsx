import React, { useRef } from 'react';

const FileIcon = ({ ext }) => {
    const colors = {
        js: '#f0db4f', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6',
        java: '#e76f00', py: '#306998', json: '#a6a6a6', html: '#e34c26',
        css: '#264de4', scss: '#cc6699', md: '#ffffff', sh: '#89e051',
        txt: '#cccccc', xml: '#ff6600', yml: '#cb171e', yaml: '#cb171e',
        env: '#cb171e', gitignore: '#cb171e', dockerfile: '#2496ed',
    };
    const color = colors[ext] || '#cccccc';
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 1H3C2.44772 1 2 1.44772 2 2V14C2 14.5523 2.44772 15 3 15H13C13.5523 15 14 14.5523 14 14V6L9 1Z" fill="#2d2d2d" stroke={color} strokeWidth="1"/>
            <path d="M9 1V6H14" fill={color} opacity="0.3"/>
            <text x="3.5" y="12" fontSize="7" fill={color} fontFamily="monospace" fontWeight="bold">{ext.slice(0,3).toUpperCase()}</text>
        </svg>
    );
};

const getFileIcon = (name) => {
    if (!name) return <FileIcon ext="" />;
    const lower = name.toLowerCase();
    if (lower === 'dockerfile') return <FileIcon ext="dockerfile" />;
    if (lower === '.gitignore' || lower === '.env') return <FileIcon ext="env" />;
    const ext = name.split('.').pop()?.toLowerCase();
    return <FileIcon ext={ext || ''} />;
};

const TabBar = ({ tabs, activeTab, dirtyTabs, onSelect, onClose }) => {
    const scrollRef = useRef(null);

    const handleMiddleClick = (e, filePath) => {
        if (e.button === 1) {
            e.preventDefault();
            onClose(filePath);
        }
    };

    const handleWheel = (e) => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft += e.deltaY;
        }
    };

    if (tabs.length === 0) return null;

    return (
        <div ref={scrollRef} style={s.bar} onWheel={handleWheel}>
            {tabs.map(tab => {
                const isActive = tab.filePath === activeTab;
                const isDirty  = dirtyTabs?.has(tab.filePath);
                const name     = tab.name || tab.filePath.split('/').pop();

                return (
                    <div
                        key={tab.filePath}
                        style={{
                            ...s.tab,
                            ...(isActive ? s.tabActive : s.tabInactive),
                        }}
                        onClick={() => onSelect(tab.filePath)}
                        onMouseDown={(e) => handleMiddleClick(e, tab.filePath)}
                        title={tab.filePath}
                    >
                        <span style={s.tabIcon}>{getFileIcon(name)}</span>
                        <span style={s.tabName}>{name}</span>
                        {isDirty && <span style={s.dirty} title="Unsaved changes">●</span>}
                        <button
                            style={{
                                ...s.closeBtn,
                                ...(isActive ? s.closeBtnActive : {}),
                            }}
                            onClick={(e) => { e.stopPropagation(); onClose(tab.filePath); }}
                            title="Close tab"
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

const s = {
    bar: {
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: '#252526',
        borderBottom: '1px solid #3c3c3c',
        overflowX: 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
        scrollbarWidth: 'none',
        height: '35px',
    },
    tab: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '0 10px',
        minWidth: '100px',
        maxWidth: '200px',
        cursor: 'pointer',
        fontSize: '13px',
        flexShrink: 0,
        borderRight: '1px solid #3c3c3c',
        userSelect: 'none',
        position: 'relative',
        whiteSpace: 'nowrap',
    },
    tabActive: {
        backgroundColor: '#1e1e1e',
        color: '#ffffff',
        borderTop: '1px solid #007fd4',
    },
    tabInactive: {
        backgroundColor: '#2d2d2d',
        color: '#969696',
    },
    tabIcon: {
        width: '14px',
        height: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    tabName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flex: 1,
    },
    dirty: {
        color: '#e2c08d',
        fontSize: '10px',
        lineHeight: 1,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#969696',
        cursor: 'pointer',
        fontSize: '16px',
        lineHeight: 1,
        padding: '0 2px',
        flexShrink: 0,
        opacity: 0,
        transition: 'opacity 0.1s',
        display: 'flex',
        alignItems: 'center',
    },
    closeBtnActive: {
        opacity: 1,
    },
};

export default TabBar;
