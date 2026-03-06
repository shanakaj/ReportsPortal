package com.versent.reportportal.triggers;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class PreSignupHandler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    private static final Logger log = LoggerFactory.getLogger(PreSignupHandler.class);
    private static final String VERSENT_DOMAIN = "@versent.com.au";

    private final DynamoDbClient dynamoDbClient;
    private final String invitationsTable;
    private final String auditLogTable;

    public PreSignupHandler() {
        String region = System.getenv("AWS_REGION") != null
                ? System.getenv("AWS_REGION") : "ap-southeast-2";

        this.dynamoDbClient = DynamoDbClient.builder()
                .region(Region.of(region))
                .build();

        this.invitationsTable = System.getenv("INVITATIONS_TABLE") != null
                ? System.getenv("INVITATIONS_TABLE") : "ReportPortal-Invitations";

        this.auditLogTable = System.getenv("AUDIT_LOG_TABLE") != null
                ? System.getenv("AUDIT_LOG_TABLE") : "ReportPortal-AuditLog";
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        String triggerSource = (String) event.get("triggerSource");
        Map<String, Object> request = (Map<String, Object>) event.get("request");
        Map<String, String> userAttributes = (Map<String, String>) request.get("userAttributes");

        String email = userAttributes.get("email");
        String role = userAttributes.getOrDefault("custom:role", "customer");

        log.info("Pre-signup trigger: email={}, role={}, trigger={}", email, role, triggerSource);

        try {
            // Validate admin/super_admin email domain
            if ("admin".equalsIgnoreCase(role) || "super_admin".equalsIgnoreCase(role)) {
                if (!email.endsWith(VERSENT_DOMAIN)) {
                    logAuditEvent(email, "SIGNUP_REJECTED",
                            "Non-versent.com.au email for " + role + " role", "FAILURE");
                    throw new RuntimeException("Admin and super admin accounts must use @versent.com.au email addresses");
                }
            }

            // Validate invitation token exists
            String invitationToken = userAttributes.get("custom:invitation_token");
            Map<String, String> clientMetadata = (Map<String, String>) request.get("clientMetadata");
            if (invitationToken == null && clientMetadata != null) {
                invitationToken = clientMetadata.get("invitation_token");
            }

            if (invitationToken == null || invitationToken.isBlank()) {
                logAuditEvent(email, "SIGNUP_REJECTED",
                        "No invitation token provided", "FAILURE");
                throw new RuntimeException("Registration requires a valid invitation. Self-signup is not allowed.");
            }

            // Validate the invitation token
            Map<String, AttributeValue> invitationKey = new HashMap<>();
            invitationKey.put("PK", AttributeValue.builder().s("INVITE#" + invitationToken).build());
            invitationKey.put("SK", AttributeValue.builder().s("META").build());

            var getResult = dynamoDbClient.getItem(r -> r
                    .tableName(invitationsTable)
                    .key(invitationKey));

            if (!getResult.hasItem() || getResult.item().isEmpty()) {
                logAuditEvent(email, "SIGNUP_REJECTED",
                        "Invalid invitation token", "FAILURE");
                throw new RuntimeException("Invalid invitation token");
            }

            Map<String, AttributeValue> invitation = getResult.item();

            // Check token status
            String status = invitation.get("status") != null ? invitation.get("status").s() : "";
            if (!"PENDING".equals(status)) {
                logAuditEvent(email, "SIGNUP_REJECTED",
                        "Invitation token already used (status: " + status + ")", "FAILURE");
                throw new RuntimeException("This invitation has already been used");
            }

            // Check expiry
            if (invitation.containsKey("expiresAt")) {
                long expiresAt = Long.parseLong(invitation.get("expiresAt").n());
                if (Instant.now().getEpochSecond() > expiresAt) {
                    logAuditEvent(email, "SIGNUP_REJECTED",
                            "Invitation token expired", "FAILURE");
                    throw new RuntimeException("This invitation has expired");
                }
            }

            // Verify email matches invitation
            String invitedEmail = invitation.get("email") != null ? invitation.get("email").s() : "";
            if (!email.equalsIgnoreCase(invitedEmail)) {
                logAuditEvent(email, "SIGNUP_REJECTED",
                        "Email does not match invitation (expected: " + invitedEmail + ")", "FAILURE");
                throw new RuntimeException("Email does not match the invitation");
            }

            // Mark invitation as accepted
            Map<String, AttributeValue> updatedInvitation = new HashMap<>(invitation);
            updatedInvitation.put("status", AttributeValue.builder().s("ACCEPTED").build());
            updatedInvitation.put("acceptedAt", AttributeValue.builder()
                    .s(Instant.now().toString()).build());

            dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(invitationsTable)
                    .item(updatedInvitation)
                    .build());

            logAuditEvent(email, "SIGNUP_APPROVED",
                    "User registered via invitation", "SUCCESS");

            log.info("Pre-signup approved for: {}", email);

            // Auto-confirm the user
            Map<String, Object> response = (Map<String, Object>) event.getOrDefault("response", new HashMap<>());
            response.put("autoConfirmUser", true);
            response.put("autoVerifyEmail", true);
            event.put("response", response);

            return event;

        } catch (RuntimeException e) {
            log.error("Pre-signup validation failed for: {}", email, e);
            throw e;
        }
    }

    private void logAuditEvent(String actor, String action, String target, String result) {
        try {
            Instant now = Instant.now();
            String date = LocalDate.ofInstant(now, ZoneOffset.UTC)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE);
            String timestamp = DateTimeFormatter.ISO_INSTANT.format(now);
            String eventId = UUID.randomUUID().toString();

            Map<String, AttributeValue> item = new HashMap<>();
            item.put("PK", AttributeValue.builder().s("AUDIT#" + date).build());
            item.put("SK", AttributeValue.builder().s(timestamp + "#" + eventId).build());
            item.put("eventId", AttributeValue.builder().s(eventId).build());
            item.put("actor", AttributeValue.builder().s(actor).build());
            item.put("actorEmail", AttributeValue.builder().s(actor).build());
            item.put("action", AttributeValue.builder().s(action).build());
            item.put("target", AttributeValue.builder().s(target).build());
            item.put("result", AttributeValue.builder().s(result).build());
            item.put("timestamp", AttributeValue.builder().s(now.toString()).build());

            // TTL: 2 years
            long ttl = now.plusSeconds(2L * 365 * 24 * 60 * 60).getEpochSecond();
            item.put("ttl", AttributeValue.builder().n(String.valueOf(ttl)).build());

            dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(auditLogTable)
                    .item(item)
                    .build());

        } catch (Exception e) {
            log.error("Failed to write audit log for pre-signup: actor={}, action={}", actor, action, e);
        }
    }
}
