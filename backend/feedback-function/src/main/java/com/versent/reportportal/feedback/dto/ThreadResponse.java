package com.versent.reportportal.feedback.dto;

import java.time.Instant;

public record ThreadResponse(
        String threadId,
        String spaceId,
        String reportId,
        String subject,
        String status,
        String createdBy,
        String createdByRole,
        Instant createdAt,
        Instant lastMessageAt,
        String lastMessageBy,
        Integer messageCount,
        Boolean unreadByAdmin,
        Boolean unreadByCustomer
) {
}
