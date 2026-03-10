package com.versent.reportportal.customer.service;

import com.versent.reportportal.customer.dto.CustomerReportResponse;
import com.versent.reportportal.customer.dto.CustomerSpaceResponse;
import com.versent.reportportal.customer.dto.PreferencesRequest;
import com.versent.reportportal.customer.dto.ReportViewResponse;
import com.versent.reportportal.shared.dto.CursorUtil;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.exception.ResourceNotFoundException;
import com.versent.reportportal.shared.model.ReportEntity;
import com.versent.reportportal.shared.model.SpaceEntity;
import com.versent.reportportal.shared.model.UserEntity;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.service.AuditService;
import com.versent.reportportal.shared.service.SignedCookieService;
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

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Service
public class CustomerService {

    private static final Logger log = LoggerFactory.getLogger(CustomerService.class);

    private final DynamoDbTable<UserEntity> userTable;
    private final DynamoDbTable<SpaceEntity> spaceTable;
    private final DynamoDbTable<ReportEntity> reportTable;
    private final SignedCookieService signedCookieService;
    private final AuditService auditService;

    public CustomerService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                           SignedCookieService signedCookieService,
                           AuditService auditService,
                           @Value("${dynamodb.tables.users:ReportPortal-Users}") String userTableName,
                           @Value("${dynamodb.tables.spaces:ReportPortal-Spaces}") String spaceTableName,
                           @Value("${dynamodb.tables.reports:ReportPortal-Reports}") String reportTableName) {
        this.userTable = dynamoDbEnhancedClient.table(userTableName,
                TableSchema.fromBean(UserEntity.class));
        this.spaceTable = dynamoDbEnhancedClient.table(spaceTableName,
                TableSchema.fromBean(SpaceEntity.class));
        this.reportTable = dynamoDbEnhancedClient.table(reportTableName,
                TableSchema.fromBean(ReportEntity.class));
        this.signedCookieService = signedCookieService;
        this.auditService = auditService;
    }

    public List<CustomerSpaceResponse> listSpaces() {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();
        List<String> spaceIds = currentUser.customerSpaces();

        if (spaceIds == null || spaceIds.isEmpty()) {
            return List.of();
        }

        List<CustomerSpaceResponse> spaces = new ArrayList<>();

        for (String spaceId : spaceIds) {
            SpaceEntity space = spaceTable.getItem(Key.builder()
                    .partitionValue(SpaceEntity.buildPk(spaceId))
                    .sortValue(SpaceEntity.SORT_KEY)
                    .build());

            if (space != null && "ACTIVE".equals(space.getStatus())) {
                int reportCount = countReports(spaceId);
                spaces.add(new CustomerSpaceResponse(
                        space.getSpaceId(),
                        space.getSpaceName(),
                        space.getCreatedAt(),
                        space.getStatus(),
                        reportCount
                ));
            }
        }

        return spaces;
    }

    public PaginatedResponse<CustomerReportResponse> listReports(String spaceId, String cursor, int limit) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        if (!currentUser.hasAccessToSpace(spaceId)) {
            throw new SecurityException("User does not have access to space: " + spaceId);
        }

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

        List<CustomerReportResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (pages.hasNext()) {
            Page<ReportEntity> page = pages.next();
            items = page.items().stream()
                    .filter(r -> "ACTIVE".equals(r.getStatus()) || "PENDING_UPLOAD".equals(r.getStatus()))
                    .map(this::toCustomerReportResponse)
                    .toList();

            if (page.lastEvaluatedKey() != null) {
                nextCursor = CursorUtil.encode(page.lastEvaluatedKey());
            }
        }

        return PaginatedResponse.of(items, nextCursor);
    }

    public ReportViewResponse getReport(String spaceId, String reportId) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        if (!currentUser.hasAccessToSpace(spaceId)) {
            throw new SecurityException("User does not have access to space: " + spaceId);
        }

        ReportEntity report = reportTable.getItem(Key.builder()
                .partitionValue(ReportEntity.buildPk(spaceId))
                .sortValue(ReportEntity.buildSk(reportId))
                .build());

        if (report == null) {
            throw new ResourceNotFoundException("Report not found: " + reportId);
        }

        SignedCookieService.SignedCookieResult cookieResult = signedCookieService.generateSignedCookies(spaceId);

        // Return relative path — the SPA is served from the same CloudFront distribution
        // S3 serving bucket stores files as {spaceId}/{reportId}/{fileName}
        String reportPath = "/reports/" + spaceId + "/" + report.getS3Key();

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "REPORT_VIEWED", spaceId + "/" + reportId, "SUCCESS");

        return new ReportViewResponse(
                new ReportViewResponse.ReportInfo(
                        report.getReportId(),
                        report.getSpaceId(),
                        report.getFileName(),
                        report.getS3Key(),
                        report.getUploadedAt(),
                        report.getFileSize()
                ),
                reportPath,
                cookieResult.cookies(),
                cookieResult.expiresAt()
        );
    }

    public void updatePreferences(PreferencesRequest request) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        UserEntity user = userTable.getItem(Key.builder()
                .partitionValue(UserEntity.buildPk(currentUser.userId()))
                .sortValue(UserEntity.SORT_KEY)
                .build());

        if (user == null) {
            throw new ResourceNotFoundException("User not found");
        }

        if (request.preferredViewMode() != null) {
            user.setPreferredViewMode(request.preferredViewMode());
        }
        if (request.analyticsConsent() != null) {
            user.setAnalyticsConsent(request.analyticsConsent());
        }

        userTable.putItem(user);

        auditService.logEvent(currentUser.userId(), currentUser.email(),
                "PREFERENCES_UPDATED", currentUser.userId(), "SUCCESS");
    }

    private int countReports(String spaceId) {
        int count = 0;
        Iterator<Page<ReportEntity>> pages = reportTable.query(
                QueryConditional.sortBeginsWith(
                        Key.builder()
                                .partitionValue(ReportEntity.buildPk(spaceId))
                                .sortValue("REPORT#")
                                .build())).iterator();

        while (pages.hasNext()) {
            count += pages.next().items().size();
        }
        return count;
    }

    private CustomerReportResponse toCustomerReportResponse(ReportEntity entity) {
        return new CustomerReportResponse(
                entity.getReportId(),
                entity.getSpaceId(),
                entity.getFileName(),
                entity.getUploadedAt(),
                entity.getFileSize()
        );
    }
}
