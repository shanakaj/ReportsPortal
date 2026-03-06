package com.versent.reportportal.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.versent.reportportal.shared.model.FeedbackThreadEntity;
import com.versent.reportportal.shared.model.UserEntity;
import com.versent.reportportal.shared.service.EmailService;
import com.versent.reportportal.shared.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.ScanEnhancedRequest;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Service
public class NotificationDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(NotificationDeliveryService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final DynamoDbTable<UserEntity> userTable;
    private final DynamoDbTable<FeedbackThreadEntity> threadTable;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final String portalBaseUrl;

    public NotificationDeliveryService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                                       NotificationService notificationService,
                                       EmailService emailService,
                                       @Value("${dynamodb.tables.users:ReportPortal-Users}") String userTableName,
                                       @Value("${dynamodb.tables.feedback-threads:ReportPortal-FeedbackThreads}") String threadTableName,
                                       @Value("${portal.base-url:https://admin.yourdomain.com}") String portalBaseUrl) {
        this.userTable = dynamoDbEnhancedClient.table(userTableName,
                TableSchema.fromBean(UserEntity.class));
        this.threadTable = dynamoDbEnhancedClient.table(threadTableName,
                TableSchema.fromBean(FeedbackThreadEntity.class));
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.portalBaseUrl = portalBaseUrl;
    }

    @SuppressWarnings("unchecked")
    public void processEvent(Map<String, Object> event) {
        try {
            String detailType = (String) event.get("detail-type");
            Map<String, Object> detail = (Map<String, Object>) event.get("detail");

            if (detail == null) {
                log.warn("Event detail is null for type: {}", detailType);
                return;
            }

            switch (detailType) {
                case "feedback.new" -> handleFeedbackNew(detail);
                case "feedback.reply" -> handleFeedbackReply(detail);
                case "feedback.status_changed" -> handleFeedbackStatusChanged(detail);
                case "user.first_login" -> handleFirstLogin(detail);
                default -> log.warn("Unknown event type: {}", detailType);
            }
        } catch (Exception e) {
            log.error("Failed to process event", e);
        }
    }

    private void handleFeedbackNew(Map<String, Object> detail) {
        String spaceId = (String) detail.get("spaceId");
        String authorName = (String) detail.get("authorName");
        String subject = (String) detail.get("subject");
        String threadId = (String) detail.get("threadId");
        String reportId = (String) detail.get("reportId");

        List<UserEntity> spaceAdmins = getAdminsForSpace(spaceId);

        String threadLink = portalBaseUrl + "/feedback/threads/" + threadId;

        for (UserEntity admin : spaceAdmins) {
            notificationService.createNotification(
                    admin.getUserId(),
                    "feedback_new",
                    authorName + " left feedback: " + subject,
                    spaceId,
                    (String) detail.get("authorId"),
                    threadId
            );

            emailService.sendFeedbackNewEmail(
                    admin.getEmail(),
                    authorName,
                    reportId,
                    spaceId,
                    subject,
                    "",
                    threadLink
            );
        }

        log.info("Feedback new notifications sent to {} admins for thread: {}", spaceAdmins.size(), threadId);
    }

    private void handleFeedbackReply(Map<String, Object> detail) {
        String threadId = (String) detail.get("threadId");
        String authorName = (String) detail.get("authorName");
        String authorId = (String) detail.get("authorId");
        String spaceId = (String) detail.get("spaceId");
        String reportId = (String) detail.get("reportId");

        FeedbackThreadEntity thread = threadTable.getItem(Key.builder()
                .partitionValue(FeedbackThreadEntity.buildPk(threadId))
                .sortValue(FeedbackThreadEntity.SORT_KEY)
                .build());

        if (thread == null) {
            log.warn("Thread not found for reply notification: {}", threadId);
            return;
        }

        String threadLink = portalBaseUrl + "/feedback/threads/" + threadId;

        // Notify the thread creator if they are not the replier
        if (!authorId.equals(thread.getCreatedBy())) {
            UserEntity creator = userTable.getItem(Key.builder()
                    .partitionValue(UserEntity.buildPk(thread.getCreatedBy()))
                    .sortValue(UserEntity.SORT_KEY)
                    .build());

            if (creator != null) {
                notificationService.createNotification(
                        creator.getUserId(),
                        "feedback_reply",
                        authorName + " replied to: " + thread.getSubject(),
                        spaceId,
                        authorId,
                        threadId
                );

                emailService.sendFeedbackReplyEmail(
                        creator.getEmail(),
                        authorName,
                        reportId,
                        "",
                        threadLink
                );
            }
        }

        // Also notify space admins
        List<UserEntity> spaceAdmins = getAdminsForSpace(spaceId);
        for (UserEntity admin : spaceAdmins) {
            if (!admin.getUserId().equals(authorId)) {
                notificationService.createNotification(
                        admin.getUserId(),
                        "feedback_reply",
                        authorName + " replied to: " + thread.getSubject(),
                        spaceId,
                        authorId,
                        threadId
                );
            }
        }
    }

    private void handleFeedbackStatusChanged(Map<String, Object> detail) {
        String threadId = (String) detail.get("threadId");
        String newStatus = (String) detail.get("newStatus");
        String changedBy = (String) detail.get("changedBy");

        FeedbackThreadEntity thread = threadTable.getItem(Key.builder()
                .partitionValue(FeedbackThreadEntity.buildPk(threadId))
                .sortValue(FeedbackThreadEntity.SORT_KEY)
                .build());

        if (thread == null) return;

        if ("resolved".equals(newStatus)) {
            UserEntity creator = userTable.getItem(Key.builder()
                    .partitionValue(UserEntity.buildPk(thread.getCreatedBy()))
                    .sortValue(UserEntity.SORT_KEY)
                    .build());

            UserEntity resolver = userTable.getItem(Key.builder()
                    .partitionValue(UserEntity.buildPk(changedBy))
                    .sortValue(UserEntity.SORT_KEY)
                    .build());

            if (creator != null && resolver != null) {
                notificationService.createNotification(
                        creator.getUserId(),
                        "feedback_resolved",
                        "Feedback '" + thread.getSubject() + "' has been resolved",
                        thread.getSpaceId(),
                        changedBy,
                        threadId
                );

                emailService.sendFeedbackResolvedEmail(
                        creator.getEmail(),
                        thread.getSubject(),
                        thread.getReportId(),
                        resolver.getFullName() != null ? resolver.getFullName() : resolver.getEmail()
                );
            }
        }
    }

    private void handleFirstLogin(Map<String, Object> detail) {
        String userId = (String) detail.get("userId");
        String fullName = (String) detail.get("fullName");
        String email = (String) detail.get("email");
        String spaceId = (String) detail.get("spaceId");
        String invitedBy = (String) detail.get("invitedBy");

        if (invitedBy != null) {
            notificationService.createNotification(
                    invitedBy,
                    "first_login",
                    fullName + " (" + email + ") has logged in for the first time",
                    spaceId,
                    userId,
                    null
            );

            UserEntity inviter = userTable.getItem(Key.builder()
                    .partitionValue(UserEntity.buildPk(invitedBy))
                    .sortValue(UserEntity.SORT_KEY)
                    .build());

            if (inviter != null) {
                emailService.sendFirstLoginNotification(inviter.getEmail(), fullName, spaceId);
            }
        }
    }

    private List<UserEntity> getAdminsForSpace(String spaceId) {
        List<UserEntity> admins = new ArrayList<>();

        Iterator<Page<UserEntity>> pages = userTable.scan(ScanEnhancedRequest.builder().build()).iterator();
        while (pages.hasNext()) {
            pages.next().items().stream()
                    .filter(u -> UserEntity.SORT_KEY.equals(u.getSk()))
                    .filter(u -> u.getRole() != null &&
                            (u.getRole().name().equals("ADMIN") || u.getRole().name().equals("SUPER_ADMIN")))
                    .filter(u -> u.getRole().name().equals("SUPER_ADMIN") ||
                            (u.getCustomerSpaces() != null && u.getCustomerSpaces().contains(spaceId)))
                    .forEach(admins::add);
        }

        return admins;
    }
}
