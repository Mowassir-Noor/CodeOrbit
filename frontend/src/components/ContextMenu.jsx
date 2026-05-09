import React, { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, items, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    // Adjust position so menu doesn't go off-screen
    const style = {
        ...s.menu,
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y, window.innerHeight - items.length * 32 - 16),
    };

    return (
        <div ref={menuRef} style={style}>
            {items.map((item, idx) =>
                item.separator ? (
                    <div key={idx} style={s.separator} />
                ) : (
                    <button
                        key={idx}
                        style={{
                            ...s.item,
                            ...(item.danger ? s.itemDanger : {}),
                            ...(item.disabled ? s.itemDisabled : {}),
                        }}
                        onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
                        disabled={item.disabled}
                    >
                        {item.icon && <span style={s.icon}>{item.icon}</span>}
                        <span>{item.label}</span>
                        {item.shortcut && <span style={s.shortcut}>{item.shortcut}</span>}
                    </button>
                )
            )}
        </div>
    );
};

const s = {
    menu: {
        position: 'fixed',
        zIndex: 9999,
        backgroundColor: '#252526',
        border: '1px solid #3c3c3c',
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: '190px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontFamily: '"Inter", -apple-system, sans-serif',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '6px 14px',
        background: 'none',
        border: 'none',
        color: '#cccccc',
        fontSize: '13px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
    },
    itemDanger: {
        color: '#f48771',
    },
    itemDisabled: {
        opacity: 0.4,
        cursor: 'default',
    },
    icon: {
        fontSize: '14px',
        width: '16px',
        textAlign: 'center',
        flexShrink: 0,
    },
    shortcut: {
        marginLeft: 'auto',
        fontSize: '11px',
        color: '#858585',
    },
    separator: {
        height: '1px',
        backgroundColor: '#3c3c3c',
        margin: '4px 0',
    },
};

export default ContextMenu;
