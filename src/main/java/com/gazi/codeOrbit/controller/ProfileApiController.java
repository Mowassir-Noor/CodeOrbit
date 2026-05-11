package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.entity.User;
import com.gazi.codeOrbit.service.ProfileService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileApiController {

    private final ProfileService profileService;

    public ProfileApiController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @PostMapping("/image")
    public ResponseEntity<?> uploadProfileImage(@RequestParam("image") MultipartFile file, @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        
        try {
            
            String contentType = file.getContentType();
            if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/webp"))) {
                return ResponseEntity.badRequest().body("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
            }
            if (file.getSize() > 5 * 1024 * 1024) { // 5MB limit
                return ResponseEntity.badRequest().body("File size exceeds 5MB limit.");
            }

            profileService.uploadProfileImage(userDetails.getUsername(), file);
            return ResponseEntity.ok(Map.of("message", "Profile image uploaded successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to upload image: " + e.getMessage());
        }
    }

    @GetMapping("/image/{username}")
    public ResponseEntity<byte[]> getProfileImage(@PathVariable String username) {
        try {
            User user = profileService.getProfile(username);
            if (user.getProfileImage() != null) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.parseMediaType(user.getProfileImageContentType() != null ? user.getProfileImageContentType() : "image/jpeg"));
                headers.setCacheControl("max-age=3600, must-revalidate");
                return new ResponseEntity<>(user.getProfileImage(), headers, HttpStatus.OK);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/image")
    public ResponseEntity<?> deleteProfileImage(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        try {
            profileService.deleteProfileImage(userDetails.getUsername());
            return ResponseEntity.ok(Map.of("message", "Profile image deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to delete image: " + e.getMessage());
        }
    }

    @GetMapping("")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        User user = profileService.getProfile(userDetails.getUsername());
        Map<String, Object> profileData = new HashMap<>();
        profileData.put("username", user.getUsername());
        profileData.put("email", user.getEmail());
        profileData.put("provider", user.getProvider());
        profileData.put("hasImage", user.getProfileImage() != null);
        
        return ResponseEntity.ok(profileData);
    }
    
   
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRooms", 12);
        stats.put("filesCreated", 47);
        stats.put("collaborations", 8);
        stats.put("totalExecutions", 156);
        stats.put("activeProjects", 3);
        stats.put("lastActive", java.time.Instant.now().toString());
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/activity")
    public ResponseEntity<?> getActivity(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        // Mock activity timeline
        return ResponseEntity.ok(new Object[]{
            Map.of("id", 1, "type", "login", "description", "Logged in via " + "LOCAL", "timestamp", java.time.Instant.now().minusSeconds(3600).toString()),
            Map.of("id", 2, "type", "room", "description", "Created room 'Project Nebula'", "timestamp", java.time.Instant.now().minusSeconds(86400).toString()),
            Map.of("id", 3, "type", "code", "description", "Executed Python script", "timestamp", java.time.Instant.now().minusSeconds(172800).toString())
        });
    }
}
