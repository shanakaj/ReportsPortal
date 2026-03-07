package com.versent.reportportal.admin.handler;

import com.versent.reportportal.admin.dto.CreateSpaceRequest;
import com.versent.reportportal.admin.dto.ImpersonationResponse;
import com.versent.reportportal.admin.dto.InviteAdminRequest;
import com.versent.reportportal.admin.dto.InviteUserRequest;
import com.versent.reportportal.admin.dto.PlatformSettingsRequest;
import com.versent.reportportal.admin.dto.PlatformSettingsResponse;
import com.versent.reportportal.admin.dto.ReportResponse;
import com.versent.reportportal.admin.dto.ReportViewResponse;
import com.versent.reportportal.admin.dto.SpaceResponse;
import com.versent.reportportal.admin.dto.UploadReportRequest;
import com.versent.reportportal.admin.dto.UploadReportResponse;
import com.versent.reportportal.admin.dto.UserResponse;
import com.versent.reportportal.admin.service.ImpersonationService;
import com.versent.reportportal.admin.service.ReportService;
import com.versent.reportportal.admin.service.SpaceService;
import com.versent.reportportal.admin.service.UserManagementService;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.model.PlatformSettingsEntity;
import com.versent.reportportal.shared.security.RoleChecker;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.PlatformSettingsService;
import jakarta.validation.Valid;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.admin",
        "com.versent.reportportal.shared"
})
@RestController
@RequestMapping("/admin")
public class AdminHandler {

    private final SpaceService spaceService;
    private final ReportService reportService;
    private final UserManagementService userManagementService;
    private final ImpersonationService impersonationService;
    private final PlatformSettingsService platformSettingsService;
    private final RoleChecker roleChecker;

    public AdminHandler(SpaceService spaceService,
                        ReportService reportService,
                        UserManagementService userManagementService,
                        ImpersonationService impersonationService,
                        PlatformSettingsService platformSettingsService,
                        RoleChecker roleChecker) {
        this.spaceService = spaceService;
        this.reportService = reportService;
        this.userManagementService = userManagementService;
        this.impersonationService = impersonationService;
        this.platformSettingsService = platformSettingsService;
        this.roleChecker = roleChecker;
    }

    public static void main(String[] args) {
        SpringApplication.run(AdminHandler.class, args);
    }

    // Space endpoints

    @GetMapping("/spaces")
    public ResponseEntity<PaginatedResponse<SpaceResponse>> listSpaces(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        roleChecker.requireAdmin();
        return ResponseEntity.ok(spaceService.listSpaces(cursor, Math.min(limit, 100)));
    }

