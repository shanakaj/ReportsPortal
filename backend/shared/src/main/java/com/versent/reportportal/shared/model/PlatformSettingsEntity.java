package com.versent.reportportal.shared.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

import java.time.Instant;
import java.util.List;

@DynamoDbBean
public class PlatformSettingsEntity {

    public static final String PK_VALUE = "SETTINGS";
    public static final String SK_VALUE = "GLOBAL";

    private String pk;
    private String sk;

    // Organization
    private String organizationName;
    private String organizationLegalEntity;
    private List<String> allowedAdminDomains;

    // Customer invitation domain validation
    private String domainValidationMode; // off, warn, strict

    // Upload limits (bytes)
    private Long maxReportFileSizeMb;
    private Long maxFeedbackAttachmentSizeMb;

    // Security
    private Integer signedCookieTtlHours;
    private Integer invitationExpiryHours;

    // Notifications
    private Boolean notifyOnInvitationAccepted;
    private Boolean notifyFeedbackByEmail;

    // Metadata
    private Instant updatedAt;
    private String updatedBy;

    @DynamoDbPartitionKey
    @DynamoDbAttribute("PK")
    public String getPk() { return pk; }
    public void setPk(String pk) { this.pk = pk; }

    @DynamoDbSortKey
    @DynamoDbAttribute("SK")
    public String getSk() { return sk; }
    public void setSk(String sk) { this.sk = sk; }

    @DynamoDbAttribute("organizationName")
    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    @DynamoDbAttribute("organizationLegalEntity")
    public String getOrganizationLegalEntity() { return organizationLegalEntity; }
    public void setOrganizationLegalEntity(String organizationLegalEntity) { this.organizationLegalEntity = organizationLegalEntity; }

    @DynamoDbAttribute("allowedAdminDomains")
    public List<String> getAllowedAdminDomains() { return allowedAdminDomains; }
    public void setAllowedAdminDomains(List<String> allowedAdminDomains) { this.allowedAdminDomains = allowedAdminDomains; }

    @DynamoDbAttribute("domainValidationMode")
    public String getDomainValidationMode() { return domainValidationMode; }
    public void setDomainValidationMode(String domainValidationMode) { this.domainValidationMode = domainValidationMode; }

    @DynamoDbAttribute("maxReportFileSizeMb")
    public Long getMaxReportFileSizeMb() { return maxReportFileSizeMb; }
    public void setMaxReportFileSizeMb(Long maxReportFileSizeMb) { this.maxReportFileSizeMb = maxReportFileSizeMb; }

    @DynamoDbAttribute("maxFeedbackAttachmentSizeMb")
    public Long getMaxFeedbackAttachmentSizeMb() { return maxFeedbackAttachmentSizeMb; }
    public void setMaxFeedbackAttachmentSizeMb(Long maxFeedbackAttachmentSizeMb) { this.maxFeedbackAttachmentSizeMb = maxFeedbackAttachmentSizeMb; }

    @DynamoDbAttribute("signedCookieTtlHours")
    public Integer getSignedCookieTtlHours() { return signedCookieTtlHours; }
    public void setSignedCookieTtlHours(Integer signedCookieTtlHours) { this.signedCookieTtlHours = signedCookieTtlHours; }

    @DynamoDbAttribute("invitationExpiryHours")
    public Integer getInvitationExpiryHours() { return invitationExpiryHours; }
    public void setInvitationExpiryHours(Integer invitationExpiryHours) { this.invitationExpiryHours = invitationExpiryHours; }

    @DynamoDbAttribute("notifyOnInvitationAccepted")
    public Boolean getNotifyOnInvitationAccepted() { return notifyOnInvitationAccepted; }
    public void setNotifyOnInvitationAccepted(Boolean notifyOnInvitationAccepted) { this.notifyOnInvitationAccepted = notifyOnInvitationAccepted; }

    @DynamoDbAttribute("notifyFeedbackByEmail")
    public Boolean getNotifyFeedbackByEmail() { return notifyFeedbackByEmail; }
    public void setNotifyFeedbackByEmail(Boolean notifyFeedbackByEmail) { this.notifyFeedbackByEmail = notifyFeedbackByEmail; }

    @DynamoDbAttribute("updatedAt")
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    @DynamoDbAttribute("updatedBy")
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
