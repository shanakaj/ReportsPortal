package com.versent.reportportal.feedback.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReplyRequest(
        @NotBlank(message = "Message is required")
        @Size(max = 10000, message = "Message must be 10000 characters or less")
        String message,

        List<String> attachments
) {
}
