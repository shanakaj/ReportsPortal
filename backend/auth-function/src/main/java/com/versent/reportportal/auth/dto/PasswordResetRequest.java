package com.versent.reportportal.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        String confirmationCode,

        String newPassword
) {
}
