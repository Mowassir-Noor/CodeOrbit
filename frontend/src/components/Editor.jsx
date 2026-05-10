import React, { useEffect, useRef, useCallback, useImperativeHandle, memo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { projectFileService } from '../services/api';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const WS_URL         = `${window.location.protocol}//${window.location.host}/ws`;
const TOPIC_PREFIX   = '/topic/code/';
const SEND_DEST      = '/app/code.send';
const OUTGOING_DEBOUNCE_MS = 500;   // Slower debounce = fewer broadcasts, less lag
const FULL_SYNC_INTERVAL_MS = 3000; // Auto-save full content to DB every 3s
const STABLE_PATH    = 'codeorbit-editor'; // Fixed path so @monaco-editor/react never recreates

/** Generate a stable clientId for this session. */
function generateClientId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Derive Monaco language ID from a file path. */
function getLanguageId(filePath) {
    if (!filePath) return 'plaintext';
    const ext = filePath.split('.').pop()?.toLowerCase();
    const map = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        java: 'java', py: 'python', json: 'json', html: 'html', css: 'css',
        scss: 'scss', less: 'less', md: 'markdown', sh: 'shell', bash: 'shell',
        txt: 'plaintext', xml: 'xml', yml: 'yaml', yaml: 'yaml',
        dockerfile: 'dockerfile', rs: 'rust', go: 'go', rb: 'ruby',
        php: 'php', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c',
        vue: 'vue', svelte: 'svelte', sql: 'sql', graphql: 'graphql',
    };
    return map[ext] || 'plaintext';
}

