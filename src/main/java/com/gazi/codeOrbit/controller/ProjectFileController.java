package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.dto.CreateNodeRequest;
import com.gazi.codeOrbit.dto.MoveRequest;
import com.gazi.codeOrbit.dto.RenameRequest;
import com.gazi.codeOrbit.entity.ProjectFile;
import com.gazi.codeOrbit.entity.User;
import com.gazi.codeOrbit.repository.UserRepository;
import com.gazi.codeOrbit.service.ProjectFileService;
import com.gazi.codeOrbit.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/files")
public class ProjectFileController {

    private static final Logger logger = LoggerFactory.getLogger(ProjectFileController.class);

    private final ProjectFileService projectFileService;
    private final RoomService roomService;
    private final UserRepository userRepository;

    public ProjectFileController(ProjectFileService projectFileService,
            RoomService roomService,
            UserRepository userRepository) {
        this.projectFileService = projectFileService;
        this.roomService = roomService;
        this.userRepository = userRepository;
    }

    private Long getCurrentUserId(UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    /**
     * Get all nodes (files + folders) for a room — flat list, tree built on client
     */
    @GetMapping("/{roomId}")
    public ResponseEntity<List<ProjectFile>> getFiles(@PathVariable String roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        // Check access
        roomService.getRoomById(roomId, userId); // throws if no access
        return ResponseEntity.ok(projectFileService.getFilesByRoomId(roomId));
    }

    /** Legacy: save file content by path (used by WebSocket code sync) */
    @PostMapping("/{roomId}")
    public ResponseEntity<Void> saveFile(
            @PathVariable String roomId,
            @RequestParam String filePath,
            @RequestBody(required = false) String content,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.getRoomById(roomId, userId); // throws if no access
        projectFileService.saveFile(roomId, filePath, content == null ? "" : content);
        return ResponseEntity.ok().build();
    }

    /** Create a file or folder node */
    @PostMapping("/{roomId}/nodes")
    public ResponseEntity<ProjectFile> createNode(
            @PathVariable String roomId,
            @Valid @RequestBody CreateNodeRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.getRoomById(roomId, userId); // throws if no access
        try {
            return ResponseEntity.ok(projectFileService.createNode(roomId, req));
        } catch (Exception e) {
            logger.error("Failed to create node: roomId={}, name={}, fileType={}, parentId={}",
                    roomId, req.getName(), req.getFileType(), req.getParentId(), e);
            throw e;
        }
    }

    /** Rename a node by ID */
    @PatchMapping("/nodes/{id}/rename")
    public ResponseEntity<ProjectFile> renameNode(
            @PathVariable Long id,
            @Valid @RequestBody RenameRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        // Get the file to find its room, then check access
        ProjectFile file = projectFileService.getNodeById(id);
        roomService.getRoomById(file.getRoomId(), userId); // throws if no access
        return ResponseEntity.ok(projectFileService.renameNode(id, req.getNewName()));
    }

    /** Move a node by ID to a new parent */
    @PatchMapping("/nodes/{id}/move")
    public ResponseEntity<ProjectFile> moveNode(
            @PathVariable Long id,
            @RequestBody MoveRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        ProjectFile file = projectFileService.getNodeById(id);
        roomService.getRoomById(file.getRoomId(), userId); // throws if no access
        return ResponseEntity.ok(projectFileService.moveNode(id, req.getTargetParentId()));
    }

    /** Delete a node by ID (recursively if folder) */
    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<Void> deleteNode(@PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        ProjectFile file = projectFileService.getNodeById(id);
        roomService.getRoomById(file.getRoomId(), userId); // throws if no access
        projectFileService.deleteNode(id);
        return ResponseEntity.ok().build();
    }

    /** Legacy: delete by path */
    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteFile(
            @PathVariable String roomId,
            @RequestParam String filePath,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.getRoomById(roomId, userId); // throws if no access
        projectFileService.deleteFile(roomId, filePath);
        return ResponseEntity.ok().build();
    }

    /** Load Yjs CRDT state snapshot for collaborative editing convergence */
    @GetMapping("/{roomId}/yjs")
    public ResponseEntity<String> getYjsState(
            @PathVariable String roomId,
            @RequestParam String filePath,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.getRoomById(roomId, userId);
        byte[] state = projectFileService.getYjsState(roomId, filePath);
        if (state == null) {
            return ResponseEntity.ok("");
        }
        // Base64-encode binary Yjs state for JSON transport
        return ResponseEntity.ok(java.util.Base64.getEncoder().encodeToString(state));
    }
}
