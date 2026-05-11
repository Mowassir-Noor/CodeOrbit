package com.gazi.codeOrbit.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;


@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMessage {
    private String roomId;
    private String filePath;
    private String clientId;
    private String type; // "full" or "delta"
    private String content; // used when type="full"
    private List<ContentChange> changes; 
    private String update; 
    private String yjsState; 

   
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
