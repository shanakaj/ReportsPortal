package com.versent.reportportal.shared.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.versent.reportportal.shared.dto.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class ImpersonationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ImpersonationFilter.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();

            if (user.isImpersonating() && user.readOnly() && WRITE_METHODS.contains(request.getMethod())) {
                log.warn("Write operation rejected during impersonation. Impersonator: {}, Target: {}",
                        user.impersonatorId(), user.userId());

                response.setStatus(HttpStatus.FORBIDDEN.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);

                ErrorResponse error = new ErrorResponse(
                        HttpStatus.FORBIDDEN.value(),
                        "IMPERSONATION_READ_ONLY",
                        "Write operations are not permitted during impersonation mode"
                );

                response.getWriter().write(MAPPER.writeValueAsString(error));
                return;
            }
        } catch (SecurityException e) {
            // No user in context yet - allow the request to proceed to auth filter
        }

        filterChain.doFilter(request, response);
    }
}
