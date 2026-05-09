import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';
import FileTree from '../components/FileTree';
import TabBar from '../components/TabBar';
import TerminalPanel from '../components/TerminalPanel';
import { useFileSystem } from '../hooks/useFileSystem';
import { useBackendRunner, LANGUAGE_CONFIG } from '../hooks/useBackendRunner';
import { roomService } from '../services/api';

const Room = () => {
    const { roomId } = useParams();
    const navigate   = useNavigate();

    const terminalRef = useRef(null);
    const editorRef   = useRef(null);

    const [connected, setConnected]   = useState(false);
    const [activeFile, setActiveFile] = useState(null);
    const [openTabs, setOpenTabs]     = useState([]);
    const [dirtyTabs, setDirtyTabs]   = useState(new Set());
    const [accessState, setAccessState] = useState('checking'); // 'checking' | 'granted' | 'denied'
    const [joining, setJoining]       = useState(false);

    // Check room access on load
    useEffect(() => {
        const checkAccess = async () => {
            try {
                await roomService.getRoom(roomId);
                setAccessState('granted');
            } catch (err) {
                if (err.response?.status === 403) {
                    setAccessState('denied');
                } else if (err.response?.status === 404) {
                    setAccessState('notfound');
                } else {
                    setAccessState('error');
                }
            }
        };
        checkAccess();
    }, [roomId]);

    const handleJoinRoom = async () => {
        setJoining(true);
        try {
            await roomService.joinRoom(roomId);
            setAccessState('granted');
        } catch (err) {
            if (err.response?.status === 409) {
                // Already a member
                setAccessState('granted');
            } else {
                alert('Failed to join room. Please try again.');
            }
        } finally {
            setJoining(false);
        }
    };

    // Always call hooks (React Rules of Hooks)
    const { nodes, tree, createNode, renameNode, moveNode, deleteNode } = useFileSystem(
        accessState === 'granted' ? roomId : null
    );

    // Show access dialog if not granted
    if (accessState === 'checking') {
        return (
            <div style={st.loadingPage}>
                <div style={st.loadingBox}>Checking access...</div>
            </div>
        );
    }

    if (accessState === 'notfound') {
        return (
            <div style={st.loadingPage}>
                <div style={st.errorBox}>
                    <h3>Room Not Found</h3>
                    <p>This room does not exist.</p>
                    <button onClick={() => navigate('/dashboard')} style={st.primaryBtn}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (accessState === 'denied') {
        return (
            <div style={st.loadingPage}>
                <div style={st.errorBox}>
                    <h3>Join Room</h3>
                    <p>You are not a member of this room yet.</p>
                    <div style={st.buttonRow}>
                        <button onClick={() => navigate('/dashboard')} style={st.secondaryBtn}>
                            Back
                        </button>
                        <button onClick={handleJoinRoom} disabled={joining} style={st.primaryBtn}>
                            {joining ? 'Joining...' : 'Join Room'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // If we get here, access is granted - render the full IDE
    return <RoomIDE 
        roomId={roomId}
        nodes={nodes}
        tree={tree}
        createNode={createNode}
        renameNode={renameNode}
        moveNode={moveNode}
        deleteNode={deleteNode}
    />;
};

// Separate component for the IDE to avoid hooks issues
const RoomIDE = ({ roomId, nodes, tree, createNode, renameNode, moveNode, deleteNode }) => {
    const navigate = useNavigate();
    const terminalRef = useRef(null);
    const editorRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [activeFile, setActiveFile] = useState(null);
    const [openTabs, setOpenTabs] = useState([]);
    const [dirtyTabs, setDirtyTabs] = useState(new Set());

    // Only FILE nodes (not DIRECTORY) are valid to open in editor
    const fileNodes = nodes.filter(n => n.fileType !== 'DIRECTORY');

    // ── Tab management ────────────────────────────────────────────────────────

    const openFile = useCallback((filePath) => {
        const node = nodes.find(n => n.filePath === filePath);
        if (!node || node.fileType === 'DIRECTORY') return;

        setOpenTabs(prev => {
            if (prev.some(t => t.filePath === filePath)) return prev;
            return [...prev, { filePath, name: node.name }];
        });
        setActiveFile(filePath);
    }, [nodes]);

    const closeTab = useCallback((filePath) => {
        setOpenTabs(prev => {
            const next = prev.filter(t => t.filePath !== filePath);
            if (activeFile === filePath) {
                const idx = prev.findIndex(t => t.filePath === filePath);
                const fallback = next[Math.max(0, idx - 1)];
                setActiveFile(fallback?.filePath ?? null);
            }
            return next;
        });
        setDirtyTabs(prev => { const n = new Set(prev); n.delete(filePath); return n; });
    }, [activeFile]);

    // Close tabs that no longer exist (after delete/rename)
    const syncTabsAfterEvent = useCallback((deletedPath, newPath) => {
        setOpenTabs(prev => {
            return prev
                .filter(t => !t.filePath.startsWith(deletedPath + '/') && t.filePath !== deletedPath)
                .map(t => {
                    if (newPath && t.filePath === deletedPath) return { ...t, filePath: newPath, name: newPath.split('/').pop() };
                    if (newPath && t.filePath.startsWith(deletedPath + '/')) {
                        const updated = t.filePath.replace(deletedPath, newPath);
                        return { ...t, filePath: updated, name: updated.split('/').pop() };
                    }
                    return t;
                });
        });
        if (activeFile === deletedPath) {
            setActiveFile(newPath ?? null);
        }
    }, [activeFile]);

    // ── Wrapped FS ops that also sync tabs + WebContainer ─────────────────────

    const handleCreate = useCallback(async (roomId, opts) => {
        const node = await createNode(roomId, opts);
        if (node?.fileType === 'DIRECTORY') {
            terminalRef.current?.mkdir(node.filePath);
        } else if (node?.fileType === 'FILE') {
            terminalRef.current?.writeFile(node.filePath, '');
        }
        return node;
    }, [createNode]);

    const handleRename = useCallback(async (id, newName) => {
        const node = nodes.find(n => n.id === id);
        const updated = await renameNode(id, newName);
        if (node) {
            syncTabsAfterEvent(node.filePath, updated.filePath);
            terminalRef.current?.renameFile(node.filePath, updated.filePath);
        }
        return updated;
    }, [nodes, renameNode, syncTabsAfterEvent]);

    const handleDelete = useCallback(async (id) => {
        const node = nodes.find(n => n.id === id);
        await deleteNode(id);
        if (node) {
            syncTabsAfterEvent(node.filePath, null);
            terminalRef.current?.removeFile(node.filePath);
        }
    }, [nodes, deleteNode, syncTabsAfterEvent]);

    // ── Backend multi-language runner ────────────────────────────────────────
    const runner = useBackendRunner(terminalRef);

    // ── Run code ──────────────────────────────────────────────────────────────

    const handleRunCode = async () => {
        if (!activeFile) {
            alert('No file selected. Open a file first.');
            return;
        }
        if (!editorRef.current) {
            alert('Editor not ready.');
            return;
        }

        const content = editorRef.current.getValue();
        const result = await runner.execute(activeFile, content);

        if (!result.success) {
            console.error('Execution failed:', result.error);
        }
    };

    return (
        <div style={st.container}>
            {/* ── Navbar ── */}
            <nav style={st.navbar}>
                <button id="back-to-dashboard" onClick={() => navigate('/dashboard')} style={st.backButton}>
                    ← Dashboard
                </button>
                <div style={st.roomInfo}>
                    <span style={st.roomIcon}>⬡</span>
                    <span style={st.roomLabel}>Room</span>
                    <code style={st.roomId}>{roomId}</code>
                </div>
                <div style={st.navActions}>
                    <button
                        id="share-room-btn"
                        onClick={() => { navigator.clipboard.writeText(roomId); alert('Room ID copied!'); }}
                        style={st.shareButton}
                    >
                        Share Room
                    </button>
                    <div style={connected ? st.statusOnline : st.statusOffline}>
                        <span style={st.statusDot} />
                        {connected ? 'Live' : 'Connecting…'}
                    </div>
                </div>
            </nav>

            {/* ── IDE Layout ── */}
            <div style={st.ideContainer}>
                {/* Sidebar */}
                <FileTree
                    tree={tree}
                    selectedFile={activeFile}
                    onSelectFile={openFile}
                    onCreate={handleCreate}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMove={moveNode}
                    roomId={roomId}
                />

                {/* Main area */}
                <div style={st.mainArea}>
                    {/* Tab bar */}
                    <TabBar
                        tabs={openTabs}
                        activeTab={activeFile}
                        dirtyTabs={dirtyTabs}
                        onSelect={setActiveFile}
                        onClose={closeTab}
                    />

                    {/* Toolbar */}
                    <div style={st.toolbar}>
                        <div style={st.currentPath}>
                            {activeFile || 'No file selected'}
                        </div>
                        <button
                            id="run-code-btn"
                            onClick={handleRunCode}
                            style={st.runButton}
                            disabled={!activeFile}
                        >
                            ▶ Run
                        </button>
                    </div>

                    {/* Editor */}
                    <div style={st.editorWrapper}>
                        {activeFile ? (
                            <Editor
                                ref={editorRef}
                                roomId={roomId}
                                filePath={activeFile}
                                onConnectionChange={setConnected}
                            />
                        ) : (
                            <div style={st.noFile}>
                                <div style={st.noFileIcon}>⬡</div>
                                <div>Select or create a file to start coding</div>
                            </div>
                        )}
                    </div>

                    {/* Terminal */}
                    <TerminalPanel ref={terminalRef} files={fileNodes} />
                </div>
            </div>
        </div>
    );
};

const st = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: '"Inter", -apple-system, sans-serif',
        overflow: 'hidden',
    },
    navbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        height: '48px',
        backgroundColor: '#252526',
        borderBottom: '1px solid #3c3c3c',
        flexShrink: 0,
        gap: '1rem',
    },
    backButton: {
        padding: '6px 14px',
        borderRadius: '6px',
        border: '1px solid #3c3c3c',
        backgroundColor: 'transparent',
        color: '#9cdcfe',
        cursor: 'pointer',
        fontSize: '13px',
        fontFamily: 'inherit',
    },
    roomInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
    },
    roomIcon: { fontSize: '18px', color: '#569cd6' },
    roomLabel: { color: '#858585', fontWeight: 500 },
    roomId: {
        backgroundColor: '#2d2d2d',
        border: '1px solid #3c3c3c',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '12px',
        color: '#9cdcfe',
        letterSpacing: '0.5px',
    },
    navActions: { display: 'flex', alignItems: 'center', gap: '12px' },
    shareButton: {
        padding: '5px 12px',
        borderRadius: '6px',
        border: '1px solid #3c3c3c',
        backgroundColor: '#3c3c3c',
        color: '#e1e4e8',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'inherit',
    },
    statusOnline: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4ec994', fontWeight: 500 },
    statusOffline: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#858585', fontWeight: 500 },
    statusDot: { width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' },
    ideContainer: { display: 'flex', flex: 1, overflow: 'hidden' },
    mainArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    toolbar: {
        height: '35px',
        backgroundColor: '#1e1e1e',
        borderBottom: '1px solid #3c3c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        flexShrink: 0,
    },
    currentPath: { fontSize: '12px', color: '#858585', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    runButton: {
        padding: '4px 14px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#4ec9b0',
        color: '#1e1e1e',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        flexShrink: 0,
    },
    editorWrapper: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    noFile: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: '#555',
        fontSize: '14px',
    },
    noFileIcon: { fontSize: '48px', color: '#2a2a2e' },

    // Access control dialogs
    loadingPage: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
    },
    loadingBox: {
        padding: '2rem',
        fontSize: '16px',
        color: '#858585',
    },
    errorBox: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem 3rem',
        backgroundColor: '#252526',
        borderRadius: '8px',
        border: '1px solid #3c3c3c',
    },
    buttonRow: {
        display: 'flex',
        gap: '1rem',
        marginTop: '1rem',
    },
    primaryBtn: {
        padding: '10px 24px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: '#4ec9b0',
        color: '#1e1e1e',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        ':disabled': { opacity: 0.6, cursor: 'not-allowed' },
    },
    secondaryBtn: {
        padding: '10px 24px',
        borderRadius: '6px',
        border: '1px solid #3c3c3c',
        backgroundColor: 'transparent',
        color: '#9cdcfe',
        fontSize: '14px',
        cursor: 'pointer',
    },
};

export default Room;
