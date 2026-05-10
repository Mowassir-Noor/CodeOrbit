import * as Y from 'yjs';

// ─────────────────────────────────────────────
// Helpers: Uint8Array <-> base64 for JSON transport over STOMP
// ─────────────────────────────────────────────
function toBase64(bytes) {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// ─────────────────────────────────────────────
// StompYjsProvider — bridges Yjs CRDT over STOMP pub/sub
// ─────────────────────────────────────────────
export class StompYjsProvider {
    /**
     * @param {Y.Doc} ydoc            — the Yjs document for this file
     * @param {Client} stompClient    — connected STOMP client
     * @param {string} roomId
     * @param {string} filePath
     * @param {string} clientId         — unique client session id
     */
    constructor(ydoc, stompClient, roomId, filePath, clientId) {
        this.doc = ydoc;
        this.stomp = stompClient;
        this.roomId = roomId;
        this.filePath = filePath;
        this.clientId = clientId;

        this.docCreatedAt = Date.now();
        this.hasRequestedState = false;
        this.hasReceivedState = false;
        this.synced = false;

        // Subscribe to local updates and broadcast them
        this._updateHandler = (update, origin) => {
            if (origin === this) return; // skip our own applied updates
            this.broadcastUpdate(update);
        };
        this.doc.on('update', this._updateHandler);
    }

    // ── Outgoing ──
    broadcastUpdate(update) {
        if (!this.stomp?.active || !this.stomp?.connected) return;
        try {
            const base64 = toBase64(update);
            this.stomp.publish({
                destination: '/app/code.send',
                body: JSON.stringify({
                    roomId: this.roomId,
                    filePath: this.filePath,
                    clientId: this.clientId,
                    type: 'yjs-update',
                    update: base64,
                }),
            });
        } catch (e) {
            console.error('[YjsProvider] Failed to broadcast update:', e);
        }
    }

    broadcastFullState() {
        if (!this.stomp?.active || !this.stomp?.connected) return;
        try {
            const update = Y.encodeStateAsUpdate(this.doc);
            const base64 = toBase64(update);
            this.stomp.publish({
                destination: '/app/code.send',
                body: JSON.stringify({
                    roomId: this.roomId,
                    filePath: this.filePath,
                    clientId: this.clientId,
                    type: 'yjs-full',
                    yjsState: base64,
                }),
            });
        } catch (e) {
            console.error('[YjsProvider] Failed to broadcast full state:', e);
        }
    }

    requestState() {
        if (this.hasRequestedState) return;
        this.hasRequestedState = true;

        if (!this.stomp?.active || !this.stomp?.connected) return;
        this.stomp.publish({
            destination: '/app/code.send',
            body: JSON.stringify({
                roomId: this.roomId,
                filePath: this.filePath,
                clientId: this.clientId,
                type: 'yjs-request',
            }),
        });
    }

    // ── Incoming ──
    onRemoteMessage(msg) {
        if (msg.clientId === this.clientId) return;
        if (msg.filePath !== this.filePath) return;

        try {
            switch (msg.type) {
                case 'yjs-update':
                    if (msg.update) {
                        const update = fromBase64(msg.update);
                        Y.applyUpdate(this.doc, update, this);
                    }
                    break;

                case 'yjs-request':
                    // Only respond if we've been around long enough to have
                    // a "canonical" state (prevents two simultaneous joiners
                    // from offering each other empty docs).
                    if (Date.now() - this.docCreatedAt > 2000) {
                        this._sendOffer();
                    }
                    break;

                case 'yjs-offer':
                    if (msg.yjsState && this.hasRequestedState && !this.hasReceivedState) {
                        this.hasReceivedState = true;
                        const update = fromBase64(msg.yjsState);
                        Y.applyUpdate(this.doc, update, this);
                        this.synced = true;
                    }
                    break;

                case 'yjs-full':
                    // Another client sent a periodic full state snapshot.
                    // Apply it if we haven't synced yet (e.g. we missed updates).
                    if (msg.yjsState && !this.synced) {
                        const update = fromBase64(msg.yjsState);
                        Y.applyUpdate(this.doc, update, this);
                        this.synced = true;
                    }
                    break;

                default:
                    // Ignore legacy 'full' / 'delta' messages when in Yjs mode
                    break;
            }
        } catch (e) {
            console.error('[YjsProvider] Failed to process remote message:', e);
        }
    }

    _sendOffer() {
        if (!this.stomp?.active || !this.stomp?.connected) return;
        try {
            const update = Y.encodeStateAsUpdate(this.doc);
            const base64 = toBase64(update);
            this.stomp.publish({
                destination: '/app/code.send',
                body: JSON.stringify({
                    roomId: this.roomId,
                    filePath: this.filePath,
                    clientId: this.clientId,
                    type: 'yjs-offer',
                    yjsState: base64,
                }),
            });
        } catch (e) {
            console.error('[YjsProvider] Failed to send offer:', e);
        }
    }

    // ── Cleanup ──
    destroy() {
        this.doc.off('update', this._updateHandler);
    }
}
