package com.versent.reportportal.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Disables Spring Security's default filter chain for Lambda functions.
 *
 * Authentication and authorization are handled by:
 * - API Gateway Cognito Authorizer (for protected endpoints)
 * - JwtAuthenticationFilter (extracts user context from JWT)
 * - RoleChecker (enforces role-based access in controllers)
 *
 * Spring Security is only on the classpath for its crypto utilities;
 * we do not use its filter chain for request-level auth.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
