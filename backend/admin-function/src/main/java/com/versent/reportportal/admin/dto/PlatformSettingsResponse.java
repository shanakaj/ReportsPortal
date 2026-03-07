package com.versent.reportportal.admin.dto;

import java.time.Instant;
import java.util.List;

public record PlatformSettingsResponse(
        String organizationName,
        String organizationLegalEntity,
        List<String> allowedAdminDomains,
        String domainValidationMode,
        Long maxReportFileSizeMb,
        Long maxFeedbackAttachmentSizeMb,
        Integer signedCookieTtlHours,
        Integer invitationExpiryHours,
        Boolean notifyOnInvitationAccepted,
        Boolean notifyFeedbackByEmail,
        Instant updatedAt,
        String updatedBy
) {
}
