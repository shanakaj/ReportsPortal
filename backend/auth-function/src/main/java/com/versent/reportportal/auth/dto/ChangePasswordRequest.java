package com.versent.reportportal.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Access token is required")
        String accessToken,

        @NotBlank(message = "Previous password is required")
        String previousPassword,

        @NotBlank(message = "New password is required")
        @Size(min = 12, message = "Password must be at least 12 characters")
        String newPassword
) {
}
