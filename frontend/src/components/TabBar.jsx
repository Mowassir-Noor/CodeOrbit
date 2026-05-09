import React, { useRef } from 'react';

const getFileIcon = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase();
    const icons = {
        js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
        java: '☕', py: '🐍', json: '📋', html: '🌐',
        css: '🎨', scss: '🎨', md: '📝', sh: '🖥️',
        txt: '📄', xml: '📄', yml: '⚙️', yaml: '⚙️',
        env: '⚙️', gitignore: '🔧', dockerfile: '🐳',
    };
    return icons[ext] || '📄';
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
        fontSize: '12px',
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
