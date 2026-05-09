import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import ContextMenu from './ContextMenu';

// ─── File icon lookup ──────────────────────────────────────────────────────────
const FILE_ICONS = {
    js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️', java: '☕', py: '🐍',
    json: '📋', html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
    md: '📝', sh: '🖥️', bash: '🖥️', txt: '📄', xml: '📄',
    yml: '⚙️', yaml: '⚙️', env: '⚙️', dockerfile: '🐳', rs: '🦀',
    go: '🐹', rb: '💎', php: '🐘', cs: '🟣', cpp: '⚙️', c: '⚙️',
    h: '⚙️', vue: '💚', svelte: '🔶', sql: '🗄️', graphql: '💜',
};

const getFileIcon = (name) => {
    if (!name) return '📄';
    const lower = name.toLowerCase();
    if (lower === 'dockerfile') return '🐳';
    if (lower === '.gitignore' || lower === '.env') return '🔧';
    const ext = name.split('.').pop()?.toLowerCase();
    return FILE_ICONS[ext] || '📄';
};

// ─── Inline Input (for rename / new node) ────────────────────────────────────
const InlineInput = ({ defaultValue = '', onConfirm, onCancel, style }) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };

    return (
        <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            onBlur={() => onCancel()}
            style={{ ...s.inlineInput, ...style }}
        />
    );
};

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
const DeleteModal = ({ name, onConfirm, onCancel }) => (
    <div style={s.modalBackdrop} onClick={onCancel}>
        <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <p style={s.modalText}>Delete <strong style={{ color: '#fff' }}>{name}</strong>?</p>
            <p style={s.modalSub}>This action cannot be undone.</p>
            <div style={s.modalActions}>
                <button style={s.modalCancel} onClick={onCancel}>Cancel</button>
                <button style={s.modalDelete} onClick={onConfirm}>Delete</button>
            </div>
        </div>
    </div>
);

