package com.gazi.codeOrbit.service;

import com.gazi.codeOrbit.dto.CreateNodeRequest;
import com.gazi.codeOrbit.entity.ProjectFile;
import com.gazi.codeOrbit.enums.FileType;
import com.gazi.codeOrbit.model.FileSystemEvent;
import com.gazi.codeOrbit.repository.ProjectFileRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProjectFileService {

    private final ProjectFileRepository repo;
    private final SimpMessagingTemplate messaging;

    public ProjectFileService(ProjectFileRepository repo, SimpMessagingTemplate messaging) {
        this.repo = repo;
        this.messaging = messaging;
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProjectFile> getFilesByRoomId(String roomId) {
        return repo.findByRoomId(roomId);
    }

    // ─── Legacy save (used by CodeController for content sync) ────────────────

    @Transactional
    public void saveFile(String roomId, String filePath, String content) {
        String name = filePath.contains("/")
                ? filePath.substring(filePath.lastIndexOf('/') + 1)
                : filePath;
        ProjectFile file = repo.findByRoomIdAndFilePath(roomId, filePath)
                .orElseGet(() -> ProjectFile.builder()
                        .roomId(roomId)
                        .filePath(filePath)
                        .name(name)
                        .fileType(FileType.FILE)
                        .build());
        file.setContent(content);
        repo.save(file);
    }

    // ─── Create (file or folder) ───────────────────────────────────────────────

    @Transactional
    public ProjectFile createNode(String roomId, CreateNodeRequest req) {
        String parentPath = resolveParentPath(roomId, req.getParentId());
        String fullPath = parentPath.isEmpty() ? req.getName() : parentPath + "/" + req.getName();

        if (repo.findByRoomIdAndFilePath(roomId, fullPath).isPresent()) {
            throw new IllegalArgumentException("A file or folder with that name already exists at this location.");
        }

        ProjectFile node = ProjectFile.builder()
                .roomId(roomId)
                .filePath(fullPath)
                .name(req.getName())
                .parentId(req.getParentId())
                .fileType(req.getFileType())
                .content(req.getFileType() == FileType.FILE ? "" : null)
                .build();
        node = repo.save(node);

        FileSystemEvent.EventType evType = req.getFileType() == FileType.DIRECTORY
                ? FileSystemEvent.EventType.FOLDER_CREATED
                : FileSystemEvent.EventType.FILE_CREATED;

        broadcast(roomId, FileSystemEvent.builder()
                .roomId(roomId)
                .eventType(evType)
                .fileType(req.getFileType())
                .id(node.getId())
                .newPath(fullPath)
                .name(req.getName())
                .parentId(req.getParentId())
                .content(node.getContent())
                .build());

        return node;
    }

    // ─── Rename ───────────────────────────────────────────────────────────────

    @Transactional
    public ProjectFile renameNode(Long nodeId, String newName) {
        ProjectFile node = repo.findById(nodeId)
                .orElseThrow(() -> new IllegalArgumentException("Node not found: " + nodeId));

        String oldPath = node.getFilePath();
        String parentPath = resolveParentPath(node.getRoomId(), node.getParentId());
        String newPath = parentPath.isEmpty() ? newName : parentPath + "/" + newName;

        if (repo.findByRoomIdAndFilePath(node.getRoomId(), newPath).isPresent()) {
            throw new IllegalArgumentException("A file or folder named '" + newName + "' already exists here.");
        }

        node.setName(newName);
        node.setFilePath(newPath);
        repo.save(node);

        if (node.getFileType() == FileType.DIRECTORY) {
            repo.bulkUpdatePaths(node.getRoomId(), oldPath, newPath);
        }

        FileSystemEvent.EventType evType = node.getFileType() == FileType.DIRECTORY
                ? FileSystemEvent.EventType.FOLDER_RENAMED
                : FileSystemEvent.EventType.FILE_RENAMED;

        broadcast(node.getRoomId(), FileSystemEvent.builder()
                .roomId(node.getRoomId())
                .eventType(evType)
                .fileType(node.getFileType())
                .id(nodeId)
                .oldPath(oldPath)
                .newPath(newPath)
                .name(newName)
                .parentId(node.getParentId())
                .build());

        return node;
    }

    // ─── Move ─────────────────────────────────────────────────────────────────

    @Transactional
    public ProjectFile moveNode(Long nodeId, Long targetParentId) {
        ProjectFile node = repo.findById(nodeId)
                .orElseThrow(() -> new IllegalArgumentException("Node not found: " + nodeId));

        if (node.getFileType() == FileType.DIRECTORY) {
            guardCyclicMove(node, targetParentId);
        }

        String oldPath = node.getFilePath();
        String newParentPath = resolveParentPath(node.getRoomId(), targetParentId);
        String newPath = newParentPath.isEmpty() ? node.getName() : newParentPath + "/" + node.getName();

        if (repo.findByRoomIdAndFilePath(node.getRoomId(), newPath).filter(f -> !f.getId().equals(nodeId))
                .isPresent()) {
            throw new IllegalArgumentException(
                    "A file or folder named '" + node.getName() + "' already exists at the target location.");
        }

        node.setParentId(targetParentId);
        node.setFilePath(newPath);
        repo.save(node);

        if (node.getFileType() == FileType.DIRECTORY) {
            repo.bulkUpdatePaths(node.getRoomId(), oldPath, newPath);
        }

        FileSystemEvent.EventType evType = node.getFileType() == FileType.DIRECTORY
                ? FileSystemEvent.EventType.FOLDER_MOVED
                : FileSystemEvent.EventType.FILE_MOVED;

        broadcast(node.getRoomId(), FileSystemEvent.builder()
                .roomId(node.getRoomId())
                .eventType(evType)
                .fileType(node.getFileType())
                .id(nodeId)
                .oldPath(oldPath)
                .newPath(newPath)
                .name(node.getName())
                .parentId(targetParentId)
                .build());

        return node;
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    @Transactional
    public void deleteNode(Long nodeId) {
        ProjectFile node = repo.findById(nodeId)
                .orElseThrow(() -> new IllegalArgumentException("Node not found: " + nodeId));

        String roomId = node.getRoomId();
        String path = node.getFilePath();
        FileType type = node.getFileType();

        if (type == FileType.DIRECTORY) {
            repo.deleteByRoomIdAndFilePathStartingWith(roomId, path);
        }
        repo.deleteById(nodeId);

        FileSystemEvent.EventType evType = type == FileType.DIRECTORY
                ? FileSystemEvent.EventType.FOLDER_DELETED
                : FileSystemEvent.EventType.FILE_DELETED;

        broadcast(roomId, FileSystemEvent.builder()
                .roomId(roomId)
                .eventType(evType)
                .fileType(type)
                .id(nodeId)
                .oldPath(path)
                .name(node.getName())
                .parentId(node.getParentId())
                .build());
    }

    /** Legacy path-based delete kept for backward compat with old REST callers */
    @Transactional
    public void deleteFile(String roomId, String filePath) {
        repo.findByRoomIdAndFilePath(roomId, filePath).ifPresent(f -> deleteNode(f.getId()));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String resolveParentPath(String roomId, Long parentId) {
        if (parentId == null)
            return "";
        return repo.findById(parentId)
                .map(ProjectFile::getFilePath)
                .orElse("");
    }

    private void guardCyclicMove(ProjectFile node, Long targetParentId) {
        if (targetParentId == null)
            return;
        Long cursor = targetParentId;
        while (cursor != null) {
            if (cursor.equals(node.getId())) {
                throw new IllegalArgumentException("Cannot move a folder into one of its own descendants.");
            }
            Long finalCursor = cursor;
            cursor = repo.findById(finalCursor).map(ProjectFile::getParentId).orElse(null);
        }
    }

    private void broadcast(String roomId, FileSystemEvent event) {
        messaging.convertAndSend("/topic/fs/" + roomId, event);
    }
}
