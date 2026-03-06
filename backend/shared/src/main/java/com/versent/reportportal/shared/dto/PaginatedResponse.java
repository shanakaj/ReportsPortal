package com.versent.reportportal.shared.dto;

import java.util.List;

public record PaginatedResponse<T>(
        List<T> items,
        String nextCursor,
        boolean hasMore
) {
    public static <T> PaginatedResponse<T> of(List<T> items, String nextCursor) {
        return new PaginatedResponse<>(items, nextCursor, nextCursor != null);
    }

    public static <T> PaginatedResponse<T> empty() {
        return new PaginatedResponse<>(List.of(), null, false);
    }
}
