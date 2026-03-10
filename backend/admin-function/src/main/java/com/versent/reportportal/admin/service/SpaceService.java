package com.versent.reportportal.admin.service;

import com.versent.reportportal.admin.dto.CreateSpaceRequest;
import com.versent.reportportal.admin.dto.SpaceResponse;
import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.exception.ConflictException;
import com.versent.reportportal.shared.exception.ResourceNotFoundException;
import com.versent.reportportal.shared.model.SpaceEntity;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
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
import software.amazon.awssdk.enhanced.dynamodb.model.ScanEnhancedRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.BucketLocationConstraint;
import software.amazon.awssdk.services.s3.model.CreateBucketConfiguration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@Service
public class SpaceService {

    private static final Logger log = LoggerFactory.getLogger(SpaceService.class);

    private final DynamoDbTable<SpaceEntity> spaceTable;
    private final DynamoDbIndex<SpaceEntity> spaceNameIndex;
    private final S3Client s3Client;
    private final AuditService auditService;
    private final String awsAccountId;
    private final String awsRegion;

    public SpaceService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                        S3Client s3Client,
                        AuditService auditService,
                        @Value("${dynamodb.tables.spaces:ReportPortal-Spaces}") String tableName,
                        @Value("${AWS_ACCOUNT_ID:000000000000}") String awsAccountId,
                        @Value("${APP_AWS_REGION:ap-southeast-2}") String awsRegion) {
        this.spaceTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(SpaceEntity.class));
        this.spaceNameIndex = spaceTable.index("spaceName-index");
        this.s3Client = s3Client;
        this.auditService = auditService;
        this.awsAccountId = awsAccountId;
        this.awsRegion = awsRegion;
    }

    public SpaceResponse createSpace(CreateSpaceRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        Iterator<Page<SpaceEntity>> existingPages = spaceNameIndex.query(
                QueryConditional.keyEqualTo(Key.builder()
                        .partitionValue(request.spaceName())
                        .build())).iterator();

        if (existingPages.hasNext() && !existingPages.next().items().isEmpty()) {
            throw new ConflictException("Space with name '" + request.spaceName() + "' already exists");
        }

        String spaceId = UUID.randomUUID().toString();
        // S3 bucket names max 63 chars: "rp-" (3) + spaceName truncated (max 20) + "-" + short UUID (8) + "-" + accountId (12) + "-" + region (max 16) = ~60
        String shortId = spaceId.substring(0, 8);
        String truncatedName = request.spaceName().length() > 20
                ? request.spaceName().substring(0, 20)
                : request.spaceName();
        String bucketName = String.format("rp-%s-%s-%s-%s", truncatedName, shortId, awsAccountId, awsRegion);

        try {
            s3Client.createBucket(CreateBucketRequest.builder()
                    .bucket(bucketName)
                    .createBucketConfiguration(CreateBucketConfiguration.builder()
                            .locationConstraint(BucketLocationConstraint.fromValue(awsRegion))
                            .build())
                    .build());
            log.info("S3 bucket created: {}", bucketName);
        } catch (Exception e) {
            log.error("Failed to create S3 bucket: {}", bucketName, e);
            throw new RuntimeException("Failed to provision S3 bucket for space", e);
        }

        SpaceEntity entity = new SpaceEntity();
        entity.setPk(SpaceEntity.buildPk(spaceId));
        entity.setSk(SpaceEntity.SORT_KEY);
        entity.setSpaceId(spaceId);
        entity.setSpaceName(request.spaceName());
        entity.setS3BucketName(bucketName);
        entity.setCreatedBy(currentUser.userId());
        entity.setCreatedAt(Instant.now());
        entity.setStatus("ACTIVE");

        spaceTable.putItem(entity);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "SPACE_CREATED", spaceId, "SUCCESS");

        return toResponse(entity);
    }

    public PaginatedResponse<SpaceResponse> listSpaces(String cursor, int limit) {
        ScanEnhancedRequest.Builder scanBuilder = ScanEnhancedRequest.builder()
                .limit(limit);

        if (cursor != null && !cursor.isBlank()) {
            scanBuilder.exclusiveStartKey(CursorUtil.decode(cursor));
        }

        Iterator<Page<SpaceEntity>> pages = spaceTable.scan(scanBuilder.build()).iterator();

        List<SpaceResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<SpaceEntity> page = pages.next();
            items = page.items().stream()
                    .filter(e -> SpaceEntity.SORT_KEY.equals(e.getSk()))
                    .map(this::toResponse)
                    .toList();

            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    public void deleteSpace(String spaceId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        SpaceEntity space = spaceTable.getItem(Key.builder()
                .partitionValue(SpaceEntity.buildPk(spaceId))
                .sortValue(SpaceEntity.SORT_KEY)
                .build());

        if (space == null) {
            throw new ResourceNotFoundException("Space not found: " + spaceId);
        }

        space.setStatus("DELETED");
        spaceTable.putItem(space);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "SPACE_DELETED", spaceId, "SUCCESS");
    }

    public SpaceResponse getSpace(String spaceId) {
        return toResponse(getSpaceEntity(spaceId));
    }

    public SpaceEntity getSpaceEntity(String spaceId) {
        SpaceEntity space = spaceTable.getItem(Key.builder()
                .partitionValue(SpaceEntity.buildPk(spaceId))
                .sortValue(SpaceEntity.SORT_KEY)
                .build());

        if (space == null) {
            throw new ResourceNotFoundException("Space not found: " + spaceId);
        }

        return space;
    }

    private SpaceResponse toResponse(SpaceEntity entity) {
        return new SpaceResponse(
                entity.getSpaceId(),
                entity.getSpaceName(),
                entity.getS3BucketName(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getStatus()
        );
    }
}
