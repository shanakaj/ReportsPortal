package com.versent.reportportal.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.versent.reportportal.admin.dto.ImpersonationResponse;
import com.versent.reportportal.shared.exception.ResourceNotFoundException;
import com.versent.reportportal.shared.model.UserEntity;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class ImpersonationService {

    private static final Logger log = LoggerFactory.getLogger(ImpersonationService.class);
    private static final int IMPERSONATION_TTL_SECONDS = 300; // 5 minutes

    private final DynamoDbTable<UserEntity> userTable;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;
    private final String jwtSecret;

    public ImpersonationService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                                AuditService auditService,
                                @Value("${dynamodb.tables.users:ReportPortal-Users}") String tableName,
                                @Value("${impersonation.jwt-secret:change-me-in-production}") String jwtSecret) {
        this.userTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(UserEntity.class));
        this.auditService = auditService;
        this.objectMapper = new ObjectMapper();
        this.jwtSecret = jwtSecret;
    }

    public ImpersonationResponse startImpersonation(String targetUserId) {
        SecurityContext.AuthenticatedUser superAdmin = SecurityContext.getCurrentUser();

        UserEntity targetUser = userTable.getItem(Key.builder()
                .partitionValue(UserEntity.buildPk(targetUserId))
                .sortValue(UserEntity.SORT_KEY)
                .build());

        if (targetUser == null) {
            throw new ResourceNotFoundException("User not found: " + targetUserId);
        }

        String impersonationToken = generateImpersonationToken(superAdmin, targetUser);

        auditService.logEvent(superAdmin.userId(), superAdmin.email(),
                "IMPERSONATION_STARTED",
                "Impersonating: " + targetUser.getEmail() + " (" + targetUserId + ")",
                "SUCCESS");

        log.info("Impersonation started: {} impersonating {}", superAdmin.email(), targetUser.getEmail());

        return new ImpersonationResponse(
                impersonationToken,
                targetUser.getUserId(),
                targetUser.getEmail(),
                targetUser.getRole().name(),
                IMPERSONATION_TTL_SECONDS
        );
    }

    public void endImpersonation() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();

        if (!user.isImpersonating()) {
            throw new SecurityException("No active impersonation session");
        }

        auditService.logEvent(user.impersonatorId(), "super_admin",
                "IMPERSONATION_ENDED",
                "Stopped impersonating: " + user.userId(),
                "SUCCESS");

        log.info("Impersonation ended by: {}", user.impersonatorId());
    }

    private String generateImpersonationToken(SecurityContext.AuthenticatedUser superAdmin,
                                               UserEntity targetUser) {
        try {
            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            Map<String, Object> payload = new HashMap<>();
            payload.put("sub", targetUser.getUserId());
            payload.put("email", targetUser.getEmail());
            payload.put("custom:role", targetUser.getRole().name().toLowerCase());
            payload.put("impersonator", superAdmin.userId());
            payload.put("read_only", true);
            payload.put("iat", Instant.now().getEpochSecond());
            payload.put("exp", Instant.now().plusSeconds(IMPERSONATION_TTL_SECONDS).getEpochSecond());

            if (targetUser.getCustomerSpaces() != null && !targetUser.getCustomerSpaces().isEmpty()) {
                payload.put("custom:customer_space", String.join(",", targetUser.getCustomerSpaces()));
            }

            String headerBase64 = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(header));
            String payloadBase64 = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(payload));

            String dataToSign = headerBase64 + "." + payloadBase64;

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));

            String signatureBase64 = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(signature);

            return dataToSign + "." + signatureBase64;
        } catch (Exception e) {
            log.error("Failed to generate impersonation token", e);
            throw new RuntimeException("Failed to generate impersonation token", e);
        }
    }
}
