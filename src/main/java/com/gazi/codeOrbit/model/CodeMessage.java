package com.gazi.codeOrbit.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMessage {
    private String roomId;
    private String filePath;
    private String content;
}
