package com.gazi.codeOrbit.service;

import com.gazi.codeOrbit.entity.Room;
import com.gazi.codeOrbit.entity.RoomMember;
import com.gazi.codeOrbit.repository.RoomMemberRepository;
import com.gazi.codeOrbit.repository.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoomService {
    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;

    public RoomService(RoomRepository roomRepository, RoomMemberRepository roomMemberRepository) {
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
    }

    @Transactional
    public Room createRoom(String name, Long ownerId) {
        Room room = Room.builder()
                .name(name)
                .ownerId(ownerId)
                .build();
        Room savedRoom = roomRepository.save(room);

        // Add creator as a member
        RoomMember member = RoomMember.builder()
                .roomId(savedRoom.getId())
                .userId(ownerId)
                .build();
        roomMemberRepository.save(member);

        return savedRoom;
    }

    @Transactional(readOnly = true)
    public List<Room> getRoomsForUser(Long userId) {
        // Get all rooms where user is a member
        List<RoomMember> memberships = roomMemberRepository.findByUserId(userId);
        List<String> roomIds = memberships.stream()
                .map(RoomMember::getRoomId)
                .collect(Collectors.toList());
        return roomRepository.findAllById(roomIds);
    }

    @Transactional(readOnly = true)
    public Room getRoomById(String id, Long userId) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room " + id + " not found"));

        // Check if user has access (is a member)
        boolean hasAccess = roomMemberRepository.existsByRoomIdAndUserId(id, userId);
        if (!hasAccess) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this room");
        }

        return room;
    }

    @Transactional(readOnly = true)
    public boolean hasAccess(String roomId, Long userId) {
        return roomMemberRepository.existsByRoomIdAndUserId(roomId, userId);
    }

    @Transactional
    public void addMember(String roomId, Long userId, Long requesterId) {
        // Only room members can add other members
        if (!hasAccess(roomId, requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this room");
        }

        // Check if already a member
        if (roomMemberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already a member of this room");
        }

        RoomMember member = RoomMember.builder()
                .roomId(roomId)
                .userId(userId)
                .build();
        roomMemberRepository.save(member);
    }

    @Transactional
    public void removeMember(String roomId, Long userId, Long requesterId) {
        // Only room owner can remove members
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        if (!room.getOwnerId().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the room owner can remove members");
        }

        roomMemberRepository.deleteByRoomIdAndUserId(roomId, userId);
    }

    @Transactional(readOnly = true)
    public List<RoomMember> getRoomMembers(String roomId, Long requesterId) {
        if (!hasAccess(roomId, requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this room");
        }
        return roomMemberRepository.findByRoomId(roomId);
    }

    @Transactional
    public void joinRoom(String roomId, Long userId) {
        // Check if room exists
        if (!roomRepository.existsById(roomId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found");
        }

        // Check if already a member
        if (roomMemberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You are already a member of this room");
        }

        // Add user as member
        RoomMember member = RoomMember.builder()
                .roomId(roomId)
                .userId(userId)
                .build();
        roomMemberRepository.save(member);
    }

    @Transactional
    public void deleteRoom(String roomId, Long requesterId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        if (!room.getOwnerId().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the room owner can delete the room");
        }

        // Delete all memberships first
        roomMemberRepository.deleteByRoomId(roomId);
        // Delete the room
        roomRepository.delete(room);
    }

    @Transactional
    public Room renameRoom(String roomId, String newName, Long requesterId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        // Only owner can rename
        if (!room.getOwnerId().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the room owner can rename the room");
        }

        room.setName(newName);
        return roomRepository.save(room);
    }
}
