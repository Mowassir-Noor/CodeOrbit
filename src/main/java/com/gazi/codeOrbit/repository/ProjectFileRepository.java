package com.gazi.codeOrbit.repository;

import com.gazi.codeOrbit.entity.ProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {

        List<ProjectFile> findByRoomId(String roomId);

        Optional<ProjectFile> findByRoomIdAndFilePath(String roomId, String filePath);

        void deleteByRoomIdAndFilePath(String roomId, String filePath);

        List<ProjectFile> findByRoomIdAndParentId(String roomId, Long parentId);

        List<ProjectFile> findByRoomIdAndParentIdIsNull(String roomId);

        boolean existsByRoomIdAndParentIdAndName(String roomId, Long parentId, String name);

        boolean existsByRoomIdAndParentIdIsNullAndName(String roomId, String name);

        /** Fetch all descendants of a folder by prefix path (for cascade operations) */
        @Query("SELECT f FROM ProjectFile f WHERE f.roomId = :roomId AND f.filePath LIKE CONCAT(:prefix, '/%')")
        List<ProjectFile> findByRoomIdAndFilePathStartingWith(@Param("roomId") String roomId,
                        @Param("prefix") String prefix);

        /** Update all paths that start with oldPrefix to use newPrefix */
        @Modifying(clearAutomatically = true)
        @Query("UPDATE ProjectFile f SET f.filePath = CONCAT(:newPrefix, SUBSTRING(f.filePath, LENGTH(:oldPrefix) + 1)) WHERE f.roomId = :roomId AND f.filePath LIKE CONCAT(:oldPrefix, '/%')")
        int bulkUpdatePaths(@Param("roomId") String roomId, @Param("oldPrefix") String oldPrefix,
                        @Param("newPrefix") String newPrefix);

        /**
         * Delete all entries whose path starts with a given prefix (folder recursive
         * delete)
         */
        @Modifying(clearAutomatically = true)
        @Query("DELETE FROM ProjectFile f WHERE f.roomId = :roomId AND f.filePath LIKE CONCAT(:prefix, '/%')")
        void deleteByRoomIdAndFilePathStartingWith(@Param("roomId") String roomId, @Param("prefix") String prefix);
}
