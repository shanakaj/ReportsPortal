package com.versent.reportportal.shared.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        int status,
        String code,
        String message,
        Instant timestamp
) {
    public ErrorResponse(int status, String code, String message) {
        this(status, code, message, Instant.now());
    }
}
