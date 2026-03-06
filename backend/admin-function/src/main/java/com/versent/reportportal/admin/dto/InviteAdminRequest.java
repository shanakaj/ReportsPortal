package com.versent.reportportal.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record InviteAdminRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        @Pattern(regexp = ".*@versent\\.com\\.au$", message = "Admin emails must be @versent.com.au")
        String email
) {
}
