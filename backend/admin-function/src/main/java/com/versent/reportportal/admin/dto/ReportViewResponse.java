package com.versent.reportportal.admin.dto;

import java.time.Instant;
import java.util.Map;

public record ReportViewResponse(
        ReportInfo report,
        String cloudFrontUrl,
        Map<String, String> signedCookies,
        Instant cookieExpiresAt
) {
    public record ReportInfo(
            String reportId,
            String spaceId,
            String fileName,
            String s3Key,
            Instant uploadedAt,
            Long fileSize
    ) {
    }
}
