package com.versent.reportportal.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record MfaVerifyRequest(
        @NotBlank(message = "Session is required")
        String session,

        @NotBlank(message = "MFA code is required")
        String mfaCode,

        @NotBlank(message = "Challenge name is required")
        String challengeName
) {
}
