package com.gazi.codeOrbit.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RenameRequest {
    @NotBlank
    private String newName;
}
