package com.gazi.codeOrbit.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ExecuteResponse {
    private boolean success;
    private String output;
    private String error;
    private int exitCode;
    private long executionTimeMs;
    private String language;
}
