package com.versent.reportportal.admin.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record PlatformSettingsRequest(
        @NotBlank(message = "Organization name is required")
        String organizationName,

        String organizationLegalEntity,

        @NotEmpty(message = "At least one admin domain is required")
        List<String> allowedAdminDomains,

        @Pattern(regexp = "off|warn|strict", message = "Must be one of: off, warn, strict")
        String domainValidationMode,

        @Min(value = 1, message = "Max report file size must be at least 1 MB")
        Long maxReportFileSizeMb,

        @Min(value = 1, message = "Max attachment size must be at least 1 MB")
        Long maxFeedbackAttachmentSizeMb,

        @Min(value = 1, message = "Signed cookie TTL must be at least 1 hour")
        Integer signedCookieTtlHours,

        @Min(value = 1, message = "Invitation expiry must be at least 1 hour")
        Integer invitationExpiryHours,

        Boolean notifyOnInvitationAccepted,

        Boolean notifyFeedbackByEmail
) {
}
