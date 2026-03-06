package com.versent.reportportal.customer;

import com.versent.reportportal.shared.model.UserRole;
import com.versent.reportportal.shared.security.SecurityContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    @BeforeEach
    void setUp() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1", "space-2"), null, false
        ));
    }

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void customer_canAccessAssignedSpace() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertTrue(user.hasAccessToSpace("space-1"));
        assertTrue(user.hasAccessToSpace("space-2"));
    }

    @Test
    void customer_cannotAccessUnassignedSpace() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertFalse(user.hasAccessToSpace("space-3"));
    }

    @Test
    void customer_isNotAdmin() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertFalse(user.isAdmin());
        assertFalse(user.isSuperAdmin());
        assertTrue(user.isCustomer());
    }

    @Test
    void impersonatedCustomer_cannotWrite() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1"),
                "super-admin-id", true
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertTrue(user.isImpersonating());
        assertTrue(user.readOnly());
    }

    @Test
    void customer_spaceAccessEnforced() {
        assertThrows(SecurityException.class, () -> {
            SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
            if (!user.hasAccessToSpace("unauthorized-space")) {
                throw new SecurityException("Access denied");
            }
        });
    }

    @Test
    void customer_assignedSpaceAccessAllowed() {
        assertDoesNotThrow(() -> {
            SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
            if (!user.hasAccessToSpace("space-1")) {
                throw new SecurityException("Access denied");
            }
        });
    }
}
