package com.versent.reportportal.customer.dto;

import java.time.Instant;

public record CustomerSpaceResponse(
        String spaceId,
        String spaceName,
        Instant createdAt,
        String status,
        int reportCount
) {
}
