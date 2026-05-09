package com.gazi.codeOrbit.service;

import com.gazi.codeOrbit.entity.User;
import com.gazi.codeOrbit.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class ProfileService {

    private final UserRepository userRepository;

    public ProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public void uploadProfileImage(String username, MultipartFile file) throws IOException {
        Optional<User> optionalUser = userRepository.findByUsername(username);
        if (optionalUser.isPresent()) {
            User user = optionalUser.get();
            user.setProfileImage(file.getBytes());
            user.setProfileImageContentType(file.getContentType());
            user.setProfileImageFileName(file.getOriginalFilename());
            user.setProfileImageUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
        } else {
            throw new RuntimeException("User not found");
        }
    }

    @Transactional(readOnly = true)
    public User getProfile(String username) {
        return userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public void deleteProfileImage(String username) {
        Optional<User> optionalUser = userRepository.findByUsername(username);
        if (optionalUser.isPresent()) {
            User user = optionalUser.get();
            user.setProfileImage(null);
            user.setProfileImageContentType(null);
            user.setProfileImageFileName(null);
            user.setProfileImageUpdatedAt(null);
            userRepository.save(user);
        }
    }
}
