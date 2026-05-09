package com.gazi.codeOrbit.dto;

import com.gazi.codeOrbit.enums.FileType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateNodeRequest {
    @NotBlank
    private String name;

    @NotNull
    private FileType fileType;

    /** null = create at root */
    private Long parentId;
}
