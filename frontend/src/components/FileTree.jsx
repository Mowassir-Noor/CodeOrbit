import React, { useState } from 'react';

const FileTree = ({ files, selectedFile, onSelectFile, onCreateFile, onDeleteFile }) => {
    const [newFileName, setNewFileName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = (e) => {
        if (e.key === 'Enter' && newFileName.trim()) {
            onCreateFile(newFileName.trim());
            setNewFileName('');
            setIsCreating(false);
        } else if (e.key === 'Escape') {
            setIsCreating(false);
            setNewFileName('');
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <span style={styles.title}>EXPLORER</span>
                <button style={styles.iconButton} onClick={() => setIsCreating(true)} title="New File">
                    +
                </button>
            </div>
            <div style={styles.fileList}>
                {files.map(f => (
                    <div 
                        key={f.filePath} 
                        style={{
                            ...styles.fileItem,
                            ...(selectedFile === f.filePath ? styles.fileItemSelected : {})
                        }}
                    >
                        <span 
                            style={styles.fileName} 
                            onClick={() => onSelectFile(f.filePath)}
                        >
                            📄 {f.filePath}
                        </span>
                        <button 
                            style={styles.deleteButton} 
                            onClick={(e) => { e.stopPropagation(); onDeleteFile(f.filePath); }}
                            title="Delete"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {isCreating && (
                    <div style={styles.newFileInputContainer}>
                        <span>📄</span>
                        <input
                            autoFocus
                            style={styles.newFileInput}
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            onKeyDown={handleCreate}
                            onBlur={() => setIsCreating(false)}
                            placeholder="Filename..."
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        width: '250px',
        backgroundColor: '#252526',
        borderRight: '1px solid #3c3c3c',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 15px',
        textTransform: 'uppercase',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#cccccc',
    },
    title: {
        letterSpacing: '0.5px',
    },
    iconButton: {
        background: 'none',
        border: 'none',
        color: '#cccccc',
        cursor: 'pointer',
        fontSize: '16px',
        lineHeight: '1',
    },
    fileList: {
        display: 'flex',
        flexDirection: 'column',
        padding: '5px 0',
        overflowY: 'auto',
    },
    fileItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 15px',
        cursor: 'pointer',
        color: '#cccccc',
        fontSize: '13px',
    },
    fileItemSelected: {
        backgroundColor: '#37373d',
        color: '#ffffff',
    },
    fileName: {
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    deleteButton: {
        background: 'none',
        border: 'none',
        color: '#858585',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '0 4px',
    },
    newFileInputContainer: {
        display: 'flex',
        alignItems: 'center',
        padding: '4px 15px',
        gap: '6px',
    },
    newFileInput: {
        flex: 1,
        background: '#3c3c3c',
        border: '1px solid #007fd4',
        color: '#fff',
        outline: 'none',
        padding: '2px 4px',
        fontSize: '13px',
    }
};

export default FileTree;
