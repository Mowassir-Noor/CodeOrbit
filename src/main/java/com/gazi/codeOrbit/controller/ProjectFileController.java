package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.entity.ProjectFile;
import com.gazi.codeOrbit.service.ProjectFileService;
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

    @GetMapping("/{roomId}")
    public ResponseEntity<List<ProjectFile>> getFiles(@PathVariable String roomId) {
        return ResponseEntity.ok(projectFileService.getFilesByRoomId(roomId));
    }

    @PostMapping("/{roomId}")
    public ResponseEntity<Void> saveFile(@PathVariable String roomId, @RequestParam String filePath, @RequestBody(required = false) String content) {
        if (content == null) {
            content = "";
        }
        projectFileService.saveFile(roomId, filePath, content);
        return ResponseEntity.ok().build();
    }
    
    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteFile(@PathVariable String roomId, @RequestParam String filePath) {
        projectFileService.deleteFile(roomId, filePath);
        return ResponseEntity.ok().build();
    }
}
