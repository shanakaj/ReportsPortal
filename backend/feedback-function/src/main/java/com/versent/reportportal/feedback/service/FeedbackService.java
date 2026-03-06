package com.versent.reportportal.feedback.service;

import com.versent.reportportal.feedback.dto.AttachmentUploadResponse;
import com.versent.reportportal.feedback.dto.CreateThreadRequest;
import com.versent.reportportal.feedback.dto.MessageResponse;
import com.versent.reportportal.feedback.dto.ReplyRequest;
import com.versent.reportportal.feedback.dto.ThreadResponse;
import com.versent.reportportal.feedback.dto.UpdateStatusRequest;
import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.exception.ResourceNotFoundException;
import com.versent.reportportal.shared.exception.ValidationException;
import com.versent.reportportal.shared.model.FeedbackMessageEntity;
import com.versent.reportportal.shared.model.FeedbackThreadEntity;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
import com.versent.reportportal.shared.service.EventBridgeService;
import com.versent.reportportal.shared.util.HtmlSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbIndex;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@Service
public class FeedbackService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackService.class);
    private static final long MAX_ATTACHMENT_SIZE = 10L * 1024 * 1024; // 10MB
    private static final List<String> ALLOWED_TYPES = List.of(
            "image/png", "image/jpeg", "image/gif", "application/pdf"
    );

    private final DynamoDbTable<FeedbackThreadEntity> threadTable;
    private final DynamoDbTable<FeedbackMessageEntity> messageTable;
    private final DynamoDbIndex<FeedbackThreadEntity> reportThreadsIndex;
    private final DynamoDbIndex<FeedbackThreadEntity> spaceThreadsIndex;
    private final S3Presigner s3Presigner;
    private final EventBridgeService eventBridgeService;
    private final AuditService auditService;
    private final HtmlSanitizer htmlSanitizer;
    private final String feedbackBucket;

    public FeedbackService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                           S3Presigner s3Presigner,
                           EventBridgeService eventBridgeService,
                           AuditService auditService,
                           HtmlSanitizer htmlSanitizer,
                           @Value("${dynamodb.tables.feedback-threads:ReportPortal-FeedbackThreads}") String threadTableName,
                           @Value("${dynamodb.tables.feedback-messages:ReportPortal-FeedbackMessages}") String messageTableName,
                           @Value("${s3.feedback-bucket:report-portal-feedback}") String feedbackBucket) {
        this.threadTable = dynamoDbEnhancedClient.table(threadTableName,
                TableSchema.fromBean(FeedbackThreadEntity.class));
        this.messageTable = dynamoDbEnhancedClient.table(messageTableName,
                TableSchema.fromBean(FeedbackMessageEntity.class));
        this.reportThreadsIndex = threadTable.index("report-threads-index");
        this.spaceThreadsIndex = threadTable.index("space-threads-index");
        this.s3Presigner = s3Presigner;
        this.eventBridgeService = eventBridgeService;
        this.auditService = auditService;
        this.htmlSanitizer = htmlSanitizer;
        this.feedbackBucket = feedbackBucket;
    }

    public ThreadResponse createThread(String spaceId, String reportId, CreateThreadRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        String threadId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        String timestamp = DateTimeFormatter.ISO_INSTANT.format(now);
        String messageId = UUID.randomUUID().toString();

        String sanitizedMessage = htmlSanitizer.sanitizeFeedbackMessage(request.message());

        FeedbackThreadEntity thread = new FeedbackThreadEntity();
        thread.setPk(FeedbackThreadEntity.buildPk(threadId));
        thread.setSk(FeedbackThreadEntity.SORT_KEY);
        thread.setThreadId(threadId);
        thread.setSpaceId(spaceId);
        thread.setReportId(reportId);
        thread.setSubject(request.subject());
        thread.setStatus("open");
        thread.setCreatedBy(currentUser.userId());
        thread.setCreatedByRole(currentUser.role().name().toLowerCase());
        thread.setCreatedAt(now);
        thread.setLastMessageAt(now);
        thread.setLastMessageBy(currentUser.userId());
        thread.setMessageCount(1);
        thread.setUnreadByAdmin(currentUser.isCustomer());
        thread.setUnreadByCustomer(!currentUser.isCustomer());
        thread.setGsiReportPk(FeedbackThreadEntity.buildGsiReportPk(spaceId, reportId));
        thread.setGsiReportSk(timestamp);
        thread.setGsiSpacePk(FeedbackThreadEntity.buildGsiSpacePk(spaceId));
        thread.setGsiSpaceSk(timestamp);
        thread.setGsiStatusPk(FeedbackThreadEntity.buildGsiStatusPk("open"));
        thread.setGsiStatusSk(timestamp);

        threadTable.putItem(thread);

        FeedbackMessageEntity message = new FeedbackMessageEntity();
        message.setPk(FeedbackMessageEntity.buildPk(threadId));
        message.setSk(FeedbackMessageEntity.buildSk(timestamp, messageId));
        message.setMessageId(messageId);
        message.setThreadId(threadId);
        message.setAuthorId(currentUser.userId());
        message.setAuthorName(currentUser.email());
        message.setAuthorRole(currentUser.role().name().toLowerCase());
        message.setMessage(sanitizedMessage);
        message.setAttachments(request.attachments());
        message.setCreatedAt(now);

        messageTable.putItem(message);

        eventBridgeService.publishFeedbackNewEvent(threadId, spaceId, reportId,
                currentUser.userId(), currentUser.email(), request.subject());

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "FEEDBACK_THREAD_CREATED", threadId, "SUCCESS");

        return toThreadResponse(thread);
    }

    public PaginatedResponse<ThreadResponse> listThreads(String spaceId, String reportId,
                                                         String cursor, int limit) {
        String gsiPk = FeedbackThreadEntity.buildGsiReportPk(spaceId, reportId);

        QueryEnhancedRequest.Builder queryBuilder = QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.keyEqualTo(
                        Key.builder().partitionValue(gsiPk).build()))
                .scanIndexForward(false)
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<FeedbackThreadEntity>> pages = reportThreadsIndex.query(queryBuilder.build()).iterator();

        List<ThreadResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<FeedbackThreadEntity> page = pages.next();
            items = page.items().stream().map(this::toThreadResponse).toList();
            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    public PaginatedResponse<MessageResponse> getThreadMessages(String threadId, String cursor, int limit) {
        QueryEnhancedRequest.Builder queryBuilder = QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.sortBeginsWith(
                        Key.builder()
                                .partitionValue(FeedbackMessageEntity.buildPk(threadId))
                                .sortValue("MSG#")
                                .build()))
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<FeedbackMessageEntity>> pages = messageTable.query(queryBuilder.build()).iterator();

        List<MessageResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<FeedbackMessageEntity> page = pages.next();
            items = page.items().stream().map(this::toMessageResponse).toList();
            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    public MessageResponse replyToThread(String threadId, ReplyRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        FeedbackThreadEntity thread = threadTable.getItem(Key.builder()
                .partitionValue(FeedbackThreadEntity.buildPk(threadId))
                .sortValue(FeedbackThreadEntity.SORT_KEY)
                .build());

        if (thread == null) {
            throw new ResourceNotFoundException("Thread not found: " + threadId);
        }

        Instant now = Instant.now();
        String timestamp = DateTimeFormatter.ISO_INSTANT.format(now);
        String messageId = UUID.randomUUID().toString();

        String sanitizedMessage = htmlSanitizer.sanitizeFeedbackMessage(request.message());

        FeedbackMessageEntity message = new FeedbackMessageEntity();
        message.setPk(FeedbackMessageEntity.buildPk(threadId));
        message.setSk(FeedbackMessageEntity.buildSk(timestamp, messageId));
        message.setMessageId(messageId);
        message.setThreadId(threadId);
        message.setAuthorId(currentUser.userId());
        message.setAuthorName(currentUser.email());
        message.setAuthorRole(currentUser.role().name().toLowerCase());
        message.setMessage(sanitizedMessage);
        message.setAttachments(request.attachments());
        message.setCreatedAt(now);

        messageTable.putItem(message);

        thread.setLastMessageAt(now);
        thread.setLastMessageBy(currentUser.userId());
        thread.setMessageCount(thread.getMessageCount() + 1);
        thread.setGsiReportSk(timestamp);
        thread.setGsiSpaceSk(timestamp);
        thread.setGsiStatusSk(timestamp);

        if (currentUser.isCustomer()) {
            thread.setUnreadByAdmin(true);
        } else {
            thread.setUnreadByCustomer(true);
        }

        threadTable.putItem(thread);

        eventBridgeService.publishFeedbackReplyEvent(threadId, thread.getSpaceId(),
                thread.getReportId(), currentUser.userId(), currentUser.email(), messageId);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "FEEDBACK_REPLY_POSTED", threadId + "/" + messageId, "SUCCESS");

        return toMessageResponse(message);
    }

    public void updateThreadStatus(String threadId, UpdateStatusRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        FeedbackThreadEntity thread = threadTable.getItem(Key.builder()
                .partitionValue(FeedbackThreadEntity.buildPk(threadId))
                .sortValue(FeedbackThreadEntity.SORT_KEY)
                .build());

        if (thread == null) {
            throw new ResourceNotFoundException("Thread not found: " + threadId);
        }

        String oldStatus = thread.getStatus();
        thread.setStatus(request.status());
        thread.setGsiStatusPk(FeedbackThreadEntity.buildGsiStatusPk(request.status()));

        threadTable.putItem(thread);

        eventBridgeService.publishFeedbackStatusChangeEvent(threadId, thread.getSpaceId(),
                request.status(), currentUser.userId());

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "FEEDBACK_STATUS_CHANGED",
                threadId + ": " + oldStatus + " -> " + request.status(),
                "SUCCESS");
    }

    public AttachmentUploadResponse generateAttachmentUploadUrl(String threadId,
                                                                 String fileName,
                                                                 String contentType,
                                                                 Long fileSize) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        if (fileSize != null && fileSize > MAX_ATTACHMENT_SIZE) {
            throw new ValidationException("Attachment size exceeds maximum of 10MB");
        }

        if (contentType != null && !ALLOWED_TYPES.contains(contentType)) {
            throw new ValidationException("File type not allowed. Allowed types: image/png, image/jpeg, image/gif, application/pdf");
        }

        FeedbackThreadEntity thread = threadTable.getItem(Key.builder()
                .partitionValue(FeedbackThreadEntity.buildPk(threadId))
                .sortValue(FeedbackThreadEntity.SORT_KEY)
                .build());

        if (thread == null) {
            throw new ResourceNotFoundException("Thread not found: " + threadId);
        }

        String messageId = UUID.randomUUID().toString();
        String s3Key = thread.getSpaceId() + "/" + threadId + "/" + messageId + "/" + fileName;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(feedbackBucket)
                .key(s3Key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presignedRequest = s3Presigner.presignPutObject(presignRequest);

        return new AttachmentUploadResponse(presignedRequest.url().toString(), s3Key);
    }

    public PaginatedResponse<ThreadResponse> getAdminInbox(String spaceId, String status,
                                                            String cursor, int limit) {
        QueryEnhancedRequest.Builder queryBuilder;

        if (spaceId != null) {
            queryBuilder = QueryEnhancedRequest.builder()
                    .queryConditional(QueryConditional.keyEqualTo(
                            Key.builder().partitionValue(FeedbackThreadEntity.buildGsiSpacePk(spaceId)).build()))
                    .scanIndexForward(false)
                    .limit(limit);

            if (cursor != null && !cursor.isBlank()) {
                queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
            }

            Iterator<Page<FeedbackThreadEntity>> pages = spaceThreadsIndex.query(queryBuilder.build()).iterator();
            return processPages(pages, status);
        }

        // Scan all threads for admin inbox when no space filter
        List<ThreadResponse> allThreads = new ArrayList<>();
        Iterator<Page<FeedbackThreadEntity>> scanPages = threadTable.scan().iterator();
        while (scanPages.hasNext()) {
            Page<FeedbackThreadEntity> page = scanPages.next();
            page.items().stream()
                    .filter(t -> FeedbackThreadEntity.SORT_KEY.equals(t.getSk()))
                    .filter(t -> status == null || status.equals(t.getStatus()))
                    .map(this::toThreadResponse)
                    .forEach(allThreads::add);
        }

        return PaginatedResponse.of(allThreads.stream().limit(limit).toList(), null);
    }

    private PaginatedResponse<ThreadResponse> processPages(Iterator<Page<FeedbackThreadEntity>> pages,
                                                            String statusFilter) {
        List<ThreadResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<FeedbackThreadEntity> page = pages.next();
            items = page.items().stream()
                    .filter(t -> statusFilter == null || statusFilter.equals(t.getStatus()))
                    .map(this::toThreadResponse)
                    .toList();
            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    private ThreadResponse toThreadResponse(FeedbackThreadEntity entity) {
        return new ThreadResponse(
                entity.getThreadId(),
                entity.getSpaceId(),
                entity.getReportId(),
                entity.getSubject(),
                entity.getStatus(),
                entity.getCreatedBy(),
                entity.getCreatedByRole(),
                entity.getCreatedAt(),
                entity.getLastMessageAt(),
                entity.getLastMessageBy(),
                entity.getMessageCount(),
                entity.getUnreadByAdmin(),
                entity.getUnreadByCustomer()
        );
    }

    private MessageResponse toMessageResponse(FeedbackMessageEntity entity) {
        return new MessageResponse(
                entity.getMessageId(),
                entity.getThreadId(),
                entity.getAuthorId(),
                entity.getAuthorName(),
                entity.getAuthorRole(),
                entity.getMessage(),
                entity.getAttachments(),
                entity.getCreatedAt()
        );
    }
}
