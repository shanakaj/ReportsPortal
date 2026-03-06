package com.versent.reportportal.audit.service;

import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.model.AuditLogEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Service
public class AuditQueryService {

    private static final Logger log = LoggerFactory.getLogger(AuditQueryService.class);

    private final DynamoDbTable<AuditLogEntity> auditTable;

    public AuditQueryService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                             @Value("${dynamodb.tables.audit-log:ReportPortal-AuditLog}") String tableName) {
        this.auditTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(AuditLogEntity.class));
    }

    public PaginatedResponse<AuditLogEntry> queryAuditLog(String actor, String action,
                                                           String spaceId, String from,
                                                           String to, String cursor, int limit) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(7);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();

        List<AuditLogEntry> results = new ArrayList<>();

        LocalDate current = fromDate;
        while (!current.isAfter(toDate) && results.size() < limit) {
            String pk = AuditLogEntity.buildPk(current.format(DateTimeFormatter.ISO_LOCAL_DATE));

            QueryEnhancedRequest.Builder queryBuilder = QueryEnhancedRequest.builder()
                    .queryConditional(QueryConditional.keyEqualTo(
                            Key.builder().partitionValue(pk).build()))
                    .scanIndexForward(false)
                    .limit(limit - results.size());

            if (cursor != null && !cursor.isBlank() && current.equals(fromDate)) {
                queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
            }

            Iterator<Page<AuditLogEntity>> pages = auditTable.query(queryBuilder.build()).iterator();

            while (pages.hasNext() && results.size() < limit) {
                Page<AuditLogEntity> page = pages.next();
                page.items().stream()
                        .filter(e -> actor == null || actor.equals(e.getActor()))
                        .filter(e -> action == null || action.equals(e.getAction()))
                        .filter(e -> spaceId == null || (e.getTarget() != null &&
                                e.getTarget().contains(spaceId)))
                        .map(this::toEntry)
                        .forEach(results::add);
            }

            current = current.plusDays(1);
        }

        boolean hasMore = results.size() >= limit;
        return new PaginatedResponse<>(
                results.stream().limit(limit).toList(),
                null,
                hasMore
        );
    }

    private AuditLogEntry toEntry(AuditLogEntity entity) {
        return new AuditLogEntry(
                entity.getEventId(),
                entity.getActor(),
                entity.getActorEmail(),
                entity.getAction(),
                entity.getTarget(),
                entity.getIpAddress(),
                entity.getUserAgent(),
                entity.getResult(),
                entity.getMetadata(),
                entity.getTimestamp()
        );
    }

    public record AuditLogEntry(
            String eventId,
            String actor,
            String actorEmail,
            String action,
            String target,
            String ipAddress,
            String userAgent,
            String result,
            java.util.Map<String, String> metadata,
            java.time.Instant timestamp
    ) {
    }
}