    @PostMapping("/spaces")
    public ResponseEntity<SpaceResponse> createSpace(@Valid @RequestBody CreateSpaceRequest request) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        return ResponseEntity.status(HttpStatus.CREATED).body(spaceService.createSpace(request));
    }

    @DeleteMapping("/spaces/{spaceId}")
    public ResponseEntity<Void> deleteSpace(@PathVariable String spaceId) {
        roleChecker.requireSuperAdmin();
        roleChecker.requireNotReadOnly();
        spaceService.deleteSpace(spaceId);
        return ResponseEntity.noContent().build();
    }

    // Report endpoints

    @GetMapping("/spaces/{spaceId}/reports")
    public ResponseEntity<PaginatedResponse<ReportResponse>> listReports(
            @PathVariable String spaceId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        return ResponseEntity.ok(reportService.listReports(spaceId, cursor, Math.min(limit, 100)));
    }

    @PostMapping("/spaces/{spaceId}/reports")
    public ResponseEntity<UploadReportResponse> uploadReport(
            @PathVariable String spaceId,
            @Valid @RequestBody UploadReportRequest request) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        roleChecker.requireNotReadOnly();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reportService.initiateUpload(spaceId, request));
    }

    @GetMapping("/spaces/{spaceId}/reports/{reportId}")
    public ResponseEntity<ReportViewResponse> getReport(
            @PathVariable String spaceId,
            @PathVariable String reportId) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        return ResponseEntity.ok(reportService.getReport(spaceId, reportId));
    }

    @PostMapping("/spaces/{spaceId}/reports/{reportId}/assets")
    public ResponseEntity<UploadReportResponse> uploadReportAsset(
            @PathVariable String spaceId,
            @PathVariable String reportId,
            @Valid @RequestBody UploadReportRequest request) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        roleChecker.requireNotReadOnly();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reportService.generateAssetUploadUrl(spaceId, reportId,
                        request.fileName(), request.contentType()));
    }

    @DeleteMapping("/spaces/{spaceId}/reports/{reportId}")
    public ResponseEntity<Void> deleteReport(
            @PathVariable String spaceId,
            @PathVariable String reportId) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        roleChecker.requireNotReadOnly();
        reportService.deleteReport(spaceId, reportId);
        return ResponseEntity.noContent().build();
    }

    // User management endpoints

    @PostMapping("/spaces/{spaceId}/invite")
    public ResponseEntity<Void> inviteCustomer(
            @PathVariable String spaceId,
            @Valid @RequestBody InviteUserRequest request) {
        roleChecker.requireAdminWithSpaceAccess(spaceId);
        roleChecker.requireNotReadOnly();
        userManagementService.inviteCustomer(spaceId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping("/users")
    public ResponseEntity<PaginatedResponse<UserResponse>> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String spaceId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        roleChecker.requireAdmin();
        return ResponseEntity.ok(userManagementService.listUsers(role, spaceId, cursor,
                Math.min(limit, 100)));
    }

    @PutMapping("/users/{userId}/disable")
    public ResponseEntity<Void> disableUser(@PathVariable String userId) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        userManagementService.disableUser(userId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{userId}/enable")
    public ResponseEntity<Void> enableUser(@PathVariable String userId) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        userManagementService.enableUser(userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        userManagementService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/reset-password")
    public ResponseEntity<java.util.Map<String, String>> resetPassword(@PathVariable String userId) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        String tempPassword = userManagementService.resetPassword(userId);
        return ResponseEntity.ok(java.util.Map.of("temporaryPassword", tempPassword));
    }

    @PutMapping("/users/{userId}/reset-mfa")
    public ResponseEntity<Void> resetMfa(@PathVariable String userId) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        userManagementService.resetMfa(userId);
        return ResponseEntity.ok().build();
    }

    // Platform settings endpoints

    @GetMapping("/settings")
    public ResponseEntity<PlatformSettingsResponse> getSettings() {
        roleChecker.requireAdmin();
        PlatformSettingsEntity settings = platformSettingsService.getSettings();
        return ResponseEntity.ok(toSettingsResponse(settings));
    }

    @PutMapping("/settings")
    public ResponseEntity<PlatformSettingsResponse> updateSettings(
            @Valid @RequestBody PlatformSettingsRequest request) {
        roleChecker.requireSuperAdmin();
        roleChecker.requireNotReadOnly();

        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        PlatformSettingsEntity settings = platformSettingsService.getSettings();

        settings.setOrganizationName(request.organizationName());
        settings.setOrganizationLegalEntity(request.organizationLegalEntity());
        settings.setAllowedAdminDomains(request.allowedAdminDomains());
        settings.setDomainValidationMode(request.domainValidationMode());
        settings.setMaxReportFileSizeMb(request.maxReportFileSizeMb());
        settings.setMaxFeedbackAttachmentSizeMb(request.maxFeedbackAttachmentSizeMb());
        settings.setSignedCookieTtlHours(request.signedCookieTtlHours());
        settings.setInvitationExpiryHours(request.invitationExpiryHours());
        settings.setNotifyOnInvitationAccepted(request.notifyOnInvitationAccepted());
        settings.setNotifyFeedbackByEmail(request.notifyFeedbackByEmail());
        settings.setUpdatedBy(currentUser.email());

        PlatformSettingsEntity saved = platformSettingsService.saveSettings(settings);
        return ResponseEntity.ok(toSettingsResponse(saved));
    }

    private PlatformSettingsResponse toSettingsResponse(PlatformSettingsEntity e) {
        return new PlatformSettingsResponse(
                e.getOrganizationName(),
                e.getOrganizationLegalEntity(),
                e.getAllowedAdminDomains(),
                e.getDomainValidationMode(),
                e.getMaxReportFileSizeMb(),
                e.getMaxFeedbackAttachmentSizeMb(),
                e.getSignedCookieTtlHours(),
                e.getInvitationExpiryHours(),
                e.getNotifyOnInvitationAccepted(),
                e.getNotifyFeedbackByEmail(),
                e.getUpdatedAt(),
                e.getUpdatedBy()
        );
    }

    // Super admin only endpoints

    @PostMapping("/invite-admin")
    public ResponseEntity<Void> inviteAdmin(@Valid @RequestBody InviteAdminRequest request) {
        roleChecker.requireSuperAdmin();
        roleChecker.requireNotReadOnly();
        userManagementService.inviteAdmin(request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/impersonate/{userId}")
    public ResponseEntity<ImpersonationResponse> impersonate(@PathVariable String userId) {
        roleChecker.requireSuperAdmin();
        return ResponseEntity.ok(impersonationService.startImpersonation(userId));
    }

    @DeleteMapping("/impersonate")
    public ResponseEntity<Void> endImpersonation() {
        impersonationService.endImpersonation();
        return ResponseEntity.ok().build();
    }
}
