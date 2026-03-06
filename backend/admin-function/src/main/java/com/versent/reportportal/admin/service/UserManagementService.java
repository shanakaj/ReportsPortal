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
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
import com.versent.reportportal.shared.service.EmailService;
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
    private static final String VERSENT_DOMAIN = "@versent.com.au";

    private final DynamoDbTable<UserEntity> userTable;
    private final DynamoDbTable<InvitationEntity> invitationTable;
    private final CognitoIdentityProviderClient cognitoClient;
    private final EmailService emailService;
    private final AuditService auditService;
    private final SpaceService spaceService;
    private final String userPoolId;
    private final String portalBaseUrl;

    public UserManagementService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                                 CognitoIdentityProviderClient cognitoClient,
                                 EmailService emailService,
                                 AuditService auditService,
                                 SpaceService spaceService,
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
        this.userPoolId = userPoolId;
        this.portalBaseUrl = portalBaseUrl;
    }

    public void inviteCustomer(String spaceId, InviteUserRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        SpaceEntity space = spaceService.getSpaceEntity(spaceId);

        String emailDomain = request.email().substring(request.email().indexOf("@"));
        boolean isDomainMismatch = !emailDomain.equals(VERSENT_DOMAIN) &&
                !space.getSpaceName().contains(emailDomain.substring(1).split("\\.")[0]);

        if (isDomainMismatch && !request.domainMismatchConfirmed()) {
            throw new ValidationException(
                    "Email domain does not match space name. Set domainMismatchConfirmed=true to proceed.");
        }

        String token = UUID.randomUUID().toString();
        Instant now = Instant.now();
        long expiresAt = now.plusSeconds(24 * 60 * 60).getEpochSecond();

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

        if (!request.email().endsWith(VERSENT_DOMAIN)) {
            throw new ValidationException("Admin emails must be @versent.com.au");
        }

        String token = UUID.randomUUID().toString();
        Instant now = Instant.now();
        long expiresAt = now.plusSeconds(24 * 60 * 60).getEpochSecond();

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
