package com.versent.reportportal.shared.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

import java.time.Instant;
import java.util.Map;

@DynamoDbBean
public class AnalyticsEntity {

    private String pk;
    private String sk;
    private String eventId;
    private String userId;
    private String reportId;
    private String spaceId;
    private String eventType;
    private String tabHash;
    private String tabLabel;
    private Integer durationSeconds;
    private String viewMode;
    private String device;
    private String browser;
    private Map<String, String> metadata;
    private Instant timestamp;
    private Long ttl;
    private String gsiReportPk;
    private String gsiReportSk;

    @DynamoDbPartitionKey
    @DynamoDbAttribute("PK")
    public String getPk() {
        return pk;
    }

    public void setPk(String pk) {
        this.pk = pk;
    }

    @DynamoDbSortKey
    @DynamoDbAttribute("SK")
    public String getSk() {
        return sk;
    }

    public void setSk(String sk) {
        this.sk = sk;
    }

    @DynamoDbAttribute("eventId")
    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    @DynamoDbAttribute("userId")
    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    @DynamoDbAttribute("reportId")
    public String getReportId() {
        return reportId;
    }

    public void setReportId(String reportId) {
        this.reportId = reportId;
    }

    @DynamoDbAttribute("spaceId")
    public String getSpaceId() {
        return spaceId;
    }

    public void setSpaceId(String spaceId) {
        this.spaceId = spaceId;
    }

    @DynamoDbAttribute("eventType")
    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    @DynamoDbAttribute("tabHash")
    public String getTabHash() {
        return tabHash;
    }

    public void setTabHash(String tabHash) {
        this.tabHash = tabHash;
    }

    @DynamoDbAttribute("tabLabel")
    public String getTabLabel() {
        return tabLabel;
    }

    public void setTabLabel(String tabLabel) {
        this.tabLabel = tabLabel;
    }

    @DynamoDbAttribute("durationSeconds")
    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    @DynamoDbAttribute("viewMode")
    public String getViewMode() {
        return viewMode;
    }

    public void setViewMode(String viewMode) {
        this.viewMode = viewMode;
    }

    @DynamoDbAttribute("device")
    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    @DynamoDbAttribute("browser")
    public String getBrowser() {
        return browser;
    }

    public void setBrowser(String browser) {
        this.browser = browser;
    }

    @DynamoDbAttribute("metadata")
    public Map<String, String> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, String> metadata) {
        this.metadata = metadata;
    }

    @DynamoDbAttribute("timestamp")
    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    @DynamoDbAttribute("ttl")
    public Long getTtl() {
        return ttl;
    }

    public void setTtl(Long ttl) {
        this.ttl = ttl;
    }

    @DynamoDbSecondaryPartitionKey(indexNames = "report-analytics-index")
    @DynamoDbAttribute("GSI_REPORT_PK")
    public String getGsiReportPk() {
        return gsiReportPk;
    }

    public void setGsiReportPk(String gsiReportPk) {
        this.gsiReportPk = gsiReportPk;
    }

    @DynamoDbSecondarySortKey(indexNames = "report-analytics-index")
    @DynamoDbAttribute("GSI_REPORT_SK")
    public String getGsiReportSk() {
        return gsiReportSk;
    }

    public void setGsiReportSk(String gsiReportSk) {
        this.gsiReportSk = gsiReportSk;
    }

    public static String buildPk(String spaceId, String date) {
        return "ANALYTICS#" + spaceId + "#" + date;
    }

    public static String buildSk(String timestamp, String eventId) {
        return timestamp + "#" + eventId;
    }

    public static String buildGsiReportPk(String spaceId, String reportId) {
        return "REPORT#" + spaceId + "#" + reportId;
    }
}
