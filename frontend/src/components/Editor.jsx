import React, { useEffect, useRef, useCallback, useImperativeHandle, memo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { projectFileService } from '../services/api';
import { StompYjsProvider } from '../yjs/StompProvider';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const WS_URL         = `${window.location.protocol}//${window.location.host}/ws`;
const TOPIC_PREFIX   = '/topic/code/';
const FULL_SYNC_INTERVAL_MS = 5000; // Periodic Yjs state snapshot to DB
const STABLE_PATH    = 'codeorbit-editor'; // Prevents @monaco-editor/react model recreation

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
// Editor — Yjs CRDT Collaborative Monaco
// ─────────────────────────────────────────────
const Editor = memo(React.forwardRef(({ roomId, filePath, onConnectionChange, onDirtyChange }, ref) => {
    // ── Refs: all mutable state lives here, zero React re-renders ──
    const editorRef          = useRef(null);   // Monaco editor instance
    const monacoRef          = useRef(null);   // Monaco API
    const modelCacheRef      = useRef(new Map()); // filePath -> ITextModel
    const viewStateCacheRef  = useRef(new Map()); // filePath -> IEditorViewState
    const ydocCacheRef       = useRef(new Map()); // filePath -> Y.Doc
    const bindingCacheRef    = useRef(new Map()); // filePath -> MonacoBinding
    const providerCacheRef   = useRef(new Map()); // filePath -> StompYjsProvider
    const stompRef           = useRef(null);
    const clientIdRef        = useRef(generateClientId());
    const filePathRef        = useRef(filePath);
    const subscriptionRef      = useRef(null);
    const fullSyncTimerRef   = useRef(null);
    const didInitRef         = useRef(false);

    // Sync filePath ref without re-rendering
    useEffect(() => { filePathRef.current = filePath; }, [filePath]);

    // ── Imperative API for parent (Room.jsx) ──
    useImperativeHandle(ref, () => ({
        getValue:   () => editorRef.current?.getValue() || '',
        getModel:   () => editorRef.current?.getModel() || null,
        forceSave:  () => {
            const provider = providerCacheRef.current.get(filePathRef.current);
            if (provider) provider.broadcastFullState();
        },
    }));

    // ── 1. Monaco Editor Mount ──
    const handleEditorDidMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        didInitRef.current = true;
    }, []);

    // ── 2. Model Management ──
    const ensureModel = useCallback((targetFilePath, initialContent = '') => {
        const monaco = monacoRef.current;
        if (!monaco) return null;

        let model = modelCacheRef.current.get(targetFilePath);
        if (model && !model.isDisposed()) {
            return model;
        }

        const uri = monaco.Uri.parse(`file://${targetFilePath}`);
        const language = getLanguageId(targetFilePath);
        model = monaco.editor.createModel(initialContent, language, uri);
        modelCacheRef.current.set(targetFilePath, model);
        return model;
    }, []);

    // ── 3. Yjs Document Management ──
    const ensureYjsDoc = useCallback((targetFilePath) => {
        let ydoc = ydocCacheRef.current.get(targetFilePath);
        if (ydoc && !ydoc.destroyed) {
            return ydoc;
        }
        ydoc = new Y.Doc();
        ydocCacheRef.current.set(targetFilePath, ydoc);
        return ydoc;
    }, []);

    const destroyYjsForFile = useCallback((targetFilePath) => {
        const binding = bindingCacheRef.current.get(targetFilePath);
        if (binding) {
            binding.destroy();
            bindingCacheRef.current.delete(targetFilePath);
        }
        const provider = providerCacheRef.current.get(targetFilePath);
        if (provider) {
            provider.destroy();
            providerCacheRef.current.delete(targetFilePath);
        }
        const ydoc = ydocCacheRef.current.get(targetFilePath);
        if (ydoc) {
            ydoc.destroy();
            ydocCacheRef.current.delete(targetFilePath);
        }
    }, []);

    // ── 4. File Switching ──
    const switchToFile = useCallback((targetFilePath) => {
        const editor = editorRef.current;
        if (!editor || !targetFilePath) return;

        const currentModel = editor.getModel();
        const currentPath = currentModel?.uri?.path?.slice(1);
        if (currentPath === targetFilePath) return;

        // Save view state of current file
        if (currentPath) {
            const vs = editor.saveViewState();
            if (vs) viewStateCacheRef.current.set(currentPath, vs);
        }

        // Ensure model exists
        let model = modelCacheRef.current.get(targetFilePath);
        if (!model || model.isDisposed()) {
            model = ensureModel(targetFilePath);
        }

        editor.setModel(model);

        // Restore view state
        const cachedVs = viewStateCacheRef.current.get(targetFilePath);
        if (cachedVs) editor.restoreViewState(cachedVs);

        editor.focus();
    }, [ensureModel]);

    // ── 5. Load File + Init Yjs ──
    useEffect(() => {
        if (!roomId || !filePath) return;

        const init = async () => {
            // Switch Monaco model first
            switchToFile(filePath);

            const model = modelCacheRef.current.get(filePath);
            if (!model) return;

            // If we already have a Yjs doc for this file, just ensure binding exists
            const existingYdoc = ydocCacheRef.current.get(filePath);
            if (existingYdoc && !existingYdoc.destroyed) {
                const existingBinding = bindingCacheRef.current.get(filePath);
                if (!existingBinding || existingBinding.destroyed) {
                    const editor = editorRef.current;
                    if (editor) {
                        const ytext = existingYdoc.getText('monaco');
                        const binding = new MonacoBinding(
                            ytext, model, new Set([editor]), null
                        );
                        bindingCacheRef.current.set(filePath, binding);
                    }
                }
                return;
            }

            // Create fresh Yjs doc
            const ydoc = ensureYjsDoc(filePath);
            const ytext = ydoc.getText('monaco');

            // Try loading Yjs state from DB first (canonical CRDT state)
            let loadedFromYjs = false;
            try {
                const res = await projectFileService.getYjsState(roomId, filePath);
                const base64 = res.data;
                if (base64 && base64.length > 0) {
                    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                    Y.applyUpdate(ydoc, binary);
                    loadedFromYjs = true;
                }
            } catch (e) {
                // yjsState not available — fall through to plain text
            }

            // Fallback: load plain text from API and insert into Y.Doc
            if (!loadedFromYjs) {
                try {
                    const res = await projectFileService.getFiles(roomId);
                    const files = res.data;
                    const file = files.find(f => f.filePath === filePath);
                    const content = file && typeof file.content === 'string' ? file.content : '';
                    if (ytext.toString() === '') {
                        ytext.insert(0, content);
                    }
                } catch (e) {
                    console.error('[Editor] Failed to load file:', e);
                }
            }

            // Create MonacoBinding (connects Y.Text <-> Monaco model)
            const editor = editorRef.current;
            if (editor) {
                const binding = new MonacoBinding(
                    ytext, model, new Set([editor]), null
                );
                bindingCacheRef.current.set(filePath, binding);
            }

            // Create STOMP provider for this file (skip if already exists)
            const stomp = stompRef.current;
            if (stomp?.active && stomp?.connected && !providerCacheRef.current.has(filePath)) {
                console.log('[Editor] Creating provider for', filePath);
                const provider = new StompYjsProvider(
                    ydoc, stomp, roomId, filePath, clientIdRef.current
                );
                providerCacheRef.current.set(filePath, provider);

                // Request state from peers (in case they have newer edits)
                provider.requestState();

                // Mark clean after initial load
                onDirtyChange?.(filePath, false);
            } else if (!stomp?.connected) {
                console.log('[Editor] STOMP not connected yet, provider deferred for', filePath);
            }
        };

        init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, filePath]);

    // ── 6. Periodic Full Yjs State Sync (auto-save to DB) ──
    useEffect(() => {
        if (!roomId || !filePath) return;

        fullSyncTimerRef.current = setInterval(() => {
            const provider = providerCacheRef.current.get(filePath);
            if (provider) {
                provider.broadcastFullState();
            }
        }, FULL_SYNC_INTERVAL_MS);

        return () => {
            if (fullSyncTimerRef.current) {
                clearInterval(fullSyncTimerRef.current);
                fullSyncTimerRef.current = null;
            }
        };
    }, [roomId, filePath]);

    // ── 7. WebSocket / STOMP Connection ──
    useEffect(() => {
        if (!roomId) return;

        const token = localStorage.getItem('token');

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            reconnectDelay: 5000,
            debug: (str) => {
                if (localStorage.getItem('stomp-debug') === '1') console.log('[STOMP]', str);
            },

            onConnect: () => {
                onConnectionChange?.(true);
                console.log('[Editor] STOMP connected, subscribing to', `${TOPIC_PREFIX}${roomId}`);
                subscriptionRef.current = client.subscribe(
                    `${TOPIC_PREFIX}${roomId}`,
                    handleIncomingMessage
                );

                // Create providers for files already opened before STOMP connected
                ydocCacheRef.current.forEach((ydoc, path) => {
                    if (!providerCacheRef.current.has(path)) {
                        console.log('[Editor] Creating deferred provider for', path);
                        const provider = new StompYjsProvider(
                            ydoc, client, roomId, path, clientIdRef.current
                        );
                        providerCacheRef.current.set(path, provider);
                        provider.requestState();
                    }
                });
            },

            onDisconnect: () => {
                onConnectionChange?.(false);
            },

            onStompError: () => {
                onConnectionChange?.(false);
            },

            onWebSocketError: () => {
                onConnectionChange?.(false);
            },
        });

        client.activate();
        stompRef.current = client;

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

    // ── 8. Incoming Message Handler ──
    const handleIncomingMessage = useCallback((frame) => {
        try {
            const msg = JSON.parse(frame.body);
            console.log('[Editor] Received msg type=', msg.type, 'file=', msg.filePath, 'from=', msg.clientId?.slice(0, 8));

            // Filter self-messages (echo prevention)
            if (msg.clientId === clientIdRef.current) {
                console.log('[Editor] Ignoring self-message');
                return;
            }

            // Route to the Yjs provider for this file
            const provider = providerCacheRef.current.get(msg.filePath);
            if (provider) {
                console.log('[Editor] Routing to provider for', msg.filePath);
                provider.onRemoteMessage(msg);
            } else {
                console.warn('[Editor] No provider for file', msg.filePath, '- providers:', [...providerCacheRef.current.keys()]);
            }
        } catch (err) {
            console.error('[Editor] Failed to process incoming message:', err);
        }
    }, []);

    // ── 9. Cleanup on unmount ──
    useEffect(() => {
        return () => {
            if (fullSyncTimerRef.current) clearInterval(fullSyncTimerRef.current);

            // Destroy all Yjs bindings and docs
            bindingCacheRef.current.forEach((b, path) => {
                try { b.destroy(); } catch (e) {}
            });
            bindingCacheRef.current.clear();

            providerCacheRef.current.forEach((p, path) => {
                try { p.destroy(); } catch (e) {}
            });
            providerCacheRef.current.clear();

            ydocCacheRef.current.forEach((d, path) => {
                try { d.destroy(); } catch (e) {}
            });
            ydocCacheRef.current.clear();

            // Dispose all cached models
            modelCacheRef.current.forEach(m => {
                try { m.dispose(); } catch (e) {}
            });
            modelCacheRef.current.clear();
            viewStateCacheRef.current.clear();
        };
    }, []);

    // ── Render ──
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
