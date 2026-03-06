package com.versent.reportportal.feedback.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateStatusRequest(
        @NotBlank(message = "Status is required")
        @Pattern(regexp = "^(open|resolved|archived)$", message = "Status must be 'open', 'resolved', or 'archived'")
        String status
) {
}
