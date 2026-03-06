package com.versent.reportportal.shared.dto;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

public final class CursorUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private CursorUtil() {
    }

    public static String encode(Map<String, AttributeValue> lastEvaluatedKey) {
        if (lastEvaluatedKey == null || lastEvaluatedKey.isEmpty()) {
            return null;
        }

        try {
            Map<String, String> serializable = new HashMap<>();
            lastEvaluatedKey.forEach((key, value) -> serializable.put(key, value.s()));
            String json = MAPPER.writeValueAsString(serializable);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes());
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to encode cursor", e);
        }
    }

    public static Map<String, AttributeValue> decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }

        try {
            String json = new String(Base64.getUrlDecoder().decode(cursor));
            Map<String, String> deserialized = MAPPER.readValue(json, new TypeReference<>() {
            });

            Map<String, AttributeValue> lastEvaluatedKey = new HashMap<>();
            deserialized.forEach((key, value) ->
                    lastEvaluatedKey.put(key, AttributeValue.builder().s(value).build()));
            return lastEvaluatedKey;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid cursor format", e);
        }
    }
}
