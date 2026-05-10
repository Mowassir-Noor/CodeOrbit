package com.gazi.codeOrbit.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * WebSocket message for real-time code collaboration.
 *
 * Sync modes:
 * - type="full": entire file content (backward compat / DB persistence)
 * - type="delta": incremental Monaco change operations (legacy, being phased
 * out)
 * - type="yjs-update": Yjs incremental update (primary real-time sync)
 * - type="yjs-request": request full Yjs state from peers
 * - type="yjs-offer": respond with full Yjs state (base64 in yjsState)
 * - type="yjs-full": periodic full Yjs state snapshot for DB persistence
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMessage {
    private String roomId;
    private String filePath;
    private String clientId;
    private String type; // "full" or "delta"
    private String content; // used when type="full"
    private List<ContentChange> changes; // used when type="delta"
    private String yjsState; // base64-encoded Yjs document state (used when type="yjs-full" or "yjs-offer")

    /**
     * Mirrors Monaco's IModelContentChange structure for incremental sync.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContentChange {
        private int startLineNumber;
        private int startColumn;
        private int endLineNumber;
        private int endColumn;
        private int rangeLength;
        private String text;
        private int rangeOffset;
    }
}
