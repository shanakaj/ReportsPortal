package com.versent.reportportal.customer.dto;

import jakarta.validation.constraints.Pattern;

public record PreferencesRequest(
        @Pattern(regexp = "^(embedded|full-tab)$", message = "View mode must be 'embedded' or 'full-tab'")
        String preferredViewMode,

        Boolean analyticsConsent
) {
}
