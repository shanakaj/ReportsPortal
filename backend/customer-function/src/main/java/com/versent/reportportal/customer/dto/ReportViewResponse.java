package com.versent.reportportal.customer.dto;

import java.time.Instant;
import java.util.Map;

public record ReportViewResponse(
        String reportId,
        String spaceId,
        String fileName,
        String cloudFrontUrl,
        Map<String, String> signedCookies,
        Instant cookieExpiresAt,
        Instant uploadedAt,
        Long fileSize
) {
}
