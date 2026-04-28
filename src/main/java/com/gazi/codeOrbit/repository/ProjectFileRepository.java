package com.gazi.codeOrbit.repository;

import com.gazi.codeOrbit.entity.ProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {
    List<ProjectFile> findByRoomId(String roomId);
    Optional<ProjectFile> findByRoomIdAndFilePath(String roomId, String filePath);
    void deleteByRoomIdAndFilePath(String roomId, String filePath);
}
