package com.versent.reportportal.admin.dto;

import java.time.Instant;

public record SpaceResponse(
        String spaceId,
        String spaceName,
        String s3BucketName,
        String createdBy,
        Instant createdAt,
        String status
) {
}
