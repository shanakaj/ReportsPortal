package com.versent.reportportal.admin.dto;

import java.time.Instant;

public record ReportResponse(
        String reportId,
        String spaceId,
        String fileName,
        String s3Key,
        String uploadedBy,
        Instant uploadedAt,
        Long fileSize,
        String status
) {
}
