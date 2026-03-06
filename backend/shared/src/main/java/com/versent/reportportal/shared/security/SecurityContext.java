package com.versent.reportportal.shared.security;

import com.versent.reportportal.shared.model.UserRole;

import java.util.List;

public class SecurityContext {

    private static final ThreadLocal<AuthenticatedUser> CURRENT_USER = new ThreadLocal<>();

    public static void setCurrentUser(AuthenticatedUser user) {
        CURRENT_USER.set(user);
    }

    public static AuthenticatedUser getCurrentUser() {
        AuthenticatedUser user = CURRENT_USER.get();
        if (user == null) {
            throw new SecurityException("No authenticated user in context");
        }
        return user;
    }

    public static void clear() {
        CURRENT_USER.remove();
    }

    public record AuthenticatedUser(
            String userId,
            String email,
            UserRole role,
            List<String> customerSpaces,
            String impersonatorId,
            boolean readOnly
    ) {
        public boolean isImpersonating() {
            return impersonatorId != null && !impersonatorId.isBlank();
        }

        public boolean isSuperAdmin() {
            return role == UserRole.SUPER_ADMIN;
        }

        public boolean isAdmin() {
            return role == UserRole.ADMIN || role == UserRole.SUPER_ADMIN;
        }

        public boolean isCustomer() {
            return role == UserRole.CUSTOMER;
        }

        public boolean hasAccessToSpace(String spaceId) {
            if (role == UserRole.SUPER_ADMIN) {
                return true;
            }
            return customerSpaces != null && customerSpaces.contains(spaceId);
        }
    }
}
