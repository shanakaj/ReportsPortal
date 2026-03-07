package com.versent.reportportal.admin.service;

import com.versent.reportportal.admin.dto.InviteAdminRequest;
import com.versent.reportportal.admin.dto.InviteUserRequest;
import com.versent.reportportal.admin.dto.UserResponse;
import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.exception.ResourceNotFoundException;
import com.versent.reportportal.shared.exception.ValidationException;
import com.versent.reportportal.shared.model.InvitationEntity;
import com.versent.reportportal.shared.model.SpaceEntity;
import com.versent.reportportal.shared.model.UserEntity;
import com.versent.reportportal.shared.model.UserRole;
import com.versent.reportportal.shared.model.PlatformSettingsEntity;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
import com.versent.reportportal.shared.service.EmailService;
import com.versent.reportportal.shared.service.PlatformSettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.ScanEnhancedRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminDisableUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminEnableUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminDeleteUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminSetUserMfaPreferenceRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminSetUserPasswordRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.SMSMfaSettingsType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.SoftwareTokenMfaSettingsType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@Service
public class UserManagementService {

    private static final Logger log = LoggerFactory.getLogger(UserManagementService.class);

    private final DynamoDbTable<UserEntity> userTable;
    private final DynamoDbTable<InvitationEntity> invitationTable;
    private final CognitoIdentityProviderClient cognitoClient;
    private final EmailService emailService;
    private final AuditService auditService;
    private final SpaceService spaceService;
    private final PlatformSettingsService platformSettingsService;
    private final String userPoolId;
    private final String portalBaseUrl;

