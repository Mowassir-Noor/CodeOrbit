package com.gazi.codeOrbit.model;

import com.gazi.codeOrbit.enums.FileType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileSystemEvent {

    public enum EventType {
        FILE_CREATED,
        FILE_RENAMED,
        FILE_DELETED,
        FILE_MOVED,
        FOLDER_CREATED,
        FOLDER_RENAMED,
        FOLDER_DELETED,
        FOLDER_MOVED
    }

    private String roomId;
    private EventType eventType;
    private FileType fileType;

    /** ID of the affected node */
    private Long id;

    
    private String oldPath;

    private String newPath;

    private String name;

    private Long parentId;

    private String content;
}
