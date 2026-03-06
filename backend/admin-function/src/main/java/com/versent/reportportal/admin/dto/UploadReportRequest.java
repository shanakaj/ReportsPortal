package com.versent.reportportal.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record UploadReportRequest(
        @NotBlank(message = "File name is required")
        String fileName,

        @Positive(message = "File size must be positive")
        Long fileSize,

        String contentType
) {
}
