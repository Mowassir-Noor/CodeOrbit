package com.gazi.codeOrbit.entity;

import com.gazi.codeOrbit.enums.FileType;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_files", indexes = {
        @Index(name = "idx_pf_room", columnList = "roomId"),
        @Index(name = "idx_pf_parent", columnList = "parentId"),
        @Index(name = "idx_pf_path", columnList = "filePath")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = { "roomId", "filePath" })
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String roomId;

    /** Full virtual path: e.g. src/components/Button.jsx */
    @Column(nullable = false)
    private String filePath;

    /** Just the filename/dirname segment, e.g. Button.jsx */
    @Column(nullable = false)
    private String name;

    /** Null = root level entry */
    private Long parentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private FileType fileType = FileType.FILE;

    @Column(nullable = true, length = 1000000)
    private String content;

    /** Yjs CRDT encoded state snapshot for collaborative editing convergence */
    @Lob
    private byte[] yjsState;

    private LocalDateTime lastUpdated;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }
}