// ─── Draggable + Droppable Tree Node ─────────────────────────────────────────
const TreeNode = memo(({
    node, depth, selectedFile, expandedFolders, renamingId,
    creatingUnder, newNodeType,
    onSelect, onToggleFolder, onStartRename, onConfirmRename, onCancelRename,
    onContextMenu, onConfirmCreate, onCancelCreate,
    onDragStart, onDropOnFolder, dragOverId,
}) => {
    const isDir      = node.fileType === 'DIRECTORY';
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFile === node.filePath;
    const isRenaming = renamingId === node.id;
    const isDragOver = dragOverId === node.id;
    const paddingLeft = 8 + depth * 16;

    const handleClick = () => {
        if (isDir) onToggleFolder(node.id);
        else onSelect(node.filePath);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node);
    };

    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('nodeId', String(node.id));
        onDragStart(node.id);
    };

    const handleDragOver = (e) => {
        if (!isDir) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = parseInt(e.dataTransfer.getData('nodeId'), 10);
        if (draggedId !== node.id) {
            onDropOnFolder(draggedId, isDir ? node.id : node.parentId ?? null);
        }
    };

    return (
        <div>
            {/* ── Node row ── */}
            <div
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onContextMenu={handleContextMenu}
                style={{
                    ...s.row,
                    paddingLeft,
                    ...(isSelected ? s.rowSelected : {}),
                    ...(isDragOver && isDir ? s.rowDragOver : {}),
                }}
                onClick={handleClick}
            >
                {/* Expand/collapse arrow for dirs */}
                {isDir ? (
                    <span style={s.arrow}>{isExpanded ? '▾' : '▸'}</span>
                ) : (
                    <span style={s.arrowPlaceholder} />
                )}

                {/* Icon */}
                <span style={s.icon}>
                    {isDir ? (isExpanded ? '📂' : '📁') : getFileIcon(node.name)}
                </span>

                {/* Name or inline rename input */}
                {isRenaming ? (
                    <InlineInput
                        defaultValue={node.name}
                        onConfirm={(newName) => onConfirmRename(node.id, newName)}
                        onCancel={onCancelRename}
                        style={{ flex: 1 }}
                    />
                ) : (
                    <span style={s.name}>{node.name}</span>
                )}
            </div>

            {/* ── Children + inline "new node" input ── */}
            {isDir && isExpanded && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedFile={selectedFile}
                            expandedFolders={expandedFolders}
                            renamingId={renamingId}
                            creatingUnder={creatingUnder}
                            newNodeType={newNodeType}
                            onSelect={onSelect}
                            onToggleFolder={onToggleFolder}
                            onStartRename={onStartRename}
                            onConfirmRename={onConfirmRename}
                            onCancelRename={onCancelRename}
                            onContextMenu={onContextMenu}
                            onConfirmCreate={onConfirmCreate}
                            onCancelCreate={onCancelCreate}
                            onDragStart={onDragStart}
                            onDropOnFolder={onDropOnFolder}
                            dragOverId={dragOverId}
                        />
                    ))}
                    {creatingUnder === node.id && (
                        <div style={{ paddingLeft: paddingLeft + 16, display: 'flex', alignItems: 'center', gap: 4, padding: `2px 8px 2px ${paddingLeft + 16}px` }}>
                            <span style={s.icon}>{newNodeType === 'DIRECTORY' ? '📁' : '📄'}</span>
                            <InlineInput
                                onConfirm={(name) => onConfirmCreate(name, node.id)}
                                onCancel={onCancelCreate}
                                style={{ flex: 1 }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ─── Main FileTree ─────────────────────────────────────────────────────────────
const FileTree = ({
    tree,
    selectedFile,
    onSelectFile,
    onCreate,
    onRename,
    onDelete,
    onMove,
    roomId,
}) => {
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [renamingId, setRenamingId]           = useState(null);
    const [creatingUnder, setCreatingUnder]     = useState(undefined); // null = root, node.id = under folder
    const [newNodeType, setNewNodeType]         = useState('FILE');
    const [contextMenu, setContextMenu]         = useState(null);
    const [deleteTarget, setDeleteTarget]       = useState(null);
    const [dragOverId, setDragOverId]           = useState(null);
    const dragNodeId = useRef(null);

    const { rootNodes } = tree;

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            if (e.key === 'F2' && renamingId == null) {
                const node = findNodeByPath(tree.nodeMap, selectedFile);
                if (node) setRenamingId(node.id);
            }
            if (e.key === 'Delete' && renamingId == null) {
                const node = findNodeByPath(tree.nodeMap, selectedFile);
                if (node) setDeleteTarget(node);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedFile, renamingId, tree.nodeMap]);

    const findNodeByPath = (nodeMap, filePath) => {
        for (const [, node] of nodeMap) {
            if (node.filePath === filePath) return node;
        }
        return null;
    };

    const toggleFolder = useCallback((id) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const handleStartRename = useCallback((nodeId) => {
        setRenamingId(nodeId);
        setContextMenu(null);
    }, []);

    const handleConfirmRename = useCallback(async (nodeId, newName) => {
        setRenamingId(null);
        try { await onRename(nodeId, newName); }
        catch (err) { alert(err.response?.data?.message || err.message); }
    }, [onRename]);

    const handleCancelRename = useCallback(() => setRenamingId(null), []);

    // ── Context menu builder ──────────────────────────────────────────────────
    const handleContextMenu = useCallback((e, node) => {
        const isDir = node.fileType === 'DIRECTORY';
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
                ...(isDir ? [
                    { icon: '📄', label: 'New File', action: () => { setNewNodeType('FILE'); setCreatingUnder(node.id); setExpandedFolders(p => new Set([...p, node.id])); } },
                    { icon: '📁', label: 'New Folder', action: () => { setNewNodeType('DIRECTORY'); setCreatingUnder(node.id); setExpandedFolders(p => new Set([...p, node.id])); } },
                    { separator: true },
                ] : []),
                { icon: '✏️', label: 'Rename', shortcut: 'F2', action: () => handleStartRename(node.id) },
                { separator: true },
                { icon: '📋', label: 'Copy Path', action: () => navigator.clipboard.writeText(node.filePath) },
                { separator: true },
                { icon: '🗑️', label: 'Delete', shortcut: 'Del', danger: true, action: () => { setDeleteTarget(node); setContextMenu(null); } },
            ],
        });
    }, [handleStartRename]);

    const handleRootContextMenu = useCallback((e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
                { icon: '📄', label: 'New File',   action: () => { setNewNodeType('FILE');      setCreatingUnder(null); } },
                { icon: '📁', label: 'New Folder', action: () => { setNewNodeType('DIRECTORY'); setCreatingUnder(null); } },
            ],
        });
    }, []);

    // ── Create node ───────────────────────────────────────────────────────────
    const handleConfirmCreate = useCallback(async (name, parentId) => {
        setCreatingUnder(undefined);
        try {
            const node = await onCreate(roomId, { name, fileType: newNodeType, parentId: parentId ?? null });
            if (node?.fileType === 'FILE') onSelectFile(node.filePath);
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [newNodeType, onCreate, onSelectFile, roomId]);

    const handleCancelCreate = useCallback(() => setCreatingUnder(undefined), []);

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleConfirmDelete = useCallback(async () => {
        const target = deleteTarget;
        setDeleteTarget(null);
        try { await onDelete(target.id); }
        catch (err) { alert(err.response?.data?.message || err.message); }
    }, [deleteTarget, onDelete]);

    // ── Drag/Drop ─────────────────────────────────────────────────────────────
    const handleDragStart = useCallback((nodeId) => {
        dragNodeId.current = nodeId;
    }, []);

    const handleDropOnFolder = useCallback(async (draggedId, targetParentId) => {
        setDragOverId(null);
        dragNodeId.current = null;
        if (draggedId === targetParentId) return;
        try { await onMove(draggedId, targetParentId); }
        catch (err) { alert(err.response?.data?.message || err.message); }
    }, [onMove]);

    const handleRootDrop = useCallback((e) => {
        e.preventDefault();
        const draggedId = parseInt(e.dataTransfer.getData('nodeId'), 10);
        if (draggedId) handleDropOnFolder(draggedId, null);
    }, [handleDropOnFolder]);

    return (
        <div style={s.container}>
            {/* ── Header ── */}
            <div style={s.header}>
                <span style={s.title}>EXPLORER</span>
                <div style={s.headerActions}>
                    <button style={s.headerBtn} title="New File (Ctrl+N)"
                        onClick={() => { setNewNodeType('FILE'); setCreatingUnder(null); }}>
                        📄
                    </button>
                    <button style={s.headerBtn} title="New Folder"
                        onClick={() => { setNewNodeType('DIRECTORY'); setCreatingUnder(null); }}>
                        📁
                    </button>
                </div>
            </div>

            {/* ── Tree scroll area ── */}
            <div
                style={s.treeArea}
                onContextMenu={handleRootContextMenu}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleRootDrop}
            >
                {/* Root-level new node input */}
                {creatingUnder === null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
                        <span style={s.icon}>{newNodeType === 'DIRECTORY' ? '📁' : '📄'}</span>
                        <InlineInput
                            onConfirm={(name) => handleConfirmCreate(name, null)}
                            onCancel={handleCancelCreate}
                            style={{ flex: 1 }}
                        />
                    </div>
                )}

                {rootNodes.map(node => (
                    <TreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedFile={selectedFile}
                        expandedFolders={expandedFolders}
                        renamingId={renamingId}
                        creatingUnder={creatingUnder}
                        newNodeType={newNodeType}
                        onSelect={onSelectFile}
                        onToggleFolder={toggleFolder}
                        onStartRename={handleStartRename}
                        onConfirmRename={handleConfirmRename}
                        onCancelRename={handleCancelRename}
                        onContextMenu={handleContextMenu}
                        onConfirmCreate={handleConfirmCreate}
                        onCancelCreate={handleCancelCreate}
                        onDragStart={handleDragStart}
                        onDropOnFolder={handleDropOnFolder}
                        dragOverId={dragOverId}
                    />
                ))}

                {rootNodes.length === 0 && creatingUnder === undefined && (
                    <div style={s.empty}>
                        <div>Right-click or use icons above</div>
                        <div style={{ marginTop: 4, opacity: 0.6 }}>to create your first file</div>
                    </div>
                )}
            </div>

            {/* ── Context menu ── */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {/* ── Delete confirmation modal ── */}
            {deleteTarget && (
                <DeleteModal
                    name={deleteTarget.name}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = {
    container: {
        width: '250px',
        minWidth: '180px',
        backgroundColor: '#252526',
        borderRight: '1px solid #3c3c3c',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        fontFamily: '"Inter", -apple-system, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px 8px 15px',
        flexShrink: 0,
    },
    title: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#bbbbbb',
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
    },
    headerActions: {
        display: 'flex',
        gap: '2px',
    },
    headerBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '3px 5px',
        borderRadius: '4px',
        color: '#cccccc',
        lineHeight: 1,
    },
    treeArea: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: '8px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: '22px',
        cursor: 'pointer',
        color: '#cccccc',
        fontSize: '13px',
        paddingRight: '8px',
        borderRadius: '0',
        transition: 'background 0.08s',
    },
    rowSelected: {
        backgroundColor: '#37373d',
        color: '#ffffff',
    },
    rowDragOver: {
        backgroundColor: '#2a4a7f',
        outline: '1px dashed #569cd6',
    },
    arrow: {
        fontSize: '10px',
        width: '14px',
        textAlign: 'center',
        flexShrink: 0,
        color: '#858585',
    },
    arrowPlaceholder: {
        width: '14px',
        flexShrink: 0,
    },
    icon: {
        fontSize: '13px',
        flexShrink: 0,
        lineHeight: 1,
    },
    name: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    inlineInput: {
        background: '#3c3c3c',
        border: '1px solid #007fd4',
        color: '#fff',
        outline: 'none',
        padding: '1px 4px',
        fontSize: '13px',
        borderRadius: '2px',
        width: '100%',
        fontFamily: 'inherit',
    },
    empty: {
        padding: '24px 16px',
        color: '#555',
        fontSize: '12px',
        textAlign: 'center',
        lineHeight: 1.6,
    },
    modalBackdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBox: {
        backgroundColor: '#252526',
        border: '1px solid #3c3c3c',
        borderRadius: '8px',
        padding: '20px 24px',
        minWidth: '280px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    },
    modalText: {
        margin: '0 0 6px',
        fontSize: '14px',
        color: '#cccccc',
    },
    modalSub: {
        margin: '0 0 20px',
        fontSize: '12px',
        color: '#858585',
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
    },
    modalCancel: {
        padding: '6px 14px',
        borderRadius: '4px',
        border: '1px solid #3c3c3c',
        background: 'transparent',
        color: '#cccccc',
        cursor: 'pointer',
        fontSize: '13px',
        fontFamily: 'inherit',
    },
    modalDelete: {
        padding: '6px 14px',
        borderRadius: '4px',
        border: 'none',
        background: '#c72e2e',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '13px',
        fontFamily: 'inherit',
        fontWeight: 600,
    },
};

export default FileTree;
