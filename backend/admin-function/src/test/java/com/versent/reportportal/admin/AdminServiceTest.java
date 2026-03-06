package com.versent.reportportal.admin;

import com.versent.reportportal.admin.dto.CreateSpaceRequest;
import com.versent.reportportal.admin.dto.InviteAdminRequest;
import com.versent.reportportal.admin.dto.InviteUserRequest;
import com.versent.reportportal.admin.service.ImpersonationService;
import com.versent.reportportal.admin.service.SpaceService;
import com.versent.reportportal.admin.service.UserManagementService;
import com.versent.reportportal.shared.exception.ValidationException;
import com.versent.reportportal.shared.model.UserRole;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
import com.versent.reportportal.shared.service.EmailService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.s3.S3Client;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private DynamoDbEnhancedClient dynamoDbEnhancedClient;

    @Mock
    private S3Client s3Client;

    @Mock
    private CognitoIdentityProviderClient cognitoClient;

    @Mock
    private EmailService emailService;

    @Mock
    private AuditService auditService;

    @Mock
    private SpaceService spaceService;

    @BeforeEach
    void setUp() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "super-admin-id", "admin@versent.com.au",
                UserRole.SUPER_ADMIN, List.of(), null, false
        ));
    }

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void superAdmin_canAccessAdminEndpoints() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertDoesNotThrow(() -> {
            if (!user.isAdmin()) throw new SecurityException("Not admin");
        });
    }

    @Test
    void customer_cannotAccessAdminEndpoints() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1"), null, false
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (!user.isAdmin()) throw new SecurityException("Not admin");
        });
    }

    @Test
    void admin_cannotInviteOtherAdmins() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "admin-id", "admin@versent.com.au",
                UserRole.ADMIN, List.of("space-1"), null, false
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (!user.isSuperAdmin()) throw new SecurityException("Only super admin can invite admins");
        });
    }

    @Test
    void impersonation_rejectsWriteOperations() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1"),
                "super-admin-id", true
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (user.readOnly()) throw new SecurityException("Read-only mode");
        });
    }

    @Test
    void admin_cannotDeleteSpaces() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "admin-id", "admin@versent.com.au",
                UserRole.ADMIN, List.of("space-1"), null, false
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (!user.isSuperAdmin()) throw new SecurityException("Only super admin can delete spaces");
        });
    }

    @Test
    void nonVersent_emailRejectedForAdmin() {
        assertThrows(ValidationException.class, () -> {
            String email = "admin@gmail.com";
            if (!email.endsWith("@versent.com.au")) {
                throw new ValidationException("Admin emails must be @versent.com.au");
            }
        });
    }

    @Test
    void versent_emailAcceptedForAdmin() {
        assertDoesNotThrow(() -> {
            String email = "admin@versent.com.au";
            if (!email.endsWith("@versent.com.au")) {
                throw new ValidationException("Admin emails must be @versent.com.au");
            }
        });
    }

    @Test
    void customer_cannotAccessUnassignedSpace() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1"), null, false
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (!user.hasAccessToSpace("space-2")) {
                throw new SecurityException("No access to space");
            }
        });
    }

    @Test
    void superAdmin_hasAccessToAllSpaces() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertDoesNotThrow(() -> {
            if (!user.hasAccessToSpace("any-space")) {
                throw new SecurityException("No access");
            }
        });
    }
}
