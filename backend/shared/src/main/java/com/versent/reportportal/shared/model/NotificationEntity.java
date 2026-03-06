package com.versent.reportportal.shared.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

import java.time.Instant;

@DynamoDbBean
public class NotificationEntity {

    private String pk;
    private String sk;
    private String notificationId;
    private String userId;
    private String type;
    private String message;
    private String relatedSpaceId;
    private String relatedUserId;
    private String relatedThreadId;
    private Boolean read;
    private Instant createdAt;
    private Long ttl;
    private String gsiUnreadPk;
    private String gsiUnreadSk;

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

    @DynamoDbAttribute("notificationId")
    public String getNotificationId() {
        return notificationId;
    }

    public void setNotificationId(String notificationId) {
        this.notificationId = notificationId;
    }

    @DynamoDbAttribute("userId")
    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    @DynamoDbAttribute("type")
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    @DynamoDbAttribute("message")
    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    @DynamoDbAttribute("relatedSpaceId")
    public String getRelatedSpaceId() {
        return relatedSpaceId;
    }

    public void setRelatedSpaceId(String relatedSpaceId) {
        this.relatedSpaceId = relatedSpaceId;
    }

    @DynamoDbAttribute("relatedUserId")
    public String getRelatedUserId() {
        return relatedUserId;
    }

    public void setRelatedUserId(String relatedUserId) {
        this.relatedUserId = relatedUserId;
    }

    @DynamoDbAttribute("relatedThreadId")
    public String getRelatedThreadId() {
        return relatedThreadId;
    }

    public void setRelatedThreadId(String relatedThreadId) {
        this.relatedThreadId = relatedThreadId;
    }

    @DynamoDbAttribute("read")
    public Boolean getRead() {
        return read;
    }

    public void setRead(Boolean read) {
        this.read = read;
    }

    @DynamoDbAttribute("createdAt")
    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @DynamoDbAttribute("ttl")
    public Long getTtl() {
        return ttl;
    }

    public void setTtl(Long ttl) {
        this.ttl = ttl;
    }

    @DynamoDbSecondaryPartitionKey(indexNames = "unread-index")
    @DynamoDbAttribute("GSI_UNREAD_PK")
    public String getGsiUnreadPk() {
        return gsiUnreadPk;
    }

    public void setGsiUnreadPk(String gsiUnreadPk) {
        this.gsiUnreadPk = gsiUnreadPk;
    }

    @DynamoDbSecondarySortKey(indexNames = "unread-index")
    @DynamoDbAttribute("GSI_UNREAD_SK")
    public String getGsiUnreadSk() {
        return gsiUnreadSk;
    }

    public void setGsiUnreadSk(String gsiUnreadSk) {
        this.gsiUnreadSk = gsiUnreadSk;
    }

    public static String buildPk(String userId) {
        return "NOTIFICATION#" + userId;
    }

    public static String buildSk(String timestamp, String notificationId) {
        return timestamp + "#" + notificationId;
    }
}
