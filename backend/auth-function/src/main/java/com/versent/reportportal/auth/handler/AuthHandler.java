package com.versent.reportportal.auth.handler;

import com.versent.reportportal.auth.dto.AuthResponse;
import com.versent.reportportal.auth.dto.ChangePasswordRequest;
import com.versent.reportportal.auth.dto.LoginRequest;
import com.versent.reportportal.auth.dto.MfaVerifyRequest;
import com.versent.reportportal.auth.dto.PasswordResetRequest;
import com.versent.reportportal.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.function.Function;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.auth",
        "com.versent.reportportal.shared"
})
@RestController
@RequestMapping("/auth")
public class AuthHandler {

    private final AuthService authService;

    public AuthHandler(AuthService authService) {
        this.authService = authService;
    }

    public static void main(String[] args) {
        SpringApplication.run(AuthHandler.class, args);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/mfa-verify")
    public ResponseEntity<AuthResponse> mfaVerify(@Valid @RequestBody MfaVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyMfa(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<AuthResponse> forgotPassword(@Valid @RequestBody PasswordResetRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<AuthResponse> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(authService.changePassword(request));
    }

    @PostMapping("/first-login")
    public ResponseEntity<AuthResponse> firstLogin(@RequestBody Map<String, String> request) {
        return ResponseEntity.ok(authService.firstLogin(
                request.get("session"),
                request.get("newPassword"),
                request.get("mfaCode")
        ));
    }

    @Bean
    public Function<Map<String, Object>, ResponseEntity<?>> authFunction() {
        return request -> {
            String path = (String) request.getOrDefault("path", "");
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) request.getOrDefault("body", Map.of());

            return switch (path) {
                case "/auth/login" -> ResponseEntity.ok(authService.login(
                        new LoginRequest(body.get("email"), body.get("password"))));
                case "/auth/mfa-verify" -> ResponseEntity.ok(authService.verifyMfa(
                        new MfaVerifyRequest(body.get("session"), body.get("mfaCode"),
                                body.get("challengeName"))));
                case "/auth/forgot-password" -> ResponseEntity.ok(authService.forgotPassword(
                        new PasswordResetRequest(body.get("email"),
                                body.get("confirmationCode"), body.get("newPassword"))));
                case "/auth/change-password" -> ResponseEntity.ok(authService.changePassword(
                        new ChangePasswordRequest(body.get("accessToken"),
                                body.get("previousPassword"), body.get("newPassword"))));
                case "/auth/first-login" -> ResponseEntity.ok(authService.firstLogin(
                        body.get("session"), body.get("newPassword"), body.get("mfaCode")));
                default -> ResponseEntity.notFound().build();
            };
        };
    }
}
