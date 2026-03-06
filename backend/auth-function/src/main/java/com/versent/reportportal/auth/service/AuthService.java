package com.versent.reportportal.auth.service;

import com.versent.reportportal.auth.dto.AuthResponse;
import com.versent.reportportal.auth.dto.ChangePasswordRequest;
import com.versent.reportportal.auth.dto.LoginRequest;
import com.versent.reportportal.auth.dto.MfaVerifyRequest;
import com.versent.reportportal.auth.dto.PasswordResetRequest;
import com.versent.reportportal.shared.service.AuditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminInitiateAuthRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminInitiateAuthResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminRespondToAuthChallengeRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminRespondToAuthChallengeResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AssociateSoftwareTokenRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AssociateSoftwareTokenResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthFlowType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AuthenticationResultType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ChallengeNameType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ChangePasswordRequest.Builder;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ConfirmForgotPasswordRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ForgotPasswordRequest;

import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final CognitoIdentityProviderClient cognitoClient;
    private final AuditService auditService;
    private final String userPoolId;
    private final String clientId;

    public AuthService(CognitoIdentityProviderClient cognitoClient,
                       AuditService auditService,
                       @Value("${cognito.user-pool-id}") String userPoolId,
                       @Value("${cognito.client-id}") String clientId) {
        this.cognitoClient = cognitoClient;
        this.auditService = auditService;
        this.userPoolId = userPoolId;
        this.clientId = clientId;
    }

    public AuthResponse login(LoginRequest request) {
        try {
            Map<String, String> authParams = new HashMap<>();
            authParams.put("USERNAME", request.email());
            authParams.put("PASSWORD", request.password());

            AdminInitiateAuthRequest authRequest = AdminInitiateAuthRequest.builder()
                    .userPoolId(userPoolId)
                    .clientId(clientId)
                    .authFlow(AuthFlowType.ADMIN_USER_PASSWORD_AUTH)
                    .authParameters(authParams)
                    .build();

            AdminInitiateAuthResponse authResponse = cognitoClient.adminInitiateAuth(authRequest);

            if (authResponse.challengeName() != null) {
                String challengeName = authResponse.challengeNameAsString();

                if ("NEW_PASSWORD_REQUIRED".equals(challengeName)) {
                    auditService.logEvent(request.email(), request.email(),
                            "LOGIN_NEW_PASSWORD_REQUIRED", request.email(), "CHALLENGE");
                    return AuthResponse.challenge(challengeName, authResponse.session());
                }

                if ("SOFTWARE_TOKEN_MFA".equals(challengeName) || "SMS_MFA".equals(challengeName)) {
                    auditService.logEvent(request.email(), request.email(),
                            "LOGIN_MFA_REQUIRED", request.email(), "CHALLENGE");
                    return AuthResponse.challenge(challengeName, authResponse.session());
                }

                if ("MFA_SETUP".equals(challengeName)) {
                    AssociateSoftwareTokenResponse tokenResponse = cognitoClient.associateSoftwareToken(
                            AssociateSoftwareTokenRequest.builder()
                                    .session(authResponse.session())
                                    .build());
                    auditService.logEvent(request.email(), request.email(),
                            "LOGIN_MFA_SETUP", request.email(), "CHALLENGE");
                    return AuthResponse.mfaSetup(tokenResponse.session(), tokenResponse.secretCode());
                }

                return AuthResponse.challenge(challengeName, authResponse.session());
            }

            AuthenticationResultType result = authResponse.authenticationResult();
            auditService.logEvent(request.email(), request.email(),
                    "LOGIN_SUCCESS", request.email(), "SUCCESS");

            return AuthResponse.tokens(
                    result.accessToken(),
                    result.idToken(),
                    result.refreshToken(),
                    result.expiresIn()
            );

        } catch (Exception e) {
            log.error("Login failed for user: {}", request.email(), e);
            auditService.logEvent(request.email(), request.email(),
                    "LOGIN_FAILED", request.email(), "FAILURE");
            throw new SecurityException("Authentication failed: " + e.getMessage());
        }
    }

    public AuthResponse verifyMfa(MfaVerifyRequest request) {
        try {
            Map<String, String> challengeResponses = new HashMap<>();

            ChallengeNameType challengeType = ChallengeNameType.fromValue(request.challengeName());

            if (challengeType == ChallengeNameType.SOFTWARE_TOKEN_MFA) {
                challengeResponses.put("SOFTWARE_TOKEN_MFA_CODE", request.mfaCode());
                challengeResponses.put("USERNAME", "dummy");
            } else if (challengeType == ChallengeNameType.SMS_MFA) {
                challengeResponses.put("SMS_MFA_CODE", request.mfaCode());
                challengeResponses.put("USERNAME", "dummy");
            }

            AdminRespondToAuthChallengeRequest challengeRequest = AdminRespondToAuthChallengeRequest.builder()
                    .userPoolId(userPoolId)
                    .clientId(clientId)
                    .challengeName(challengeType)
                    .session(request.session())
                    .challengeResponses(challengeResponses)
                    .build();

            AdminRespondToAuthChallengeResponse response = cognitoClient.adminRespondToAuthChallenge(challengeRequest);

            if (response.authenticationResult() != null) {
                AuthenticationResultType result = response.authenticationResult();
                return AuthResponse.tokens(
                        result.accessToken(),
                        result.idToken(),
                        result.refreshToken(),
                        result.expiresIn()
                );
            }

            if (response.challengeName() != null) {
                return AuthResponse.challenge(response.challengeNameAsString(), response.session());
            }

            throw new SecurityException("Unexpected MFA response");

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            log.error("MFA verification failed", e);
            throw new SecurityException("MFA verification failed: " + e.getMessage());
        }
    }

    public AuthResponse forgotPassword(PasswordResetRequest request) {
        try {
            if (request.confirmationCode() != null && request.newPassword() != null) {
                cognitoClient.confirmForgotPassword(ConfirmForgotPasswordRequest.builder()
                        .clientId(clientId)
                        .username(request.email())
                        .confirmationCode(request.confirmationCode())
                        .password(request.newPassword())
                        .build());

                auditService.logEvent(request.email(), request.email(),
                        "PASSWORD_RESET_CONFIRMED", request.email(), "SUCCESS");
                return AuthResponse.message("Password reset successful");
            }

            cognitoClient.forgotPassword(ForgotPasswordRequest.builder()
                    .clientId(clientId)
                    .username(request.email())
                    .build());

            auditService.logEvent(request.email(), request.email(),
                    "PASSWORD_RESET_REQUESTED", request.email(), "SUCCESS");
            return AuthResponse.message("Password reset code sent to email");

        } catch (Exception e) {
            log.error("Forgot password failed for: {}", request.email(), e);
            throw new SecurityException("Password reset failed: " + e.getMessage());
        }
    }

    public AuthResponse changePassword(ChangePasswordRequest request) {
        try {
            cognitoClient.changePassword(software.amazon.awssdk.services.cognitoidentityprovider.model
                    .ChangePasswordRequest.builder()
                    .accessToken(request.accessToken())
                    .previousPassword(request.previousPassword())
                    .proposedPassword(request.newPassword())
                    .build());

            auditService.logEvent("authenticated_user", "authenticated_user",
                    "PASSWORD_CHANGED", "self", "SUCCESS");
            return AuthResponse.message("Password changed successfully");

        } catch (Exception e) {
            log.error("Change password failed", e);
            throw new SecurityException("Password change failed: " + e.getMessage());
        }
    }

    public AuthResponse firstLogin(String session, String newPassword, String mfaCode) {
        try {
            Map<String, String> challengeResponses = new HashMap<>();
            challengeResponses.put("NEW_PASSWORD", newPassword);
            challengeResponses.put("USERNAME", "dummy");

            AdminRespondToAuthChallengeResponse response = cognitoClient.adminRespondToAuthChallenge(
                    AdminRespondToAuthChallengeRequest.builder()
                            .userPoolId(userPoolId)
                            .clientId(clientId)
                            .challengeName(ChallengeNameType.NEW_PASSWORD_REQUIRED)
                            .session(session)
                            .challengeResponses(challengeResponses)
                            .build());

            if (response.challengeName() == ChallengeNameType.MFA_SETUP) {
                AssociateSoftwareTokenResponse tokenResponse = cognitoClient.associateSoftwareToken(
                        AssociateSoftwareTokenRequest.builder()
                                .session(response.session())
                                .build());
                return AuthResponse.mfaSetup(tokenResponse.session(), tokenResponse.secretCode());
            }

            if (response.authenticationResult() != null) {
                AuthenticationResultType result = response.authenticationResult();
                return AuthResponse.tokens(
                        result.accessToken(),
                        result.idToken(),
                        result.refreshToken(),
                        result.expiresIn()
                );
            }

            if (response.challengeName() != null) {
                return AuthResponse.challenge(response.challengeNameAsString(), response.session());
            }

            throw new SecurityException("Unexpected first login response");

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            log.error("First login flow failed", e);
            throw new SecurityException("First login failed: " + e.getMessage());
        }
    }
}
