package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.entity.Room;
import com.gazi.codeOrbit.entity.RoomMember;
import com.gazi.codeOrbit.entity.User;
import com.gazi.codeOrbit.repository.UserRepository;
import com.gazi.codeOrbit.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final UserRepository userRepository;

    public RoomController(RoomService roomService, UserRepository userRepository) {
        this.roomService = roomService;
        this.userRepository = userRepository;
    }

    private Long getCurrentUserId(UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @PostMapping
    public ResponseEntity<Room> createRoom(@RequestBody String name, @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(roomService.createRoom(name, userId));
    }

    @GetMapping
    public ResponseEntity<List<Room>> getMyRooms(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(roomService.getRoomsForUser(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Room> getRoomById(@PathVariable String id, @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(roomService.getRoomById(id, userId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoom(@PathVariable String id, @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.deleteRoom(id, userId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/rename")
    public ResponseEntity<Room> renameRoom(
            @PathVariable String id,
            @RequestBody String newName,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(roomService.renameRoom(id, newName, userId));
    }

    // Room membership endpoints
    @PostMapping("/{roomId}/members")
    public ResponseEntity<Void> addMember(
            @PathVariable String roomId,
            @RequestBody Map<String, Long> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        Long memberUserId = request.get("userId");
        roomService.addMember(roomId, memberUserId, userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{roomId}/members/{memberUserId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable String roomId,
            @PathVariable Long memberUserId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.removeMember(roomId, memberUserId, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<List<RoomMember>> getRoomMembers(
            @PathVariable String roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(roomService.getRoomMembers(roomId, userId));
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<Void> joinRoom(
            @PathVariable String roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        roomService.joinRoom(roomId, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{roomId}/access")
    public ResponseEntity<Map<String, Boolean>> checkAccess(
            @PathVariable String roomId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getCurrentUserId(userDetails);
        boolean hasAccess = roomService.hasAccess(roomId, userId);
        return ResponseEntity.ok(Map.of("hasAccess", hasAccess));
    }
}