    public UserManagementService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                                 CognitoIdentityProviderClient cognitoClient,
                                 EmailService emailService,
                                 AuditService auditService,
                                 SpaceService spaceService,
                                 PlatformSettingsService platformSettingsService,
                                 @Value("${dynamodb.tables.users:ReportPortal-Users}") String userTableName,
                                 @Value("${dynamodb.tables.invitations:ReportPortal-Invitations}") String invitationTableName,
                                 @Value("${cognito.user-pool-id}") String userPoolId,
                                 @Value("${portal.base-url:https://reports.yourdomain.com}") String portalBaseUrl) {
        this.userTable = dynamoDbEnhancedClient.table(userTableName,
                TableSchema.fromBean(UserEntity.class));
        this.invitationTable = dynamoDbEnhancedClient.table(invitationTableName,
                TableSchema.fromBean(InvitationEntity.class));
        this.cognitoClient = cognitoClient;
        this.emailService = emailService;
        this.auditService = auditService;
        this.spaceService = spaceService;
        this.platformSettingsService = platformSettingsService;
        this.userPoolId = userPoolId;
        this.portalBaseUrl = portalBaseUrl;
    }

    public void inviteCustomer(String spaceId, InviteUserRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        SpaceEntity space = spaceService.getSpaceEntity(spaceId);
        PlatformSettingsEntity settings = platformSettingsService.getSettings();

        String emailDomain = request.email().substring(request.email().indexOf("@") + 1);
        boolean isAdminDomain = settings.getAllowedAdminDomains().stream()
                .anyMatch(d -> emailDomain.equalsIgnoreCase(d));

        boolean isDomainMismatch = false;
        if (!isAdminDomain) {
            // Check against space's allowed domains first, then fall back to space name matching
            List<String> spaceDomains = space.getAllowedCustomerDomains();
            if (spaceDomains != null && !spaceDomains.isEmpty()) {
                isDomainMismatch = spaceDomains.stream()
                        .noneMatch(d -> emailDomain.equalsIgnoreCase(d));
            } else {
                String emailDomainBase = emailDomain.split("\\.")[0].toLowerCase();
                isDomainMismatch = !space.getSpaceName().toLowerCase().contains(emailDomainBase);
            }
        }

        String validationMode = settings.getDomainValidationMode();
        if (isDomainMismatch) {
            if ("strict".equals(validationMode)) {
                throw new ValidationException(
                        "Email domain does not match space. Domain validation is set to strict mode.");
            }
            if ("warn".equals(validationMode) && !request.domainMismatchConfirmed()) {
                throw new ValidationException(
                        "Email domain does not match space name. Set domainMismatchConfirmed=true to proceed.");
            }
        }

        String token = UUID.randomUUID().toString();
        Instant now = Instant.now();
        int expiryHours = settings.getInvitationExpiryHours() != null
                ? settings.getInvitationExpiryHours() : 24;
        long expiresAt = now.plusSeconds((long) expiryHours * 60 * 60).getEpochSecond();

        InvitationEntity invitation = new InvitationEntity();
        invitation.setPk(InvitationEntity.buildPk(token));
        invitation.setSk(InvitationEntity.SORT_KEY);
        invitation.setToken(token);
        invitation.setEmail(request.email());
        invitation.setTargetSpaceId(spaceId);
        invitation.setRole(UserRole.CUSTOMER);
        invitation.setInvitedBy(currentUser.userId());
        invitation.setCreatedAt(now);
        invitation.setExpiresAt(expiresAt);
        invitation.setStatus("PENDING");

        invitationTable.putItem(invitation);

        String inviteLink = portalBaseUrl + "/register?token=" + token;
        emailService.sendInvitationEmail(request.email(), space.getSpaceName(), inviteLink);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "CUSTOMER_INVITED", request.email() + " -> " + spaceId, "SUCCESS");
    }

    public void inviteAdmin(InviteAdminRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        PlatformSettingsEntity settings = platformSettingsService.getSettings();

        List<String> allowedDomains = settings.getAllowedAdminDomains();
        String emailDomain = request.email().substring(request.email().indexOf("@") + 1);
        boolean domainAllowed = allowedDomains.stream()
                .anyMatch(d -> emailDomain.equalsIgnoreCase(d));
        if (!domainAllowed) {
            throw new ValidationException("Admin emails must use one of: " +
                    String.join(", ", allowedDomains.stream().map(d -> "@" + d).toList()));
        }

        String token = UUID.randomUUID().toString();
        Instant now = Instant.now();
        int expiryHours = settings.getInvitationExpiryHours() != null
                ? settings.getInvitationExpiryHours() : 24;
        long expiresAt = now.plusSeconds((long) expiryHours * 60 * 60).getEpochSecond();

        InvitationEntity invitation = new InvitationEntity();
        invitation.setPk(InvitationEntity.buildPk(token));
        invitation.setSk(InvitationEntity.SORT_KEY);
        invitation.setToken(token);
        invitation.setEmail(request.email());
        invitation.setRole(UserRole.ADMIN);
        invitation.setInvitedBy(currentUser.userId());
        invitation.setCreatedAt(now);
        invitation.setExpiresAt(expiresAt);
        invitation.setStatus("PENDING");

        invitationTable.putItem(invitation);

        String inviteLink = portalBaseUrl + "/admin/register?token=" + token;
        emailService.sendAdminInvitationEmail(request.email(), inviteLink);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "ADMIN_INVITED", request.email(), "SUCCESS");
    }

    public PaginatedResponse<UserResponse> listUsers(String role, String spaceId,
                                                     String cursor, int limit) {
        ScanEnhancedRequest.Builder scanBuilder = ScanEnhancedRequest.builder()
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            scanBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<UserEntity>> pages = userTable.scan(scanBuilder.build()).iterator();

        List<UserResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<UserEntity> page = pages.next();
            items = page.items().stream()
                    .filter(e -> UserEntity.SORT_KEY.equals(e.getSk()))
                    .filter(e -> role == null || e.getRole().name().equalsIgnoreCase(role))
                    .filter(e -> spaceId == null || (e.getCustomerSpaces() != null &&
                            e.getCustomerSpaces().contains(spaceId)))
                    .map(this::toResponse)
                    .toList();

            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    public void disableUser(String userId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        UserEntity user = getUser(userId);

        cognitoClient.adminDisableUser(AdminDisableUserRequest.builder()
                .userPoolId(userPoolId)
                .username(user.getEmail())
                .build());

        user.setStatus("DISABLED");
        userTable.putItem(user);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "USER_DISABLED", userId, "SUCCESS");
    }

    public void enableUser(String userId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        UserEntity user = getUser(userId);

        cognitoClient.adminEnableUser(AdminEnableUserRequest.builder()
                .userPoolId(userPoolId)
                .username(user.getEmail())
                .build());

        user.setStatus("ACTIVE");
        userTable.putItem(user);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "USER_ENABLED", userId, "SUCCESS");
    }

    public void deleteUser(String userId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        UserEntity user = getUser(userId);

        cognitoClient.adminDeleteUser(AdminDeleteUserRequest.builder()
                .userPoolId(userPoolId)
                .username(user.getEmail())
                .build());

        userTable.deleteItem(Key.builder()
                .partitionValue(UserEntity.buildPk(userId))
                .sortValue(UserEntity.SORT_KEY)
                .build());

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "USER_DELETED", userId, "SUCCESS");
    }

    public String resetPassword(String userId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        UserEntity user = getUser(userId);

        String tempPassword = generateTempPassword();

        // Set temporary password (user must change on next login)
        cognitoClient.adminSetUserPassword(AdminSetUserPasswordRequest.builder()
                .userPoolId(userPoolId)
                .username(user.getEmail())
                .password(tempPassword)
                .permanent(false)
                .build());

        // Also reset MFA so user can set up a new device after password change
        cognitoClient.adminSetUserMFAPreference(AdminSetUserMfaPreferenceRequest.builder()
                .userPoolId(userPoolId)
                .username(user.getEmail())
                .softwareTokenMfaSettings(SoftwareTokenMfaSettingsType.builder()
                        .enabled(false)
                        .preferredMfa(false)
                        .build())
                .smsMfaSettings(SMSMfaSettingsType.builder()
                        .enabled(false)
                        .preferredMfa(false)
                        .build())
                .build());

        user.setMfaEnabled(false);
        userTable.putItem(user);

        emailService.sendPasswordResetNotification(user.getEmail());

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "PASSWORD_RESET_BY_ADMIN", userId, "SUCCESS");

        log.info("Password and MFA reset for user: {} by admin: {}", userId, currentUser.email());
        return tempPassword;
    }

    private String generateTempPassword() {
        String upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lower = "abcdefghijklmnopqrstuvwxyz";
        String digits = "0123456789";
        String special = "!@#$%^&*";
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder sb = new StringBuilder(16);
        sb.append(upper.charAt(random.nextInt(upper.length())));
        sb.append(lower.charAt(random.nextInt(lower.length())));
        sb.append(digits.charAt(random.nextInt(digits.length())));
        sb.append(special.charAt(random.nextInt(special.length())));
        String all = upper + lower + digits + special;
        for (int i = 4; i < 16; i++) {
            sb.append(all.charAt(random.nextInt(all.length())));
        }
        char[] chars = sb.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }

    public void resetMfa(String userId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        UserEntity user = getUser(userId);

        cognitoClient.adminSetUserMFAPreference(AdminSetUserMfaPreferenceRequest.builder()
                .userPoolId(userPoolId)
                .username(user.getEmail())
                .softwareTokenMfaSettings(SoftwareTokenMfaSettingsType.builder()
                        .enabled(false)
                        .preferredMfa(false)
                        .build())
                .smsMfaSettings(SMSMfaSettingsType.builder()
                        .enabled(false)
                        .preferredMfa(false)
                        .build())
                .build());

        user.setMfaEnabled(false);
        userTable.putItem(user);

        emailService.sendMfaResetNotification(user.getEmail());

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "MFA_RESET", userId, "SUCCESS");
    }

    private UserEntity getUser(String userId) {
        UserEntity user = userTable.getItem(Key.builder()
                .partitionValue(UserEntity.buildPk(userId))
                .sortValue(UserEntity.SORT_KEY)
                .build());

        if (user == null) {
            throw new ResourceNotFoundException("User not found: " + userId);
        }

        return user;
    }

    private UserResponse toResponse(UserEntity entity) {
        return new UserResponse(
                entity.getUserId(),
                entity.getEmail(),
                entity.getFullName(),
                entity.getPhone(),
                entity.getCompany(),
                entity.getRole() != null ? entity.getRole().name() : null,
                entity.getCustomerSpaces(),
                entity.getStatus(),
                entity.getMfaEnabled(),
                entity.getCreatedAt(),
                entity.getLastLogin()
        );
    }
}
