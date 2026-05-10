package com.gazi.codeOrbit.entity;

import com.gazi.codeOrbit.enums.AuthProvider;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    @Enumerated(EnumType.STRING)
    private AuthProvider provider;

    @Column(name = "profile_image", columnDefinition = "bytea")
    private byte[] profileImage;

    @Column(name = "profile_image_content_type")
    private String profileImageContentType;

    @Column(name = "profile_image_file_name")
    private String profileImageFileName;

    @Column(name = "profile_image_updated_at")
    private java.time.LocalDateTime profileImageUpdatedAt;
}
