package com.versent.reportportal.shared.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

import java.time.Instant;

@DynamoDbBean
public class FeedbackThreadEntity {

    private String pk;
    private String sk;
    private String threadId;
    private String spaceId;
    private String reportId;
    private String subject;
    private String status;
    private String createdBy;
    private String createdByRole;
    private Instant createdAt;
    private Instant lastMessageAt;
    private String lastMessageBy;
    private Integer messageCount;
    private Boolean unreadByAdmin;
    private Boolean unreadByCustomer;
    private String gsiReportPk;
    private String gsiReportSk;
    private String gsiSpacePk;
    private String gsiSpaceSk;
    private String gsiStatusPk;
    private String gsiStatusSk;

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

    @DynamoDbAttribute("threadId")
    public String getThreadId() {
        return threadId;
    }

    public void setThreadId(String threadId) {
        this.threadId = threadId;
    }

    @DynamoDbAttribute("spaceId")
    public String getSpaceId() {
        return spaceId;
    }

    public void setSpaceId(String spaceId) {
        this.spaceId = spaceId;
    }

    @DynamoDbAttribute("reportId")
    public String getReportId() {
        return reportId;
    }

    public void setReportId(String reportId) {
        this.reportId = reportId;
    }

    @DynamoDbAttribute("subject")
    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    @DynamoDbAttribute("status")
    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @DynamoDbAttribute("createdBy")
    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    @DynamoDbAttribute("createdByRole")
    public String getCreatedByRole() {
        return createdByRole;
    }

    public void setCreatedByRole(String createdByRole) {
        this.createdByRole = createdByRole;
    }

    @DynamoDbAttribute("createdAt")
    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @DynamoDbAttribute("lastMessageAt")
    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(Instant lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }

    @DynamoDbAttribute("lastMessageBy")
    public String getLastMessageBy() {
        return lastMessageBy;
    }

    public void setLastMessageBy(String lastMessageBy) {
        this.lastMessageBy = lastMessageBy;
    }

    @DynamoDbAttribute("messageCount")
    public Integer getMessageCount() {
        return messageCount;
    }

    public void setMessageCount(Integer messageCount) {
        this.messageCount = messageCount;
    }

    @DynamoDbAttribute("unreadByAdmin")
    public Boolean getUnreadByAdmin() {
        return unreadByAdmin;
    }

    public void setUnreadByAdmin(Boolean unreadByAdmin) {
        this.unreadByAdmin = unreadByAdmin;
    }

    @DynamoDbAttribute("unreadByCustomer")
    public Boolean getUnreadByCustomer() {
        return unreadByCustomer;
    }

    public void setUnreadByCustomer(Boolean unreadByCustomer) {
        this.unreadByCustomer = unreadByCustomer;
    }

    @DynamoDbSecondaryPartitionKey(indexNames = "report-threads-index")
    @DynamoDbAttribute("GSI_REPORT_PK")
    public String getGsiReportPk() {
        return gsiReportPk;
    }

    public void setGsiReportPk(String gsiReportPk) {
        this.gsiReportPk = gsiReportPk;
    }

    @DynamoDbSecondarySortKey(indexNames = "report-threads-index")
    @DynamoDbAttribute("GSI_REPORT_SK")
    public String getGsiReportSk() {
        return gsiReportSk;
    }

    public void setGsiReportSk(String gsiReportSk) {
        this.gsiReportSk = gsiReportSk;
    }

    @DynamoDbSecondaryPartitionKey(indexNames = "space-threads-index")
    @DynamoDbAttribute("GSI_SPACE_PK")
    public String getGsiSpacePk() {
        return gsiSpacePk;
    }

    public void setGsiSpacePk(String gsiSpacePk) {
        this.gsiSpacePk = gsiSpacePk;
    }

    @DynamoDbSecondarySortKey(indexNames = "space-threads-index")
    @DynamoDbAttribute("GSI_SPACE_SK")
    public String getGsiSpaceSk() {
        return gsiSpaceSk;
    }

    public void setGsiSpaceSk(String gsiSpaceSk) {
        this.gsiSpaceSk = gsiSpaceSk;
    }

    @DynamoDbSecondaryPartitionKey(indexNames = "status-index")
    @DynamoDbAttribute("GSI_STATUS_PK")
    public String getGsiStatusPk() {
        return gsiStatusPk;
    }

    public void setGsiStatusPk(String gsiStatusPk) {
        this.gsiStatusPk = gsiStatusPk;
    }

    @DynamoDbSecondarySortKey(indexNames = "status-index")
    @DynamoDbAttribute("GSI_STATUS_SK")
    public String getGsiStatusSk() {
        return gsiStatusSk;
    }

    public void setGsiStatusSk(String gsiStatusSk) {
        this.gsiStatusSk = gsiStatusSk;
    }

    public static String buildPk(String threadId) {
        return "THREAD#" + threadId;
    }

    public static final String SORT_KEY = "META";

    public static String buildGsiReportPk(String spaceId, String reportId) {
        return "REPORT#" + spaceId + "#" + reportId;
    }

    public static String buildGsiSpacePk(String spaceId) {
        return "SPACE#" + spaceId;
    }

    public static String buildGsiStatusPk(String status) {
        return "STATUS#" + status;
    }
}
