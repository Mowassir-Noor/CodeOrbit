import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';
import FileTree from '../components/FileTree';
import TerminalPanel from '../components/TerminalPanel';
import { projectFileService } from '../services/api';

const Room = () => {
    const { roomId }  = useParams();
    const navigate    = useNavigate();
    const terminalRef = useRef(null);
    const editorRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    React.useEffect(() => {
        if (!roomId) return;
        projectFileService.getFiles(roomId).then(res => {
            setFiles(res.data);
            if (res.data.length > 0) {
                setSelectedFile(res.data[0].filePath);
            }
        }).catch(err => console.error("Failed to fetch files", err));
    }, [roomId]);

    const handleCreateFile = async (filePath) => {
        if (files.find(f => f.filePath === filePath)) return;
        await projectFileService.saveFile(roomId, filePath, '');
        const newFiles = [...files, { filePath, content: '' }];
        setFiles(newFiles);
        setSelectedFile(filePath);
    };

    const handleDeleteFile = async (filePath) => {
        await projectFileService.deleteFile(roomId, filePath);
        const newFiles = files.filter(f => f.filePath !== filePath);
        setFiles(newFiles);
        if (selectedFile === filePath) {
            setSelectedFile(newFiles.length > 0 ? newFiles[0].filePath : null);
        }
    };
    
    const handleRunCode = async () => {
        if (!selectedFile || !terminalRef.current || !editorRef.current) return;
        
        // 1. Get latest content from editor
        const content = editorRef.current.getValue();
        
        // 2. Write to WebContainer via terminalRef
        await terminalRef.current.writeFile(selectedFile, content);
        
        // 3. Trigger execution
        const ext = selectedFile.split('.').pop();
        if (ext === 'js') {
            terminalRef.current.runCommand(`node ${selectedFile}`);
        } else if (ext === 'py') {
            terminalRef.current.runCommand(`python3 ${selectedFile}`);
        } else {
            terminalRef.current.runCommand(`./${selectedFile}`);
        }
    };

    return (
        <div style={styles.container}>
            {/* ── Navbar ── */}
            <nav style={styles.navbar}>
                <button
                    id="back-to-dashboard"
                    onClick={() => navigate('/dashboard')}
                    style={styles.backButton}
                >
                    ← Dashboard
                </button>

                <div style={styles.roomInfo}>
                    <span style={styles.roomIcon}>⬡</span>
                    <span style={styles.roomLabel}>Room</span>
                    <code style={styles.roomId}>{roomId}</code>
                </div>

                <div style={styles.navActions}>
                    <button
                        id="share-room-btn"
                        onClick={() => {
                            navigator.clipboard.writeText(roomId);
                            alert('Room ID copied to clipboard!');
                        }}
                        style={styles.shareButton}
                    >
                        Share Room
                    </button>
                    <div style={connected ? styles.statusOnline : styles.statusOffline}>
                        <span style={styles.statusDot} />
                        {connected ? 'Live' : 'Connecting…'}
                    </div>
                </div>
            </nav>

            {/* ── IDE Layout ── */}
            <div style={styles.ideContainer}>
                <FileTree 
                    files={files}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                />
                <div style={styles.mainArea}>
                    <div style={styles.toolbar}>
                        <div style={styles.fileName}>
                            {selectedFile || 'No file selected'}
                        </div>
                        <div style={styles.actions}>
                            <button
                                id="run-code-btn"
                                onClick={handleRunCode}
                                style={styles.runButton}
                                disabled={!selectedFile}
                            >
                                ▶ Run
                            </button>
                        </div>
                    </div>
                    <div style={styles.editorWrapper}>
                        {selectedFile ? (
                            <Editor
                                ref={editorRef}
                                roomId={roomId}
                                filePath={selectedFile}
                                onConnectionChange={setConnected}
                            />
                        ) : (
                            <div style={styles.noFileSelected}>Select or create a file to start coding.</div>
                        )}
                    </div>
                    <TerminalPanel ref={terminalRef} files={files} />
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = {
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
        transition: 'background 0.15s',
    },
    roomInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
    },
    roomIcon: {
        fontSize: '18px',
        color: '#569cd6',
    },
    roomLabel: {
        color: '#858585',
        fontWeight: 500,
    },
    roomId: {
        backgroundColor: '#2d2d2d',
        border: '1px solid #3c3c3c',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '12px',
        color: '#9cdcfe',
        letterSpacing: '0.5px',
    },
    statusOnline: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: '#4ec994',
        fontWeight: 500,
    },
    statusOffline: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: '#858585',
        fontWeight: 500,
    },
    statusDot: {
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        display: 'inline-block',
    },
    ideContainer: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
    },
    mainArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    editorWrapper: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    navActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    shareButton: {
        padding: '5px 12px',
        borderRadius: '6px',
        border: '1px solid #3c3c3c',
        backgroundColor: '#3c3c3c',
        color: '#e1e4e8',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
    },
    toolbar: {
        height: '35px',
        backgroundColor: '#252526',
        borderBottom: '1px solid #3c3c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
    },
    fileName: {
        fontSize: '12px',
        color: '#9cdcfe',
        fontFamily: 'monospace',
    },
    runButton: {
        padding: '4px 12px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#4ec9b0',
        color: '#1e1e1e',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    noFileSelected: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#858585',
        fontSize: '14px',
    }
};

export default Room;
