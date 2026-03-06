package com.versent.reportportal.admin.dto;

public record UploadReportResponse(
        String reportId,
        String presignedUrl,
        String s3Key
) {
}
