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
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

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

}
