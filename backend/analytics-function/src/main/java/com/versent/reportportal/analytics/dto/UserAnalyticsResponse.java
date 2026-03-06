package com.versent.reportportal.analytics.dto;

import java.util.List;

public record UserAnalyticsResponse(
        String userId,
        String email,
        int totalViews,
        int totalDurationSeconds,
        List<ReportView> reportViews
) {
    public record ReportView(
            String reportId,
            String spaceId,
            String fileName,
            int viewCount,
            int totalDurationSeconds,
            String viewMode,
            List<TabView> tabViews
    ) {
    }

    public record TabView(
            String tabHash,
            String tabLabel,
            int viewCount,
            int totalDurationSeconds
    ) {
    }
}
