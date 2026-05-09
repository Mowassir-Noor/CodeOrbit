import { useState, useEffect, useCallback, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { projectFileService } from '../services/api';

const WS_URL = 'http://localhost:8080/ws';

/**
 * Builds a client-side tree from a flat array of ProjectFile nodes.
 * Returns { rootNodes, nodeMap }
 * rootNodes: array of nodes with no parentId, each having .children[]
 * nodeMap: Map<id, node>
 */
export function buildTree(flatNodes) {
    const nodeMap = new Map();
    flatNodes.forEach(n => nodeMap.set(n.id, { ...n, children: [] }));

    const rootNodes = [];
    nodeMap.forEach(node => {
        if (node.parentId == null) {
            rootNodes.push(node);
        } else {
            const parent = nodeMap.get(node.parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                rootNodes.push(node);
            }
        }
    });

    const sortNodes = (nodes) => {
        nodes.sort((a, b) => {
            if (a.fileType !== b.fileType) {
                return a.fileType === 'DIRECTORY' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(rootNodes);

    return { rootNodes, nodeMap };
}

/**
 * Central filesystem hook.
 * Manages flat node list, tree structure, WebSocket FS events, and all mutations.
 */
export function useFileSystem(roomId) {
    const [nodes, setNodes] = useState([]);          // flat list from server
    const [tree, setTree]   = useState({ rootNodes: [], nodeMap: new Map() });
    const [loading, setLoading] = useState(true);
    const stompRef = useRef(null);
    const subRef   = useRef(null);

    // Rebuild tree whenever flat list changes
    useEffect(() => {
        setTree(buildTree(nodes));
    }, [nodes]);

    // Load initial file list
    useEffect(() => {
        if (!roomId) return;
        setLoading(true);
        projectFileService.getFiles(roomId)
            .then(res => setNodes(res.data))
            .catch(err => console.error('[FS] Failed to load files:', err))
            .finally(() => setLoading(false));
    }, [roomId]);

    // Subscribe to FS WebSocket events
    useEffect(() => {
        if (!roomId) return;
        const token = localStorage.getItem('token');

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            reconnectDelay: 5000,
            onConnect: () => {
                subRef.current = client.subscribe(`/topic/fs/${roomId}`, (frame) => {
                    try {
                        const event = JSON.parse(frame.body);
                        handleFsEvent(event);
                    } catch (e) {
                        console.error('[FS] Event parse error:', e);
                    }
                });
            },
        });

        client.activate();
        stompRef.current = client;

        return () => {
            subRef.current?.unsubscribe();
            if (stompRef.current?.active) stompRef.current.deactivate();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const handleFsEvent = useCallback((event) => {
        const { eventType, id, oldPath, newPath, name, parentId, fileType, content } = event;

        setNodes(prev => {
            switch (eventType) {
                case 'FILE_CREATED':
                case 'FOLDER_CREATED':
                    if (prev.some(n => n.id === id)) return prev;
                    return [...prev, { id, filePath: newPath, name, parentId, fileType, content: content ?? '', lastUpdated: null }];

                case 'FILE_RENAMED':
                case 'FOLDER_RENAMED':
                    return prev.map(n => {
                        if (n.id === id) return { ...n, name, filePath: newPath };
                        if (n.filePath.startsWith(oldPath + '/')) {
                            return { ...n, filePath: n.filePath.replace(oldPath, newPath) };
                        }
                        return n;
                    });

                case 'FILE_DELETED':
                case 'FOLDER_DELETED':
                    return prev.filter(n => n.id !== id && !n.filePath.startsWith(oldPath + '/'));

                case 'FILE_MOVED':
                case 'FOLDER_MOVED':
                    return prev.map(n => {
                        if (n.id === id) return { ...n, parentId, filePath: newPath };
                        if (n.filePath.startsWith(oldPath + '/')) {
                            return { ...n, filePath: n.filePath.replace(oldPath, newPath) };
                        }
                        return n;
                    });

                default:
                    return prev;
            }
        });
    }, []);

    // ─── Mutations ────────────────────────────────────────────────────────────

    const createNode = useCallback(async (roomId, { name, fileType, parentId }) => {
        const res = await projectFileService.createNode(roomId, { name, fileType, parentId });
        const node = res.data;
        setNodes(prev => prev.some(n => n.id === node.id) ? prev : [...prev, node]);
        return node;
    }, []);

    const renameNode = useCallback(async (id, newName) => {
        const res = await projectFileService.renameNode(id, newName);
        const updated = res.data;
        setNodes(prev => prev.map(n => {
            if (n.id === updated.id) return updated;
            if (n.filePath.startsWith(updated.filePath.replace(new RegExp(`${newName}$`), '') + '/')) {
                return n;
            }
            return n;
        }));
        return updated;
    }, []);

    const moveNode = useCallback(async (id, targetParentId) => {
        const res = await projectFileService.moveNode(id, targetParentId);
        const updated = res.data;
        setNodes(prev => prev.map(n => n.id === updated.id ? { ...n, parentId: updated.parentId, filePath: updated.filePath } : n));
        return updated;
    }, []);

    const deleteNode = useCallback(async (id) => {
        const node = nodes.find(n => n.id === id);
        if (!node) return;
        await projectFileService.deleteNode(id);
        setNodes(prev => prev.filter(n =>
            n.id !== id && !n.filePath.startsWith(node.filePath + '/')
        ));
    }, [nodes]);

    const updateNodeContent = useCallback((filePath, content) => {
        setNodes(prev => prev.map(n => n.filePath === filePath ? { ...n, content } : n));
    }, []);

    return {
        nodes,
        tree,
        loading,
        createNode,
        renameNode,
        moveNode,
        deleteNode,
        updateNodeContent,
    };
}
