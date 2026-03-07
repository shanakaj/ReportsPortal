package com.versent.reportportal.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtValidator jwtValidator;

    public JwtAuthenticationFilter(JwtValidator jwtValidator) {
        this.jwtValidator = jwtValidator;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && !authHeader.isBlank()) {
            try {
                SecurityContext.AuthenticatedUser user = jwtValidator.validate(authHeader);
                SecurityContext.setCurrentUser(user);
            } catch (SecurityException e) {
                log.warn("JWT validation failed: {}", e.getMessage());
                // Allow the request to continue — downstream handlers will check SecurityContext
                // and throw appropriate exceptions via RoleChecker
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContext.clear();
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Skip auth filter for pre-auth endpoints
        return path.startsWith("/auth/login")
                || path.startsWith("/auth/first-login")
                || path.startsWith("/auth/mfa-verify")
                || path.startsWith("/auth/forgot-password");
    }
}
