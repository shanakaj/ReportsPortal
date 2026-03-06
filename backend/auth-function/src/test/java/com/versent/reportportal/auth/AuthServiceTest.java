package com.versent.reportportal.auth;

import com.versent.reportportal.auth.dto.AuthResponse;
import com.versent.reportportal.auth.dto.ChangePasswordRequest;
import com.versent.reportportal.auth.dto.LoginRequest;
import com.versent.reportportal.auth.dto.MfaVerifyRequest;
import com.versent.reportportal.auth.dto.PasswordResetRequest;
import com.versent.reportportal.auth.service.AuthService;
import com.versent.reportportal.shared.service.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminInitiateAuthRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminInitiateAuthResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthenticationResultType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ChallengeNameType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.NotAuthorizedException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private CognitoIdentityProviderClient cognitoClient;

    @Mock
    private AuditService auditService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(cognitoClient, auditService,
                "ap-southeast-2_testPool", "testClientId");
    }

    @Test
    void login_successful_returnsTokens() {
        AuthenticationResultType authResult = AuthenticationResultType.builder()
                .accessToken("test-access-token")
                .idToken("test-id-token")
                .refreshToken("test-refresh-token")
                .expiresIn(900)
                .build();

        AdminInitiateAuthResponse authResponse = AdminInitiateAuthResponse.builder()
                .authenticationResult(authResult)
                .build();

        when(cognitoClient.adminInitiateAuth(any(AdminInitiateAuthRequest.class)))
                .thenReturn(authResponse);
        doNothing().when(auditService).logEvent(any(), any(), any(), any(), any());

        LoginRequest request = new LoginRequest("user@test.com", "password123");
        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("test-access-token", response.accessToken());
        assertEquals("test-id-token", response.idToken());
        assertEquals("test-refresh-token", response.refreshToken());
        assertEquals(900, response.expiresIn());
    }

    @Test
    void login_mfaRequired_returnsChallengeResponse() {
        AdminInitiateAuthResponse authResponse = AdminInitiateAuthResponse.builder()
                .challengeName(ChallengeNameType.SOFTWARE_TOKEN_MFA)
                .session("test-session")
                .build();

        when(cognitoClient.adminInitiateAuth(any(AdminInitiateAuthRequest.class)))
                .thenReturn(authResponse);
        doNothing().when(auditService).logEvent(any(), any(), any(), any(), any());

        LoginRequest request = new LoginRequest("user@test.com", "password123");
        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("SOFTWARE_TOKEN_MFA", response.challengeName());
        assertEquals("test-session", response.session());
        assertNull(response.accessToken());
    }

    @Test
    void login_newPasswordRequired_returnsChallengeResponse() {
        AdminInitiateAuthResponse authResponse = AdminInitiateAuthResponse.builder()
                .challengeName(ChallengeNameType.NEW_PASSWORD_REQUIRED)
                .session("test-session")
                .build();

        when(cognitoClient.adminInitiateAuth(any(AdminInitiateAuthRequest.class)))
                .thenReturn(authResponse);
        doNothing().when(auditService).logEvent(any(), any(), any(), any(), any());

        LoginRequest request = new LoginRequest("user@test.com", "password123");
        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("NEW_PASSWORD_REQUIRED", response.challengeName());
    }

    @Test
    void login_invalidCredentials_throwsSecurityException() {
        when(cognitoClient.adminInitiateAuth(any(AdminInitiateAuthRequest.class)))
                .thenThrow(NotAuthorizedException.builder()
                        .message("Incorrect username or password")
                        .build());
        doNothing().when(auditService).logEvent(any(), any(), any(), any(), any());

        LoginRequest request = new LoginRequest("user@test.com", "wrongpassword");

        assertThrows(SecurityException.class, () -> authService.login(request));
        verify(auditService).logEvent("user@test.com", "user@test.com",
                "LOGIN_FAILED", "user@test.com", "FAILURE");
    }

    @Test
    void forgotPassword_initiateReset_returnsMessage() {
        PasswordResetRequest request = new PasswordResetRequest(
                "user@test.com", null, null);

        doNothing().when(auditService).logEvent(any(), any(), any(), any(), any());

        AuthResponse response = authService.forgotPassword(request);

        assertNotNull(response);
        assertEquals("Password reset code sent to email", response.message());
    }

    @Test
    void changePassword_successful_returnsMessage() {
        ChangePasswordRequest request = new ChangePasswordRequest(
                "test-token", "oldpass", "NewPassword123!");

        doNothing().when(auditService).logEvent(any(), any(), any(), any(), any());

        AuthResponse response = authService.changePassword(request);

        assertNotNull(response);
        assertEquals("Password changed successfully", response.message());
    }
}
