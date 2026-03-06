package com.versent.reportportal.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateSpaceRequest(
        @NotBlank(message = "Space name is required")
        @Size(min = 3, max = 50, message = "Space name must be between 3 and 50 characters")
        @Pattern(regexp = "^[a-z0-9-]+$", message = "Space name must be lowercase alphanumeric with hyphens only")
        String spaceName
) {
}
