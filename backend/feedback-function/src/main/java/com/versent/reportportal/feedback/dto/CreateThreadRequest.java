package com.versent.reportportal.feedback.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateThreadRequest(
        @NotBlank(message = "Subject is required")
        @Size(max = 200, message = "Subject must be 200 characters or less")
        String subject,

        @NotBlank(message = "Message is required")
        @Size(max = 10000, message = "Message must be 10000 characters or less")
        String message,

        List<String> attachments
) {
}
