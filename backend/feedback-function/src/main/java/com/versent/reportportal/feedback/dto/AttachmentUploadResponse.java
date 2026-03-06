package com.versent.reportportal.feedback.dto;

public record AttachmentUploadResponse(
        String presignedUrl,
        String s3Key
) {
}
