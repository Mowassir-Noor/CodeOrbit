import React, { useEffect, useRef, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { projectFileService } from '../services/api';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const WS_URL        = 'http://localhost:8080/ws';
const TOPIC_PREFIX  = '/topic/code/';
const SEND_DEST     = '/app/code.send';
const DEBOUNCE_MS   = 350;

// ─────────────────────────────────────────────
// Editor Component
// ─────────────────────────────────────────────
const Editor = React.forwardRef(({ roomId, filePath, onConnectionChange }, ref) => {
    // Refs — no re-renders for internal state that doesn't affect JSX
    const editorRef      = useRef(null);   // Monaco editor instance
    const monacoRef      = useRef(null);   // Monaco API reference
    const stompRef       = useRef(null);   // STOMP client instance
    const isRemoteRef    = useRef(false);  // Guard: true while applying remote update
    const debounceTimer  = useRef(null);   // Debounce timer for outgoing sends
    const subscriptionRef = useRef(null);  // STOMP subscription handle

    React.useImperativeHandle(ref, () => ({
        getValue: () => editorRef.current?.getValue() || ''
    }));

    // ─── 1. Load Initial File Content ──────────────────────────────────
    useEffect(() => {
        if (!roomId || !filePath) {
            applyRemoteContent(''); // clear
            return;
        }

        projectFileService.getFiles(roomId)
            .then(res => {
                const files = res.data;
                const file = files.find(f => f.filePath === filePath);
                const content = file && typeof file.content === 'string' ? file.content : '';
                if (editorRef.current) {
                    applyRemoteContent(content);
                } else {
                    pendingContentRef.current = content;
                }
            })
            .catch(err => {
                console.error('[Editor] Failed to load initial file:', err);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, filePath]);

    // Holds content that arrived before editor was ready
    const pendingContentRef = useRef(null);

    // ─── 2. WebSocket / STOMP Connection ───────────────────────────────
    useEffect(() => {
        if (!roomId) return;

        const token = localStorage.getItem('token');

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            reconnectDelay: 5000,

            onConnect: () => {
                console.log('[Editor] WebSocket connected');
                onConnectionChange?.(true);

                // Subscribe to the room's topic
                subscriptionRef.current = client.subscribe(
                    `${TOPIC_PREFIX}${roomId}`,
                    handleIncomingMessage
                );
            },

            onDisconnect: () => {
                console.log('[Editor] WebSocket disconnected');
                onConnectionChange?.(false);
            },

            onStompError: (frame) => {
                console.error('[Editor] STOMP error:', frame.headers?.message);
                onConnectionChange?.(false);
            },

            onWebSocketError: (evt) => {
                console.error('[Editor] WebSocket error:', evt);
                onConnectionChange?.(false);
            },
        });

        client.activate();
        stompRef.current = client;

        // ── Cleanup on roomId change or unmount ──
        return () => {
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

    // ─── 3. Incoming Message Handler ───────────────────────────────────
    const handleIncomingMessage = useCallback((frame) => {
        try {
            const data    = JSON.parse(frame.body);
            if (data.filePath === filePathRef.current) {
                const content = typeof data.content === 'string' ? data.content : '';
                applyRemoteContent(content);
            }
        } catch (err) {
            console.error('[Editor] Failed to parse incoming message:', err);
        }
    }, []);

    // We need a ref for filePath to use in handleIncomingMessage without re-subscribing
    const filePathRef = useRef(filePath);
    useEffect(() => {
        filePathRef.current = filePath;
    }, [filePath]);

    // ─── 4. Apply Remote Content (cursor-preserving) ───────────────────
    const applyRemoteContent = (content) => {
        const editor = editorRef.current;
        if (!editor) {
            // Cache it — will be applied once the editor mounts
            pendingContentRef.current = content;
            return;
        }

        const model = editor.getModel();
        if (!model) return;

        // Skip if content is identical (avoid unnecessary cursor jumps)
        if (model.getValue() === content) return;

        // Save cursor + selections
        const savedSelections  = editor.getSelections();
        const savedScrollTop   = editor.getScrollTop();
        const savedScrollLeft  = editor.getScrollLeft();

        // Guard: mark as remote so onChange won't echo it back
        isRemoteRef.current = true;

        // Use pushEditOperations for undo-stack-friendly replacement
        model.pushEditOperations(
            savedSelections,
            [{ range: model.getFullModelRange(), text: content }],
            () => savedSelections
        );

        isRemoteRef.current = false;

        // Restore scroll position (cursor restoration is best-effort)
        editor.setScrollTop(savedScrollTop);
        editor.setScrollLeft(savedScrollLeft);
    };

    // ─── 5. Editor Mount Callback ───────────────────────────────────────
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current  = editor;
        monacoRef.current  = monaco;

        // Apply any content that arrived before the editor was ready
        if (pendingContentRef.current !== null) {
            applyRemoteContent(pendingContentRef.current);
            pendingContentRef.current = null;
        }
    };

    // ─── 6. Outgoing Change Handler (debounced) ─────────────────────────
    const handleEditorChange = useCallback((value) => {
        // Skip — this change was applied by us from a remote update
        if (isRemoteRef.current) return;

        // Clear any pending debounce timer
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            const client = stompRef.current;
            if (!client?.active || !client?.connected) return;

            client.publish({
                destination: SEND_DEST,
                body: JSON.stringify({ roomId, filePath: filePathRef.current, content: value ?? '' }),
            });
        }, DEBOUNCE_MS);
    }, [roomId]);

    // ─── 7. Cleanup debounce timer on unmount ────────────────────────────
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (editorRef.current) {
                // Dispose Monaco editor to free memory
                editorRef.current.dispose();
                editorRef.current = null;
            }
        };
    }, []);

    // ─────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────
    return (
        <MonacoEditor
            height="100%"
            width="100%"
            path={filePath} // setting path helps Monaco identify the model/language
            theme="vs-dark"
            onMount={handleEditorDidMount}
            onChange={handleEditorChange}
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
});

export default Editor;
