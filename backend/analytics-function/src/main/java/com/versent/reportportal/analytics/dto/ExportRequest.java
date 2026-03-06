package com.versent.reportportal.analytics.dto;

import jakarta.validation.constraints.NotBlank;

public record ExportRequest(
        @NotBlank(message = "Space ID is required")
        String spaceId,

        String from,
        String to,

        String format
) {
}
