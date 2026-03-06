package com.versent.reportportal.admin.dto;

public record ImpersonationResponse(
        String impersonationToken,
        String targetUserId,
        String targetEmail,
        String targetRole,
        Integer expiresIn
) {
}
