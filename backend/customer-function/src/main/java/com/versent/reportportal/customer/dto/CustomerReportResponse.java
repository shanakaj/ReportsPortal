package com.versent.reportportal.customer.dto;

import java.time.Instant;

public record CustomerReportResponse(
        String reportId,
        String spaceId,
        String fileName,
        Instant uploadedAt,
        Long fileSize
) {
}
