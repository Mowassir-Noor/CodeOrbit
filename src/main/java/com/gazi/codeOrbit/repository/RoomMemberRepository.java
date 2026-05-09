package com.gazi.codeOrbit.repository;

import com.gazi.codeOrbit.entity.RoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {
    List<RoomMember> findByRoomId(String roomId);
    List<RoomMember> findByUserId(Long userId);
    Optional<RoomMember> findByRoomIdAndUserId(String roomId, Long userId);
    boolean existsByRoomIdAndUserId(String roomId, Long userId);
    void deleteByRoomIdAndUserId(String roomId, Long userId);
    void deleteByRoomId(String roomId);
}
