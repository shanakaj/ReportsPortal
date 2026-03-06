package com.versent.reportportal.shared.service;

import com.versent.reportportal.shared.model.NotificationEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final long NINETY_DAYS_SECONDS = 90L * 24 * 60 * 60;

    private final DynamoDbTable<NotificationEntity> notificationTable;

    public NotificationService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                               @Value("${dynamodb.tables.notifications:ReportPortal-Notifications}") String tableName) {
        this.notificationTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(NotificationEntity.class));
    }

    public void createNotification(String userId, String type, String message,
                                   String relatedSpaceId, String relatedUserId,
                                   String relatedThreadId) {
        try {
            Instant now = Instant.now();
            String timestamp = DateTimeFormatter.ISO_INSTANT.format(now);
            String notificationId = UUID.randomUUID().toString();

            NotificationEntity entity = new NotificationEntity();
            entity.setPk(NotificationEntity.buildPk(userId));
            entity.setSk(NotificationEntity.buildSk(timestamp, notificationId));
            entity.setNotificationId(notificationId);
            entity.setUserId(userId);
            entity.setType(type);
            entity.setMessage(message);
            entity.setRelatedSpaceId(relatedSpaceId);
            entity.setRelatedUserId(relatedUserId);
            entity.setRelatedThreadId(relatedThreadId);
            entity.setRead(false);
            entity.setCreatedAt(now);
            entity.setTtl(now.plusSeconds(NINETY_DAYS_SECONDS).getEpochSecond());
            entity.setGsiUnreadPk(NotificationEntity.buildPk(userId));
            entity.setGsiUnreadSk(timestamp);

            notificationTable.putItem(entity);

            log.info("Notification created: userId={}, type={}, notificationId={}",
                    userId, type, notificationId);
        } catch (Exception e) {
            log.error("Failed to create notification: userId={}, type={}", userId, type, e);
        }
    }
}
