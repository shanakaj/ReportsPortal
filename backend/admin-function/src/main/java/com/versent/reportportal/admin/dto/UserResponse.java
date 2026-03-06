package com.versent.reportportal.admin.dto;

import java.time.Instant;
import java.util.List;

public record UserResponse(
        String userId,
        String email,
        String fullName,
        String phone,
        String company,
        String role,
        List<String> customerSpaces,
        String status,
        Boolean mfaEnabled,
        Instant createdAt,
        Instant lastLogin
) {
}
