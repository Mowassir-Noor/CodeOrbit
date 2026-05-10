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

        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Verify room membership
        roomService.getRoomById(message.getRoomId(), user.getId());

        String type = message.getType();

        // Persist plain-text content on legacy full-sync (backward compat)
        if ("full".equals(type)
                && message.getFilePath() != null
                && !message.getFilePath().isEmpty()
                && message.getContent() != null) {
            projectFileService.saveFile(message.getRoomId(), message.getFilePath(), message.getContent());
        }

        // Persist Yjs CRDT state snapshot for collaborative convergence
        if ("yjs-full".equals(type)
                && message.getFilePath() != null
                && !message.getFilePath().isEmpty()
                && message.getYjsState() != null
                && !message.getYjsState().isEmpty()) {
            try {
                byte[] state = java.util.Base64.getDecoder().decode(message.getYjsState());
                projectFileService.saveYjsState(message.getRoomId(), message.getFilePath(), state);
            } catch (IllegalArgumentException e) {
                // Invalid base64 — ignore persistence but still broadcast
            }
        }

        // Broadcast to all clients including sender.
        // The sender filters its own messages via clientId to avoid echo loops.
        // Yjs messages (yjs-update, yjs-request, yjs-offer) are relayed verbatim.
        messagingTemplate.convertAndSend("/topic/code/" + message.getRoomId(), message);
    }
}
