package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.dto.CreateNodeRequest;
import com.gazi.codeOrbit.dto.MoveRequest;
import com.gazi.codeOrbit.dto.RenameRequest;
import com.gazi.codeOrbit.entity.ProjectFile;
import com.gazi.codeOrbit.service.ProjectFileService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/files")
public class ProjectFileController {

    private final ProjectFileService projectFileService;

    public ProjectFileController(ProjectFileService projectFileService) {
        this.projectFileService = projectFileService;
    }

    /**
     * Get all nodes (files + folders) for a room — flat list, tree built on client
     */
    @GetMapping("/{roomId}")
    public ResponseEntity<List<ProjectFile>> getFiles(@PathVariable String roomId) {
        return ResponseEntity.ok(projectFileService.getFilesByRoomId(roomId));
    }

    /** Legacy: save file content by path (used by WebSocket code sync) */
    @PostMapping("/{roomId}")
    public ResponseEntity<Void> saveFile(
            @PathVariable String roomId,
            @RequestParam String filePath,
            @RequestBody(required = false) String content) {
        projectFileService.saveFile(roomId, filePath, content == null ? "" : content);
        return ResponseEntity.ok().build();
    }

    /** Create a file or folder node */
    @PostMapping("/{roomId}/nodes")
    public ResponseEntity<ProjectFile> createNode(
            @PathVariable String roomId,
            @Valid @RequestBody CreateNodeRequest req) {
        return ResponseEntity.ok(projectFileService.createNode(roomId, req));
    }

    /** Rename a node by ID */
    @PatchMapping("/nodes/{id}/rename")
    public ResponseEntity<ProjectFile> renameNode(
            @PathVariable Long id,
            @Valid @RequestBody RenameRequest req) {
        return ResponseEntity.ok(projectFileService.renameNode(id, req.getNewName()));
    }

    /** Move a node by ID to a new parent */
    @PatchMapping("/nodes/{id}/move")
    public ResponseEntity<ProjectFile> moveNode(
            @PathVariable Long id,
            @RequestBody MoveRequest req) {
        return ResponseEntity.ok(projectFileService.moveNode(id, req.getTargetParentId()));
    }

    /** Delete a node by ID (recursively if folder) */
    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<Void> deleteNode(@PathVariable Long id) {
        projectFileService.deleteNode(id);
        return ResponseEntity.ok().build();
    }

    /** Legacy: delete by path */
    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteFile(
            @PathVariable String roomId,
            @RequestParam String filePath) {
        projectFileService.deleteFile(roomId, filePath);
        return ResponseEntity.ok().build();
    }
}
