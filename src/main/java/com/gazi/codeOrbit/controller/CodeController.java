package com.gazi.codeOrbit.controller;

import com.gazi.codeOrbit.model.CodeMessage;
import com.gazi.codeOrbit.service.ProjectFileService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class CodeController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ProjectFileService projectFileService;

    public CodeController(SimpMessagingTemplate messagingTemplate, ProjectFileService projectFileService) {
        this.messagingTemplate = messagingTemplate;
        this.projectFileService = projectFileService;
    }

    @MessageMapping("/code.send")
    public void sendCode(@Payload CodeMessage message) {
        // Persist the change
        if (message.getFilePath() != null && !message.getFilePath().isEmpty()) {
            projectFileService.saveFile(message.getRoomId(), message.getFilePath(), message.getContent());
        }
        
        messagingTemplate.convertAndSend("/topic/code/" + message.getRoomId(), message);
    }
}
