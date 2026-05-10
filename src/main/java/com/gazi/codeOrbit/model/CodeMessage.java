package com.gazi.codeOrbit.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * WebSocket message for real-time code collaboration.
 *
 * Supports two sync modes:
 * - type="full": carries the entire file content (backward compat / initial
 * load)
 * - type="delta": carries incremental Monaco change operations
 * (high-performance)
 *
 * The delta format is forward-compatible with future Yjs/CRDT integration.
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
