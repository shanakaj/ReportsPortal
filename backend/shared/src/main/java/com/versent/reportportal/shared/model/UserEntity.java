package com.versent.reportportal.shared.model;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

import java.time.Instant;
import java.util.List;

@DynamoDbBean
public class UserEntity {

    private String pk;
    private String sk;
    private String userId;
    private String email;
    private String fullName;
    private String phone;
    private String company;
    private UserRole role;
    private List<String> customerSpaces;
    private String invitedBy;
    private String status;
    private Boolean mfaEnabled;
    private Instant createdAt;
    private Instant lastLogin;
    private Boolean analyticsConsent;
    private String preferredViewMode;

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

    @DynamoDbAttribute("userId")
    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    @DynamoDbAttribute("email")
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    @DynamoDbAttribute("fullName")
    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    @DynamoDbAttribute("phone")
    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    @DynamoDbAttribute("company")
    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    @DynamoDbAttribute("role")
    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    @DynamoDbAttribute("customerSpaces")
    public List<String> getCustomerSpaces() {
        return customerSpaces;
    }

    public void setCustomerSpaces(List<String> customerSpaces) {
        this.customerSpaces = customerSpaces;
    }

    @DynamoDbAttribute("invitedBy")
    public String getInvitedBy() {
        return invitedBy;
    }

    public void setInvitedBy(String invitedBy) {
        this.invitedBy = invitedBy;
    }

    @DynamoDbAttribute("status")
    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @DynamoDbAttribute("mfaEnabled")
    public Boolean getMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(Boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    @DynamoDbAttribute("createdAt")
    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @DynamoDbAttribute("lastLogin")
    public Instant getLastLogin() {
        return lastLogin;
    }

    public void setLastLogin(Instant lastLogin) {
        this.lastLogin = lastLogin;
    }

    @DynamoDbAttribute("analyticsConsent")
    public Boolean getAnalyticsConsent() {
        return analyticsConsent;
    }

    public void setAnalyticsConsent(Boolean analyticsConsent) {
        this.analyticsConsent = analyticsConsent;
    }

    @DynamoDbAttribute("preferredViewMode")
    public String getPreferredViewMode() {
        return preferredViewMode;
    }

    public void setPreferredViewMode(String preferredViewMode) {
        this.preferredViewMode = preferredViewMode;
    }

    public static String buildPk(String userId) {
        return "USER#" + userId;
    }

    public static final String SORT_KEY = "PROFILE";
}
