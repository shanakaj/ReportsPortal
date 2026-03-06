package com.versent.reportportal.analytics.dto;

import java.util.List;
import java.util.Map;

public record SpaceAnalyticsResponse(
        String spaceId,
        int totalViews,
        int uniqueUsers,
        int totalDurationSeconds,
        List<ReportAnalytics> reportBreakdown,
        List<UserAnalytics> userBreakdown
) {
    public record ReportAnalytics(
            String reportId,
            String fileName,
            int viewCount,
            int totalDurationSeconds,
            List<TabAnalytics> tabBreakdown
    ) {
    }

    public record TabAnalytics(
            String tabHash,
            String tabLabel,
            int viewCount,
            int totalDurationSeconds
    ) {
    }

    public record UserAnalytics(
            String userId,
            String email,
            int viewCount,
            int totalDurationSeconds,
            Map<String, Integer> reportViews
    ) {
    }
}
