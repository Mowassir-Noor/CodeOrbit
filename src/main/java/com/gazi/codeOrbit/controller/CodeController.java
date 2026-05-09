package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.entity.User;
import com.gazi.codeOrbit.model.CodeMessage;
import com.gazi.codeOrbit.repository.UserRepository;
import com.gazi.codeOrbit.service.ProjectFileService;
import com.gazi.codeOrbit.service.RoomService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class CodeController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ProjectFileService projectFileService;
    private final RoomService roomService;
    private final UserRepository userRepository;

    public CodeController(SimpMessagingTemplate messagingTemplate,
            ProjectFileService projectFileService,
            RoomService roomService,
            UserRepository userRepository) {
        this.messagingTemplate = messagingTemplate;
        this.projectFileService = projectFileService;
        this.roomService = roomService;
        this.userRepository = userRepository;
    }

    @MessageMapping("/code.send")
    public void sendCode(@Payload CodeMessage message, StompHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        if (principal == null) {
            throw new IllegalArgumentException("User not authenticated");
        }

        // Get user and check room access
        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Check access - throws if not a member
        roomService.getRoomById(message.getRoomId(), user.getId());

        // Persist the change
        if (message.getFilePath() != null && !message.getFilePath().isEmpty()) {
            projectFileService.saveFile(message.getRoomId(), message.getFilePath(), message.getContent());
        }

        messagingTemplate.convertAndSend("/topic/code/" + message.getRoomId(), message);
    }
}
