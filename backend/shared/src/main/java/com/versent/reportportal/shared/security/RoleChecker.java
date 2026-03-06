package com.versent.reportportal.shared.security;

import com.versent.reportportal.shared.model.UserRole;
import org.springframework.stereotype.Component;

@Component
public class RoleChecker {

    public void requireSuperAdmin() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        if (user.role() != UserRole.SUPER_ADMIN) {
            throw new SecurityException("This operation requires SUPER_ADMIN role");
        }
    }

    public void requireAdmin() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        if (user.role() != UserRole.ADMIN && user.role() != UserRole.SUPER_ADMIN) {
            throw new SecurityException("This operation requires ADMIN or SUPER_ADMIN role");
        }
    }

    public void requireCustomer() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        if (user.role() != UserRole.CUSTOMER) {
            throw new SecurityException("This operation requires CUSTOMER role");
        }
    }

    public void requireSpaceAccess(String spaceId) {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        if (!user.hasAccessToSpace(spaceId)) {
            throw new SecurityException("User does not have access to space: " + spaceId);
        }
    }

    public void requireNotReadOnly() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        if (user.readOnly()) {
            throw new SecurityException("Write operations are not permitted in read-only mode");
        }
    }

    public void requireAdminWithSpaceAccess(String spaceId) {
        requireAdmin();
        requireSpaceAccess(spaceId);
    }

    public void requireCustomerWithSpaceAccess(String spaceId) {
        requireCustomer();
        requireSpaceAccess(spaceId);
    }

    public boolean isSuperAdmin() {
        try {
            return SecurityContext.getCurrentUser().isSuperAdmin();
        } catch (SecurityException e) {
            return false;
        }
    }

    public boolean isAdmin() {
        try {
            return SecurityContext.getCurrentUser().isAdmin();
        } catch (SecurityException e) {
            return false;
        }
    }

    public boolean hasSpaceAccess(String spaceId) {
        try {
            return SecurityContext.getCurrentUser().hasAccessToSpace(spaceId);
        } catch (SecurityException e) {
            return false;
        }
    }
}
