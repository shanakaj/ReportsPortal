package com.versent.reportportal.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
        String accessToken,
        String idToken,
        String refreshToken,
        Integer expiresIn,
        String challengeName,
        String session,
        String secretCode,
        String message
) {
    public static AuthResponse tokens(String accessToken, String idToken,
                                      String refreshToken, Integer expiresIn) {
        return new AuthResponse(accessToken, idToken, refreshToken, expiresIn,
                null, null, null, null);
    }

    public static AuthResponse challenge(String challengeName, String session) {
        return new AuthResponse(null, null, null, null,
                challengeName, session, null, null);
    }

    public static AuthResponse mfaSetup(String session, String secretCode) {
        return new AuthResponse(null, null, null, null,
                "MFA_SETUP", session, secretCode, null);
    }

    public static AuthResponse message(String message) {
        return new AuthResponse(null, null, null, null,
                null, null, null, message);
    }
}
