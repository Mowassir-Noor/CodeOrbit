package com.gazi.codeOrbit.service;

import com.gazi.codeOrbit.entity.ProjectFile;
import com.gazi.codeOrbit.repository.ProjectFileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProjectFileService {
    private final ProjectFileRepository projectFileRepository;

    public ProjectFileService(ProjectFileRepository projectFileRepository) {
        this.projectFileRepository = projectFileRepository;
    }

    @Transactional(readOnly = true)
    public List<ProjectFile> getFilesByRoomId(String roomId) {
        return projectFileRepository.findByRoomId(roomId);
    }

    @Transactional
    public void saveFile(String roomId, String filePath, String content) {
        ProjectFile file = projectFileRepository.findByRoomIdAndFilePath(roomId, filePath)
                .orElseGet(() -> ProjectFile.builder().roomId(roomId).filePath(filePath).build());
        file.setContent(content);
        projectFileRepository.save(file);
    }

    @Transactional
    public void deleteFile(String roomId, String filePath) {
        projectFileRepository.deleteByRoomIdAndFilePath(roomId, filePath);
    }
}
