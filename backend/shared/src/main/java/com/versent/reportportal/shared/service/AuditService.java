package com.versent.reportportal.shared.service;

import com.versent.reportportal.shared.model.AuditLogEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final long TWO_YEARS_SECONDS = 2L * 365 * 24 * 60 * 60;

    private final DynamoDbTable<AuditLogEntity> auditTable;

    public AuditService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                        @Value("${dynamodb.tables.audit-log:ReportPortal-AuditLog}") String tableName) {
        this.auditTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(AuditLogEntity.class));
    }

    public void logEvent(String actor, String actorEmail, String action, String target,
                         String ipAddress, String userAgent, String result,
                         Map<String, String> metadata) {
        try {
            Instant now = Instant.now();
            String date = LocalDate.ofInstant(now, ZoneOffset.UTC)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE);
            String timestamp = DateTimeFormatter.ISO_INSTANT.format(now);
            String eventId = UUID.randomUUID().toString();

            AuditLogEntity entity = new AuditLogEntity();
            entity.setPk(AuditLogEntity.buildPk(date));
            entity.setSk(AuditLogEntity.buildSk(timestamp, eventId));
            entity.setEventId(eventId);
            entity.setActor(actor);
            entity.setActorEmail(actorEmail);
            entity.setAction(action);
            entity.setTarget(target);
            entity.setIpAddress(ipAddress);
            entity.setUserAgent(userAgent);
            entity.setResult(result);
            entity.setMetadata(metadata);
            entity.setTimestamp(now);
            entity.setTtl(now.plusSeconds(TWO_YEARS_SECONDS).getEpochSecond());

            auditTable.putItem(entity);

            log.info("Audit event recorded: action={}, actor={}, target={}, result={}",
                    action, actor, target, result);
        } catch (Exception e) {
            log.error("Failed to write audit log entry: action={}, actor={}", action, actor, e);
        }
    }

    public void logEvent(String actor, String actorEmail, String action, String target,
                         String result) {
        logEvent(actor, actorEmail, action, target, null, null, result, null);
    }
}
