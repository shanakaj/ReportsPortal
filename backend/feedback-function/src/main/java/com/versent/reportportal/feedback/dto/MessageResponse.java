package com.versent.reportportal.feedback.dto;

import java.time.Instant;
import java.util.List;

public record MessageResponse(
        String messageId,
        String threadId,
        String authorId,
        String authorName,
        String authorRole,
        String message,
        List<String> attachments,
        Instant createdAt
) {
}
