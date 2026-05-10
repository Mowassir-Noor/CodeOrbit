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
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-transparent text-white">
                <div className="glass-panel p-8 flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-gray-400">Checking access...</span>
                </div>
            </div>
        );
    }

    if (accessState === 'notfound') {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-transparent">
                <div className="glass-panel p-8 max-w-md w-full text-center space-y-4">
                    <h3 className="text-xl font-semibold text-white">Room Not Found</h3>
                    <p className="text-gray-400 text-sm">This room does not exist or has been removed.</p>
                    <button onClick={() => window.location.href = '/dashboard'} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium w-full shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (accessState === 'denied') {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-transparent">
                <div className="glass-panel p-8 max-w-md w-full text-center space-y-6">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-white">Join Room</h3>
                        <p className="text-gray-400 text-sm mt-2">You are not a member of this workspace yet.</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => window.location.href = '/dashboard'} className="flex-1 px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg transition-colors text-sm font-medium">
                            Cancel
                        </button>
                        <button onClick={handleJoinRoom} disabled={joining} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm font-medium shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] disabled:opacity-50">
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

    // Stable dirty-tracking callback for Editor (avoids re-renders via React.memo)
    const handleDirtyChange = useCallback((filePath, isDirty) => {
        setDirtyTabs(prev => {
            const next = new Set(prev);
            if (isDirty) next.add(filePath);
            else next.delete(filePath);
            return next;
        });
    }, []);

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
        <div className="flex flex-col h-[calc(100vh-4rem)] text-gray-300 font-sans overflow-hidden">
            {/* ── Room Info Bar ── */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 backdrop-blur-md shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <button id="back-to-dashboard" onClick={() => window.location.href = '/dashboard'} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    <div className="h-4 w-px bg-white/10"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-blue-500 font-bold">⬡</span>
                        <span className="text-sm font-medium text-gray-200">Workspace</span>
                        <code className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs tracking-wide">
                            {roomId}
                        </code>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 text-xs font-medium ${connected ? 'text-green-400' : 'text-yellow-400'}`}>
                        <span className="relative flex h-2 w-2">
                            {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        </span>
                        {connected ? 'Live Sync' : 'Connecting...'}
                    </div>
                    <button
                        id="share-room-btn"
                        onClick={() => { navigator.clipboard.writeText(roomId); alert('Room ID copied!'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 hover:text-white transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        Share
                    </button>
                </div>
            </div>

            {/* ── IDE Layout ── */}
            <div className="flex flex-1 overflow-hidden p-2 gap-2 bg-black/20">
                {/* Sidebar */}
                <div className="w-64 flex flex-col shrink-0 glass-panel overflow-hidden border border-white/5 shadow-2xl rounded-xl">
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
                </div>

                {/* Main area */}
                <div className="flex-1 flex flex-col min-w-0 gap-2">
                    
                    {/* Editor Panel */}
                    <div className="flex-1 glass-panel flex flex-col overflow-hidden border border-white/5 shadow-2xl rounded-xl">
                        {/* Tab bar */}
                        <div className="border-b border-white/5 bg-black/40 shrink-0">
                            <TabBar
                                tabs={openTabs}
                                activeTab={activeFile}
                                dirtyTabs={dirtyTabs}
                                onSelect={setActiveFile}
                                onClose={closeTab}
                            />
                        </div>

                        {/* Toolbar */}
                        <div className="h-10 border-b border-white/5 bg-black/20 flex items-center justify-between px-3 shrink-0">
                            <div className="text-xs text-gray-500 font-mono flex items-center gap-2 truncate">
                                {activeFile ? (
                                    <>
                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                        {activeFile}
                                    </>
                                ) : 'No file selected'}
                            </div>
                            <button
                                id="run-code-btn"
                                onClick={handleRunCode}
                                disabled={!activeFile}
                                className="flex items-center gap-1.5 px-3 py-1 rounded bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black text-xs font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                            >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                                RUN
                            </button>
                        </div>

                        {/* Editor — always mounted so model cache survives tab switches */}
                        <div className="flex-1 overflow-hidden flex flex-col relative bg-[#1e1e1e]/80">
                            <Editor
                                ref={editorRef}
                                roomId={roomId}
                                filePath={activeFile || ''}
                                onConnectionChange={setConnected}
                                onDirtyChange={handleDirtyChange}
                            />
                            {!activeFile && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-500 bg-[#1e1e1e]/80 z-10">
                                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                                        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                                    </div>
                                    <div className="text-sm">Select or create a file to start coding</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Terminal Panel */}
                    <div className="h-64 glass-panel border border-white/5 shadow-2xl rounded-xl overflow-hidden shrink-0">
                        <TerminalPanel ref={terminalRef} files={fileNodes} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Room;
