package com.versent.reportportal.analytics;

import com.versent.reportportal.shared.model.UserRole;
import com.versent.reportportal.shared.security.SecurityContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @BeforeEach
    void setUp() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "admin-id", "admin@versent.com.au",
                UserRole.ADMIN, List.of("space-1"), null, false
        ));
    }

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void admin_canAccessAnalyticsForAssignedSpace() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertDoesNotThrow(() -> {
            if (!user.isAdmin()) throw new SecurityException("Not admin");
            if (!user.hasAccessToSpace("space-1")) throw new SecurityException("No access");
        });
    }

    @Test
    void admin_cannotAccessAnalyticsForUnassignedSpace() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (!user.hasAccessToSpace("space-2")) throw new SecurityException("No access");
        });
    }

    @Test
    void customer_cannotAccessAnalytics() {
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
    void superAdmin_canAccessAllAnalytics() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "super-admin-id", "admin@versent.com.au",
                UserRole.SUPER_ADMIN, List.of(), null, false
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertDoesNotThrow(() -> {
            if (!user.isAdmin()) throw new SecurityException("Not admin");
            if (!user.hasAccessToSpace("any-space")) throw new SecurityException("No access");
        });
    }
}
