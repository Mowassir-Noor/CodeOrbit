package com.gazi.codeOrbit.dto;

import lombok.Data;

@Data
public class ExecuteRequest {
    private String language;
    private String code;
    private String fileName;
    private String stdin;
    private Long timeoutSeconds;
}
