package com.gazi.codeOrbit.dto;

import lombok.Data;

@Data
public class MoveRequest {
    /** null means move to root */
    private Long targetParentId;
}