// ─────────────────────────────────────────────
// Editor — High-Performance Collaborative Monaco
// ─────────────────────────────────────────────
const Editor = memo(React.forwardRef(({ roomId, filePath, onConnectionChange, onDirtyChange }, ref) => {
    // ── Refs: all mutable state lives here, zero React re-renders ──
    const editorRef          = useRef(null);   // Monaco editor instance
    const monacoRef          = useRef(null);   // Monaco API
    const modelCacheRef      = useRef(new Map()); // filePath -> ITextModel
    const viewStateCacheRef  = useRef(new Map()); // filePath -> IEditorViewState
    const stompRef           = useRef(null);
    const clientIdRef        = useRef(generateClientId());
    const isApplyingRemoteRef = useRef(false);
    const outgoingQueueRef   = useRef([]);
    const outgoingTimerRef   = useRef(null);
    const fullSyncTimerRef   = useRef(null);
    const filePathRef        = useRef(filePath);
    const subscriptionRef    = useRef(null);
    const changeListenerRef  = useRef(null);
    const didInitRef         = useRef(false);

    // Sync filePath ref without re-rendering
    useEffect(() => { filePathRef.current = filePath; }, [filePath]);

    // ── Imperative API for parent (Room.jsx) ──
    useImperativeHandle(ref, () => ({
        getValue:   () => editorRef.current?.getValue() || '',
        getModel:   () => editorRef.current?.getModel() || null,
        forceSave:  () => sendFullSync(),
    }));

    // ── 1. Monaco Editor Mount ──
    const handleEditorDidMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        didInitRef.current = true;

        // Attach incremental change listener (NOT the library's onChange)
        changeListenerRef.current = editor.onDidChangeModelContent((event) => {
            if (isApplyingRemoteRef.current) return;

            // Mark tab as dirty
            onDirtyChange?.(filePathRef.current, true);

            // Queue outgoing delta changes
            queueOutgoingDelta(event.changes);
        });
    }, [onDirtyChange]);

    // ── 2. Model Management & File Switching ──
    const ensureModel = useCallback((targetFilePath, initialContent = '') => {
        const monaco = monacoRef.current;
        if (!monaco) return null;

        let model = modelCacheRef.current.get(targetFilePath);
        if (model && !model.isDisposed()) {
            return model;
        }

        // Create new model with language detection
        const uri = monaco.Uri.parse(`file://${targetFilePath}`);
        const language = getLanguageId(targetFilePath);
        model = monaco.editor.createModel(initialContent, language, uri);
        modelCacheRef.current.set(targetFilePath, model);
        return model;
    }, []);

    const switchToFile = useCallback((targetFilePath) => {
        const editor = editorRef.current;
        if (!editor || !targetFilePath) return;

        const currentModel = editor.getModel();
        const currentPath = currentModel?.uri?.path?.slice(1); // remove leading /

        // Already on this file
        if (currentPath === targetFilePath) return;

        // Save view state of current file
        if (currentPath) {
            const vs = editor.saveViewState();
            if (vs) viewStateCacheRef.current.set(currentPath, vs);
        }

        // Ensure model exists (create empty if not cached; content loaded via API)
        let model = modelCacheRef.current.get(targetFilePath);
        if (!model || model.isDisposed()) {
            model = ensureModel(targetFilePath);
        }

        // Switch editor to this model
        editor.setModel(model);

        // Restore view state
        const cachedVs = viewStateCacheRef.current.get(targetFilePath);
        if (cachedVs) {
            editor.restoreViewState(cachedVs);
        }

        editor.focus();
    }, [ensureModel]);

    // ── 3. Load Initial Content When filePath Changes ──
    useEffect(() => {
        if (!roomId || !filePath) return;

        // CRITICAL: Clear any pending outgoing deltas for the PREVIOUS file.
        // Otherwise they would be flushed with the new filePath, corrupting the wrong file.
        if (outgoingTimerRef.current) {
            clearTimeout(outgoingTimerRef.current);
            outgoingTimerRef.current = null;
        }
        outgoingQueueRef.current = [];

        // Switch to the model first (creates empty model if needed)
        switchToFile(filePath);

        // If model is empty, load content from API
        const model = modelCacheRef.current.get(filePath);
        if (model && model.getValue() === '') {
            projectFileService.getFiles(roomId)
                .then(res => {
                    const files = res.data;
                    const file = files.find(f => f.filePath === filePath);
                    const content = file && typeof file.content === 'string' ? file.content : '';
                    if (model.getValue() === '') {
                        // MUST guard with isApplyingRemoteRef so setValue doesn't
                        // trigger onDidChangeModelContent → outgoing delta broadcast.
                        isApplyingRemoteRef.current = true;
                        model.setValue(content);
                        isApplyingRemoteRef.current = false;
                        onDirtyChange?.(filePath, false);
                    }
                })
                .catch(err => {
                    console.error('[Editor] Failed to load file content:', err);
                });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, filePath]);

    // ── 4. Outgoing Delta Sync ──
    const queueOutgoingDelta = useCallback((changes) => {
        // Accumulate changes
        outgoingQueueRef.current.push(...changes);

        // Reset debounce timer
        if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);

        outgoingTimerRef.current = setTimeout(() => {
            flushOutgoingDelta();
        }, OUTGOING_DEBOUNCE_MS);
    }, []);

    const flushOutgoingDelta = useCallback(() => {
        outgoingTimerRef.current = null;
        const queue = outgoingQueueRef.current;
        if (queue.length === 0) return;
        outgoingQueueRef.current = [];

        const client = stompRef.current;
        if (!client?.active || !client?.connected) return;

        // Serialize Monaco changes to plain JSON
        const payloadChanges = queue.map(c => ({
            startLineNumber: c.range.startLineNumber,
            startColumn:   c.range.startColumn,
            endLineNumber:   c.range.endLineNumber,
            endColumn:       c.range.endColumn,
            rangeLength:     c.rangeLength,
            text:            c.text,
            rangeOffset:     c.rangeOffset,
        }));

        client.publish({
            destination: SEND_DEST,
            body: JSON.stringify({
                roomId,
                filePath: filePathRef.current,
                clientId: clientIdRef.current,
                type: 'delta',
                changes: payloadChanges,
            }),
        });
    }, [roomId]);

    // ── 5. Periodic Full Sync (auto-save to DB) ──
    const sendFullSync = useCallback(() => {
        const editor = editorRef.current;
        const client = stompRef.current;
        if (!editor || !client?.active || !client?.connected) return;

        const currentPath = filePathRef.current;
        const content = editor.getValue();

        client.publish({
            destination: SEND_DEST,
            body: JSON.stringify({
                roomId,
                filePath: currentPath,
                clientId: clientIdRef.current,
                type: 'full',
                content,
            }),
        });

        onDirtyChange?.(currentPath, false);
    }, [roomId, onDirtyChange]);

    useEffect(() => {
        if (!roomId || !filePath) return;
        fullSyncTimerRef.current = setInterval(() => {
            sendFullSync();
        }, FULL_SYNC_INTERVAL_MS);
        return () => clearInterval(fullSyncTimerRef.current);
    }, [roomId, filePath, sendFullSync]);

    // ── 6. WebSocket / STOMP Connection ──
    useEffect(() => {
        if (!roomId) return;

        const token = localStorage.getItem('token');

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            reconnectDelay: 5000,
            debug: () => {}, // Disable STOMP debug logging in production

            onConnect: () => {
                onConnectionChange?.(true);
                subscriptionRef.current = client.subscribe(
                    `${TOPIC_PREFIX}${roomId}`,
                    handleIncomingMessage
                );
            },

            onDisconnect: () => {
                onConnectionChange?.(false);
            },

            onStompError: (frame) => {
                onConnectionChange?.(false);
            },

            onWebSocketError: () => {
                onConnectionChange?.(false);
            },
        });

        client.activate();
        stompRef.current = client;

        return () => {
            if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
            if (stompRef.current?.active) {
                stompRef.current.deactivate();
            }
            stompRef.current = null;
            onConnectionChange?.(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    // ── 7. Incoming Message Handler ──
    const handleIncomingMessage = useCallback((frame) => {
        try {
            const msg = JSON.parse(frame.body);

            // Filter self-messages (echo prevention)
            if (msg.clientId === clientIdRef.current) return;

            const editor = editorRef.current;
            if (!editor) return;

            const model = editor.getModel();
            if (!model || model.isDisposed()) return;

            // Use the MODEL's URI as the ground-truth current file path.
            // filePathRef can race during rapid tab switches.
            const currentModelPath = model.uri?.path?.slice(1);
            if (msg.filePath !== currentModelPath) return;

            if (msg.type === 'delta' && Array.isArray(msg.changes) && msg.changes.length > 0) {
                applyRemoteDelta(msg.changes, msg.filePath);
            } else if (msg.type === 'full' && typeof msg.content === 'string') {
                applyRemoteFullContent(msg.content);
            }
        } catch (err) {
            console.error('[Editor] Failed to process incoming message:', err);
        }
    }, []);

    // ── 8. Apply Remote Delta (incremental, cursor-safe) ──
    const applyRemoteDelta = useCallback((changes, targetFilePath) => {
        const editor = editorRef.current;
        if (!editor) return;

        // Extra safety: verify we are still on the correct model
        const model = editor.getModel();
        if (!model || model.isDisposed()) return;
        const currentPath = model.uri?.path?.slice(1);
        if (currentPath !== targetFilePath) return;

        isApplyingRemoteRef.current = true;

        const monaco = monacoRef.current;
        const operations = changes.map(c => ({
            range: new monaco.Range(
                c.startLineNumber,
                c.startColumn,
                c.endLineNumber,
                c.endColumn
            ),
            text: c.text,
            forceMoveMarkers: true,
        }));

        editor.executeEdits('remote', operations);

        isApplyingRemoteRef.current = false;
    }, []);

    // ── 9. Apply Remote Full Content (fallback / initial) ──
    const applyRemoteFullContent = useCallback((content) => {
        const editor = editorRef.current;
        if (!editor) return;

        const model = editor.getModel();
        if (!model || model.isDisposed() || model.getValue() === content) return;

        isApplyingRemoteRef.current = true;

        // Use pushEditOperations to preserve undo stack
        const savedSelections = editor.getSelections();
        model.pushEditOperations(
            savedSelections,
            [{ range: model.getFullModelRange(), text: content }],
            () => savedSelections
        );

        isApplyingRemoteRef.current = false;
    }, []);

    // ── 10. Cleanup on unmount ──
    useEffect(() => {
        return () => {
            if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);
            if (fullSyncTimerRef.current) clearInterval(fullSyncTimerRef.current);
            if (changeListenerRef.current) {
                changeListenerRef.current.dispose();
                changeListenerRef.current = null;
            }
            // Dispose all cached models
            modelCacheRef.current.forEach(m => { try { m.dispose(); } catch (e) {} });
            modelCacheRef.current.clear();
            viewStateCacheRef.current.clear();
        };
    }, []);

    // ── Render ──
    // STABLE path prevents @monaco-editor/react from recreating models on file switches.
    // We manage models manually via setModel().
    return (
        <MonacoEditor
            height="100%"
            width="100%"
            path={STABLE_PATH}
            theme="vs-dark"
            defaultValue=""
            onMount={handleEditorDidMount}
            options={{
                fontSize: 14,
                fontFamily: '"Fira Code", "Cascadia Code", Menlo, monospace',
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                renderWhitespace: 'selection',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                padding: { top: 12, bottom: 12 },
                overviewRulerLanes: 0,
                occurrencesHighlight: 'off',
                selectionHighlight: false,
                codeLens: false,
                scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    useShadows: false,
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                },
            }}
        />
    );
}));

export default Editor;
