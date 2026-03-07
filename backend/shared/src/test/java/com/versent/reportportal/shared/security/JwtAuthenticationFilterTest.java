package com.versent.reportportal.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.versent.reportportal.shared.model.UserRole;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtValidator jwtValidator;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private JwtAuthenticationFilter filter;

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void validToken_populatesSecurityContext() throws Exception {
        SecurityContext.AuthenticatedUser expectedUser = new SecurityContext.AuthenticatedUser(
                "user-1", "admin@versent.com.au", UserRole.SUPER_ADMIN, List.of(), null, false
        );
        when(request.getHeader("Authorization")).thenReturn("Bearer valid-token");
        when(jwtValidator.validate("Bearer valid-token")).thenReturn(expectedUser);

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(jwtValidator).validate("Bearer valid-token");
    }

    @Test
    void noAuthHeader_doesNotSetContext() throws Exception {
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(jwtValidator, never()).validate(any());
    }

    @Test
    void invalidToken_continuesWithoutContext() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer invalid-token");
        when(jwtValidator.validate("Bearer invalid-token"))
                .thenThrow(new SecurityException("Invalid JWT"));

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void securityContextClearedAfterRequest() throws Exception {
        SecurityContext.AuthenticatedUser user = new SecurityContext.AuthenticatedUser(
                "user-1", "admin@versent.com.au", UserRole.SUPER_ADMIN, List.of(), null, false
        );
        when(request.getHeader("Authorization")).thenReturn("Bearer valid-token");
        when(jwtValidator.validate("Bearer valid-token")).thenReturn(user);

        filter.doFilterInternal(request, response, filterChain);

        assertThrows(SecurityException.class, SecurityContext::getCurrentUser);
    }

    @Test
    void securityContextClearedEvenOnException() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer valid-token");
        SecurityContext.AuthenticatedUser user = new SecurityContext.AuthenticatedUser(
                "user-1", "admin@versent.com.au", UserRole.SUPER_ADMIN, List.of(), null, false
        );
        when(jwtValidator.validate("Bearer valid-token")).thenReturn(user);
        doThrow(new RuntimeException("downstream error")).when(filterChain).doFilter(request, response);

        assertThrows(RuntimeException.class,
                () -> filter.doFilterInternal(request, response, filterChain));

        assertThrows(SecurityException.class, SecurityContext::getCurrentUser);
    }

    @Test
    void skipFilter_forPublicAuthEndpoints() {
        when(request.getRequestURI()).thenReturn("/auth/login");
        assertTrue(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/auth/first-login");
        assertTrue(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/auth/mfa-verify");
        assertTrue(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/auth/forgot-password");
        assertTrue(filter.shouldNotFilter(request));
    }

    @Test
    void doNotSkipFilter_forProtectedEndpoints() {
        when(request.getRequestURI()).thenReturn("/admin/spaces");
        assertFalse(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/customer/spaces");
        assertFalse(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/notifications/count");
        assertFalse(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/auth/change-password");
        assertFalse(filter.shouldNotFilter(request));
    }
}
