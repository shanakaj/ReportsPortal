package com.versent.reportportal.admin.service;

import com.versent.reportportal.admin.dto.ReportResponse;
import com.versent.reportportal.admin.dto.UploadReportRequest;
import com.versent.reportportal.admin.dto.UploadReportResponse;
import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.exception.ResourceNotFoundException;
import com.versent.reportportal.shared.exception.ValidationException;
import com.versent.reportportal.shared.model.ReportEntity;
import com.versent.reportportal.shared.model.SpaceEntity;
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
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);
    private static final long MAX_FILE_SIZE = 50L * 1024 * 1024; // 50MB

    private final DynamoDbTable<ReportEntity> reportTable;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final SpaceService spaceService;
    private final AuditService auditService;

    public ReportService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                         S3Client s3Client,
                         S3Presigner s3Presigner,
                         SpaceService spaceService,
                         AuditService auditService,
                         @Value("${dynamodb.tables.reports:ReportPortal-Reports}") String tableName) {
        this.reportTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(ReportEntity.class));
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.spaceService = spaceService;
        this.auditService = auditService;
    }

    public UploadReportResponse initiateUpload(String spaceId, UploadReportRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        if (request.fileSize() != null && request.fileSize() > MAX_FILE_SIZE) {
            throw new ValidationException("File size exceeds maximum of 50MB");
        }

        SpaceEntity space = spaceService.getSpaceEntity(spaceId);

        String reportId = UUID.randomUUID().toString();
        String s3Key = "reports/" + reportId + "/" + request.fileName();

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(space.getS3BucketName())
                .key(s3Key)
                .contentType(request.contentType() != null ? request.contentType() : "text/html")
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presignedRequest = s3Presigner.presignPutObject(presignRequest);

        ReportEntity entity = new ReportEntity();
        entity.setPk(ReportEntity.buildPk(spaceId));
        entity.setSk(ReportEntity.buildSk(reportId));
        entity.setSpaceId(spaceId);
        entity.setReportId(reportId);
        entity.setFileName(request.fileName());
        entity.setS3Key(s3Key);
        entity.setUploadedBy(currentUser.userId());
        entity.setUploadedAt(Instant.now());
        entity.setFileSize(request.fileSize());
        entity.setStatus("PENDING_UPLOAD");

        reportTable.putItem(entity);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "REPORT_UPLOAD_INITIATED", spaceId + "/" + reportId, "SUCCESS");

        return new UploadReportResponse(reportId, presignedRequest.url().toString(), s3Key);
    }

    public PaginatedResponse<ReportResponse> listReports(String spaceId, String cursor, int limit) {
        QueryEnhancedRequest.Builder queryBuilder = QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.sortBeginsWith(
                        Key.builder()
                                .partitionValue(ReportEntity.buildPk(spaceId))
                                .sortValue("REPORT#")
                                .build()))
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            queryBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<ReportEntity>> pages = reportTable.query(queryBuilder.build()).iterator();

        List<ReportResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<ReportEntity> page = pages.next();
            items = page.items().stream()
                    .map(this::toResponse)
                    .toList();

            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    public void deleteReport(String spaceId, String reportId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        ReportEntity report = reportTable.getItem(Key.builder()
                .partitionValue(ReportEntity.buildPk(spaceId))
                .sortValue(ReportEntity.buildSk(reportId))
                .build());

        if (report == null) {
            throw new ResourceNotFoundException("Report not found: " + reportId);
        }

        SpaceEntity space = spaceService.getSpaceEntity(spaceId);

        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(space.getS3BucketName())
                    .key(report.getS3Key())
                    .build());
        } catch (Exception e) {
            log.error("Failed to delete S3 object: {}/{}", space.getS3BucketName(), report.getS3Key(), e);
        }

        reportTable.deleteItem(Key.builder()
                .partitionValue(ReportEntity.buildPk(spaceId))
                .sortValue(ReportEntity.buildSk(reportId))
                .build());

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "REPORT_DELETED", spaceId + "/" + reportId, "SUCCESS");
    }

    private ReportResponse toResponse(ReportEntity entity) {
        return new ReportResponse(
                entity.getReportId(),
                entity.getSpaceId(),
                entity.getFileName(),
                entity.getS3Key(),
                entity.getUploadedBy(),
                entity.getUploadedAt(),
                entity.getFileSize(),
                entity.getStatus()
        );
    }
}
