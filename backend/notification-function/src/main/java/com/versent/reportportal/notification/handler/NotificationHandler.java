package com.versent.reportportal.notification.handler;

import com.versent.reportportal.notification.service.NotificationDeliveryService;
import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.model.NotificationEntity;
import com.versent.reportportal.shared.security.SecurityContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbIndex;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.notification",
        "com.versent.reportportal.shared"
})
@RestController
@RequestMapping("/notifications")
public class NotificationHandler {

    private final DynamoDbTable<NotificationEntity> notificationTable;
    private final DynamoDbIndex<NotificationEntity> unreadIndex;
    private final NotificationDeliveryService deliveryService;

    public NotificationHandler(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                               NotificationDeliveryService deliveryService,
                               @Value("${dynamodb.tables.notifications:ReportPortal-Notifications}") String tableName) {
        this.notificationTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(NotificationEntity.class));
        this.unreadIndex = notificationTable.index("unread-index");
        this.deliveryService = deliveryService;
    }

    public static void main(String[] args) {
        SpringApplication.run(NotificationHandler.class, args);
    }

    @GetMapping
    public ResponseEntity<PaginatedResponse<NotificationDto>> listNotifications(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {

        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        String userId = currentUser.userId();
        int effectiveLimit = Math.min(limit, 100);

        if (unreadOnly) {
            return ResponseEntity.ok(queryUnreadNotifications(userId, cursor, effectiveLimit));
        }

        return ResponseEntity.ok(queryAllNotifications(userId, cursor, effectiveLimit));
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable String notificationId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        // Find and update the notification
        String pk = NotificationEntity.buildPk(currentUser.userId());
        Iterator<Page<NotificationEntity>> pages = notificationTable.query(
                QueryConditional.keyEqualTo(Key.builder().partitionValue(pk).build())).iterator();

        while (pages.hasNext()) {
            for (NotificationEntity entity : pages.next().items()) {
                if (notificationId.equals(entity.getNotificationId())) {
                    entity.setRead(true);
                    entity.setGsiUnreadPk(null);
                    entity.setGsiUnreadSk(null);
                    notificationTable.putItem(entity);
                    return ResponseEntity.ok().build();
                }
            }
        }

        return ResponseEntity.notFound().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead() {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        String pk = NotificationEntity.buildPk(currentUser.userId());

        Iterator<Page<NotificationEntity>> pages = notificationTable.query(
                QueryConditional.keyEqualTo(Key.builder().partitionValue(pk).build())).iterator();

        while (pages.hasNext()) {
            for (NotificationEntity entity : pages.next().items()) {
                if (!Boolean.TRUE.equals(entity.getRead())) {
                    entity.setRead(true);
                    entity.setGsiUnreadPk(null);
                    entity.setGsiUnreadSk(null);
                    notificationTable.putItem(entity);
                }
            }
        }

        return ResponseEntity.ok().build();
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Integer>> getUnreadCount() {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        String gsiPk = NotificationEntity.buildPk(currentUser.userId());

        int count = 0;
        Iterator<Page<NotificationEntity>> pages = unreadIndex.query(
                QueryConditional.keyEqualTo(Key.builder().partitionValue(gsiPk).build())).iterator();

        while (pages.hasNext()) {
            count += pages.next().items().size();
        }

        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    private PaginatedResponse<NotificationDto> queryAllNotifications(String userId, String cursor, int limit) {
        String pk = NotificationEntity.buildPk(userId);

        QueryEnhancedRequest.Builder queryBuilder = QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.keyEqualTo(
                        Key.builder().partitionValue(pk).build()))
                .scanIndexForward(false)
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<NotificationEntity>> pages = notificationTable.query(queryBuilder.build()).iterator();
        return processNotificationPages(pages);
    }

    private PaginatedResponse<NotificationDto> queryUnreadNotifications(String userId, String cursor, int limit) {
        String gsiPk = NotificationEntity.buildPk(userId);

        QueryEnhancedRequest.Builder queryBuilder = QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.keyEqualTo(
                        Key.builder().partitionValue(gsiPk).build()))
                .scanIndexForward(false)
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<NotificationEntity>> pages = unreadIndex.query(queryBuilder.build()).iterator();
        return processNotificationPages(pages);
    }

    private PaginatedResponse<NotificationDto> processNotificationPages(Iterator<Page<NotificationEntity>> pages) {
        List<NotificationDto> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<NotificationEntity> page = pages.next();
            items = page.items().stream()
                    .map(this::toDto)
                    .toList();
            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    private NotificationDto toDto(NotificationEntity entity) {
        return new NotificationDto(
                entity.getNotificationId(),
                entity.getType(),
                entity.getMessage(),
                entity.getRelatedSpaceId(),
                entity.getRelatedUserId(),
                entity.getRelatedThreadId(),
                entity.getRead(),
                entity.getCreatedAt()
        );
    }

    public record NotificationDto(
            String notificationId,
            String type,
            String message,
            String relatedSpaceId,
            String relatedUserId,
            String relatedThreadId,
            Boolean read,
            java.time.Instant createdAt
    ) {
    }
}
