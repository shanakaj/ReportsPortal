package com.versent.reportportal.analytics.service;

import com.versent.reportportal.analytics.dto.SpaceAnalyticsResponse;
import com.versent.reportportal.analytics.dto.UserAnalyticsResponse;
import com.versent.reportportal.shared.model.AnalyticsEntity;
import com.versent.reportportal.shared.security.SecurityContext;
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
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.core.sync.RequestBody;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    private final DynamoDbTable<AnalyticsEntity> analyticsTable;
    private final DynamoDbIndex<AnalyticsEntity> reportAnalyticsIndex;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String exportBucket;

    public AnalyticsService(DynamoDbEnhancedClient dynamoDbEnhancedClient,
                            S3Client s3Client,
                            S3Presigner s3Presigner,
                            @Value("${dynamodb.tables.analytics:ReportPortal-Analytics}") String tableName,
                            @Value("${s3.export-bucket:report-portal-exports}") String exportBucket) {
        this.analyticsTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(AnalyticsEntity.class));
        this.reportAnalyticsIndex = analyticsTable.index("report-analytics-index");
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.exportBucket = exportBucket;
    }

    public SpaceAnalyticsResponse getSpaceAnalytics(String spaceId, String from, String to) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();

        List<AnalyticsEntity> events = new ArrayList<>();

        LocalDate current = fromDate;
        while (!current.isAfter(toDate)) {
            String pk = AnalyticsEntity.buildPk(spaceId, current.format(DateTimeFormatter.ISO_LOCAL_DATE));

            Iterator<Page<AnalyticsEntity>> pages = analyticsTable.query(
                    QueryConditional.keyEqualTo(Key.builder().partitionValue(pk).build())).iterator();

            while (pages.hasNext()) {
                events.addAll(pages.next().items());
            }

            current = current.plusDays(1);
        }

        int totalViews = (int) events.stream()
                .filter(e -> "report_open".equals(e.getEventType()))
                .count();

        int uniqueUsers = (int) events.stream()
                .map(AnalyticsEntity::getUserId)
                .distinct()
                .count();

        int totalDuration = events.stream()
                .filter(e -> e.getDurationSeconds() != null)
                .mapToInt(AnalyticsEntity::getDurationSeconds)
                .sum();

        Map<String, List<AnalyticsEntity>> byReport = events.stream()
                .filter(e -> e.getReportId() != null)
                .collect(Collectors.groupingBy(AnalyticsEntity::getReportId));

        List<SpaceAnalyticsResponse.ReportAnalytics> reportBreakdown = byReport.entrySet().stream()
                .map(entry -> buildReportAnalytics(entry.getKey(), entry.getValue()))
                .toList();

        Map<String, List<AnalyticsEntity>> byUser = events.stream()
                .collect(Collectors.groupingBy(AnalyticsEntity::getUserId));

        List<SpaceAnalyticsResponse.UserAnalytics> userBreakdown = byUser.entrySet().stream()
                .map(entry -> {
                    String userId = entry.getKey();
                    List<AnalyticsEntity> userEvents = entry.getValue();
                    int viewCount = (int) userEvents.stream()
                            .filter(e -> "report_open".equals(e.getEventType())).count();
                    int duration = userEvents.stream()
                            .filter(e -> e.getDurationSeconds() != null)
                            .mapToInt(AnalyticsEntity::getDurationSeconds).sum();
                    Map<String, Integer> reportViews = userEvents.stream()
                            .filter(e -> "report_open".equals(e.getEventType()) && e.getReportId() != null)
                            .collect(Collectors.groupingBy(AnalyticsEntity::getReportId,
                                    Collectors.summingInt(e -> 1)));

                    String email = userEvents.stream()
                            .findFirst()
                            .map(e -> e.getMetadata() != null ? e.getMetadata().getOrDefault("email", userId) : userId)
                            .orElse(userId);

                    return new SpaceAnalyticsResponse.UserAnalytics(
                            userId, email, viewCount, duration, reportViews);
                })
                .toList();

        return new SpaceAnalyticsResponse(spaceId, totalViews, uniqueUsers, totalDuration,
                reportBreakdown, userBreakdown);
    }

    public UserAnalyticsResponse getUserAnalytics(String userId, String from, String to) {
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? LocalDate.parse(to) : LocalDate.now();

        List<AnalyticsEntity> allEvents = new ArrayList<>();

        // Scan all analytics for this user across date range
        LocalDate current = fromDate;
        while (!current.isAfter(toDate)) {
            // We need to scan and filter by userId since primary key is spaceId + date
            current = current.plusDays(1);
        }

        // For user analytics, use a broader scan filtered by userId
        Iterator<Page<AnalyticsEntity>> pages = analyticsTable.scan().iterator();
        while (pages.hasNext()) {
            pages.next().items().stream()
                    .filter(e -> userId.equals(e.getUserId()))
                    .forEach(allEvents::add);
        }

        int totalViews = (int) allEvents.stream()
                .filter(e -> "report_open".equals(e.getEventType())).count();
        int totalDuration = allEvents.stream()
                .filter(e -> e.getDurationSeconds() != null)
                .mapToInt(AnalyticsEntity::getDurationSeconds).sum();

        Map<String, List<AnalyticsEntity>> byReport = allEvents.stream()
                .filter(e -> e.getReportId() != null)
                .collect(Collectors.groupingBy(AnalyticsEntity::getReportId));

        List<UserAnalyticsResponse.ReportView> reportViews = byReport.entrySet().stream()
                .map(entry -> {
                    String reportId = entry.getKey();
                    List<AnalyticsEntity> reportEvents = entry.getValue();
                    String spaceId = reportEvents.stream().findFirst()
                            .map(AnalyticsEntity::getSpaceId).orElse("");
                    int viewCount = (int) reportEvents.stream()
                            .filter(e -> "report_open".equals(e.getEventType())).count();
                    int duration = reportEvents.stream()
                            .filter(e -> e.getDurationSeconds() != null)
                            .mapToInt(AnalyticsEntity::getDurationSeconds).sum();
                    String viewMode = reportEvents.stream().findFirst()
                            .map(AnalyticsEntity::getViewMode).orElse("full-tab");

                    List<UserAnalyticsResponse.TabView> tabViews = buildTabViews(reportEvents);

                    return new UserAnalyticsResponse.ReportView(
                            reportId, spaceId, "", viewCount, duration, viewMode, tabViews);
                })
                .toList();

        String email = allEvents.stream().findFirst()
                .map(e -> e.getMetadata() != null ? e.getMetadata().getOrDefault("email", userId) : userId)
                .orElse(userId);

        return new UserAnalyticsResponse(userId, email, totalViews, totalDuration, reportViews);
    }

    public String exportAnalytics(String spaceId, String from, String to, String format) {
        SecurityContext.AuthenticatedUser currentUser = SecurityContext.getCurrentUser();

        SpaceAnalyticsResponse analytics = getSpaceAnalytics(spaceId, from, to);

        String exportFormat = format != null ? format : "json";
        String fileName = "analytics-export-" + spaceId + "-" + UUID.randomUUID() + "." + exportFormat;
        String s3Key = "exports/" + currentUser.userId() + "/" + fileName;

        String content;
        String contentType;

        if ("csv".equals(exportFormat)) {
            content = convertToCsv(analytics);
            contentType = "text/csv";
        } else {
            content = convertToJson(analytics);
            contentType = "application/json";
        }

        s3Client.putObject(PutObjectRequest.builder()
                        .bucket(exportBucket)
                        .key(s3Key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromString(content));

        PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(
                GetObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofHours(1))
                        .getObjectRequest(r -> r.bucket(exportBucket).key(s3Key))
                        .build());

        return presignedRequest.url().toString();
    }

    private SpaceAnalyticsResponse.ReportAnalytics buildReportAnalytics(String reportId,
                                                                         List<AnalyticsEntity> events) {
        int viewCount = (int) events.stream()
                .filter(e -> "report_open".equals(e.getEventType())).count();
        int duration = events.stream()
                .filter(e -> e.getDurationSeconds() != null)
                .mapToInt(AnalyticsEntity::getDurationSeconds).sum();

        Map<String, TabAggregate> tabMap = new HashMap<>();
        events.stream()
                .filter(e -> "tab_view".equals(e.getEventType()) && e.getTabHash() != null)
                .forEach(e -> {
                    TabAggregate agg = tabMap.computeIfAbsent(e.getTabHash(),
                            k -> new TabAggregate(e.getTabHash(),
                                    e.getTabLabel() != null ? e.getTabLabel() : e.getTabHash()));
                    agg.viewCount++;
                    if (e.getDurationSeconds() != null) {
                        agg.totalDuration += e.getDurationSeconds();
                    }
                });

        List<SpaceAnalyticsResponse.TabAnalytics> tabBreakdown = tabMap.values().stream()
                .map(agg -> new SpaceAnalyticsResponse.TabAnalytics(
                        agg.tabHash, agg.tabLabel, agg.viewCount, agg.totalDuration))
                .toList();

        String fileName = events.stream().findFirst()
                .map(e -> e.getMetadata() != null ? e.getMetadata().getOrDefault("fileName", reportId) : reportId)
                .orElse(reportId);

        return new SpaceAnalyticsResponse.ReportAnalytics(reportId, fileName, viewCount, duration, tabBreakdown);
    }

    private List<UserAnalyticsResponse.TabView> buildTabViews(List<AnalyticsEntity> events) {
        Map<String, TabAggregate> tabMap = new HashMap<>();
        events.stream()
                .filter(e -> "tab_view".equals(e.getEventType()) && e.getTabHash() != null)
                .forEach(e -> {
                    TabAggregate agg = tabMap.computeIfAbsent(e.getTabHash(),
                            k -> new TabAggregate(e.getTabHash(),
                                    e.getTabLabel() != null ? e.getTabLabel() : e.getTabHash()));
                    agg.viewCount++;
                    if (e.getDurationSeconds() != null) {
                        agg.totalDuration += e.getDurationSeconds();
                    }
                });

        return tabMap.values().stream()
                .map(agg -> new UserAnalyticsResponse.TabView(
                        agg.tabHash, agg.tabLabel, agg.viewCount, agg.totalDuration))
                .toList();
    }

    private String convertToCsv(SpaceAnalyticsResponse analytics) {
        StringBuilder sb = new StringBuilder();
        sb.append("ReportId,FileName,ViewCount,TotalDurationSeconds,TabHash,TabLabel,TabViewCount,TabDurationSeconds\n");

        for (var report : analytics.reportBreakdown()) {
            if (report.tabBreakdown().isEmpty()) {
                sb.append(String.format("%s,%s,%d,%d,,,,\n",
                        report.reportId(), report.fileName(), report.viewCount(), report.totalDurationSeconds()));
            } else {
                for (var tab : report.tabBreakdown()) {
                    sb.append(String.format("%s,%s,%d,%d,%s,%s,%d,%d\n",
                            report.reportId(), report.fileName(), report.viewCount(),
                            report.totalDurationSeconds(), tab.tabHash(), tab.tabLabel(),
                            tab.viewCount(), tab.totalDurationSeconds()));
                }
            }
        }

        return sb.toString();
    }

    private String convertToJson(SpaceAnalyticsResponse analytics) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(analytics);
        } catch (Exception e) {
            throw new RuntimeException("Failed to convert analytics to JSON", e);
        }
    }

    private static class TabAggregate {
        String tabHash;
        String tabLabel;
        int viewCount;
        int totalDuration;

        TabAggregate(String tabHash, String tabLabel) {
            this.tabHash = tabHash;
            this.tabLabel = tabLabel;
        }
    }
}
