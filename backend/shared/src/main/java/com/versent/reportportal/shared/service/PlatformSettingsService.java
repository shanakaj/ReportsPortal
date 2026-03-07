package com.versent.reportportal.shared.service;

import com.versent.reportportal.shared.model.PlatformSettingsEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class PlatformSettingsService {

    private static final Logger log = LoggerFactory.getLogger(PlatformSettingsService.class);
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    private final DynamoDbTable<PlatformSettingsEntity> settingsTable;
    private final AtomicReference<CachedSettings> cache = new AtomicReference<>();

    public PlatformSettingsService(
            DynamoDbEnhancedClient dynamoDbEnhancedClient,
            @Value("${dynamodb.tables.platform-settings:ReportPortal-PlatformSettings}") String tableName) {
        this.settingsTable = dynamoDbEnhancedClient.table(tableName,
                TableSchema.fromBean(PlatformSettingsEntity.class));
    }

    public PlatformSettingsEntity getSettings() {
        CachedSettings cached = cache.get();
        if (cached != null && !cached.isExpired()) {
            return cached.settings;
        }

        PlatformSettingsEntity settings = settingsTable.getItem(Key.builder()
                .partitionValue(PlatformSettingsEntity.PK_VALUE)
                .sortValue(PlatformSettingsEntity.SK_VALUE)
                .build());

        if (settings == null) {
            settings = createDefaults();
        }

        cache.set(new CachedSettings(settings));
        return settings;
    }

    public PlatformSettingsEntity saveSettings(PlatformSettingsEntity settings) {
        settings.setPk(PlatformSettingsEntity.PK_VALUE);
        settings.setSk(PlatformSettingsEntity.SK_VALUE);
        settings.setUpdatedAt(Instant.now());

        settingsTable.putItem(settings);
        cache.set(new CachedSettings(settings));

        log.info("Platform settings updated by: {}", settings.getUpdatedBy());
        return settings;
    }

    public void invalidateCache() {
        cache.set(null);
    }

    private PlatformSettingsEntity createDefaults() {
        PlatformSettingsEntity defaults = new PlatformSettingsEntity();
        defaults.setPk(PlatformSettingsEntity.PK_VALUE);
        defaults.setSk(PlatformSettingsEntity.SK_VALUE);
        defaults.setOrganizationName("Report Portal");
        defaults.setOrganizationLegalEntity("");
        defaults.setAllowedAdminDomains(List.of("versent.com.au"));
        defaults.setDomainValidationMode("warn");
        defaults.setMaxReportFileSizeMb(50L);
        defaults.setMaxFeedbackAttachmentSizeMb(10L);
        defaults.setSignedCookieTtlHours(3);
        defaults.setInvitationExpiryHours(24);
        defaults.setNotifyOnInvitationAccepted(true);
        defaults.setNotifyFeedbackByEmail(false);
        return defaults;
    }

    private static class CachedSettings {
        final PlatformSettingsEntity settings;
        final long fetchedAt;

        CachedSettings(PlatformSettingsEntity settings) {
            this.settings = settings;
            this.fetchedAt = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - fetchedAt > CACHE_TTL_MS;
        }
    }
}
