package com.versent.reportportal.analytics.handler;

import com.versent.reportportal.analytics.dto.ExportRequest;
import com.versent.reportportal.analytics.dto.SpaceAnalyticsResponse;
import com.versent.reportportal.analytics.dto.UserAnalyticsResponse;
import com.versent.reportportal.analytics.service.AnalyticsService;
import com.versent.reportportal.shared.security.RoleChecker;
import jakarta.validation.Valid;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.analytics",
        "com.versent.reportportal.shared"
})
@RestController
@RequestMapping("/admin/analytics")
public class AnalyticsHandler {

    private final AnalyticsService analyticsService;
    private final RoleChecker roleChecker;

    public AnalyticsHandler(AnalyticsService analyticsService, RoleChecker roleChecker) {
        this.analyticsService = analyticsService;
        this.roleChecker = roleChecker;
    }

    public static void main(String[] args) {
        SpringApplication.run(AnalyticsHandler.class, args);
    }

    @GetMapping("/spaces/{spaceId}")
    public ResponseEntity<SpaceAnalyticsResponse> getSpaceAnalytics(
            @PathVariable String spaceId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        return ResponseEntity.ok(analyticsService.getSpaceAnalytics(spaceId, from, to));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<UserAnalyticsResponse> getUserAnalytics(
            @PathVariable String userId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        roleChecker.requireAdmin();
        return ResponseEntity.ok(analyticsService.getUserAnalytics(userId, from, to));
    }

    @PostMapping("/export")
    public ResponseEntity<Map<String, String>> exportAnalytics(
            @Valid @RequestBody ExportRequest request) {
        roleChecker.requireAdmin();
        String presignedUrl = analyticsService.exportAnalytics(
                request.spaceId(), request.from(), request.to(), request.format());
        return ResponseEntity.ok(Map.of("downloadUrl", presignedUrl));
    }
}
