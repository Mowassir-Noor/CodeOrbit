package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.dto.ExecuteRequest;
import com.gazi.codeOrbit.dto.ExecuteResponse;
import com.gazi.codeOrbit.service.CodeExecutionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/execute")
@RequiredArgsConstructor
public class CodeExecutionController {

    private final CodeExecutionService executionService;

    @PostMapping
    public ResponseEntity<ExecuteResponse> executeCode(@RequestBody ExecuteRequest request) {
        ExecuteResponse response = executionService.execute(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/languages")
    public ResponseEntity<String[]> getSupportedLanguages() {
        return ResponseEntity.ok(executionService.getSupportedLanguages());
    }
}
