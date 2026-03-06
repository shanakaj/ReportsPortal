package com.versent.reportportal.shared.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequest;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequestEntry;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResponse;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResultEntry;

import java.util.Map;

@Service
public class EventBridgeService {

    private static final Logger log = LoggerFactory.getLogger(EventBridgeService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule());

    private final EventBridgeClient eventBridgeClient;
    private final String eventBusName;
    private final String source;

    public EventBridgeService(EventBridgeClient eventBridgeClient,
                              @Value("${eventbridge.bus-name:report-portal-events}") String eventBusName,
                              @Value("${eventbridge.source:com.versent.reportportal}") String source) {
        this.eventBridgeClient = eventBridgeClient;
        this.eventBusName = eventBusName;
        this.source = source;
    }

    public void publishEvent(String detailType, Map<String, Object> detail) {
        try {
            String detailJson = MAPPER.writeValueAsString(detail);

            PutEventsRequestEntry entry = PutEventsRequestEntry.builder()
                    .eventBusName(eventBusName)
                    .source(source)
                    .detailType(detailType)
                    .detail(detailJson)
                    .build();

            PutEventsRequest request = PutEventsRequest.builder()
                    .entries(entry)
                    .build();

            PutEventsResponse response = eventBridgeClient.putEvents(request);

            for (PutEventsResultEntry resultEntry : response.entries()) {
                if (resultEntry.errorCode() != null) {
                    log.error("Failed to publish event: type={}, errorCode={}, errorMessage={}",
                            detailType, resultEntry.errorCode(), resultEntry.errorMessage());
                } else {
                    log.info("Event published: type={}, eventId={}", detailType, resultEntry.eventId());
                }
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event detail: type={}", detailType, e);
            throw new RuntimeException("Failed to publish event", e);
        }
    }

    public void publishFeedbackNewEvent(String threadId, String spaceId, String reportId,
                                        String authorId, String authorName, String subject) {
        publishEvent("feedback.new", Map.of(
                "threadId", threadId,
                "spaceId", spaceId,
                "reportId", reportId,
                "authorId", authorId,
                "authorName", authorName,
                "subject", subject
        ));
    }

    public void publishFeedbackReplyEvent(String threadId, String spaceId, String reportId,
                                          String authorId, String authorName, String messageId) {
        publishEvent("feedback.reply", Map.of(
                "threadId", threadId,
                "spaceId", spaceId,
                "reportId", reportId,
                "authorId", authorId,
                "authorName", authorName,
                "messageId", messageId
        ));
    }

    public void publishFirstLoginEvent(String userId, String email, String fullName,
                                       String spaceId, String invitedBy) {
        publishEvent("user.first_login", Map.of(
                "userId", userId,
                "email", email,
                "fullName", fullName,
                "spaceId", spaceId,
                "invitedBy", invitedBy
        ));
    }

    public void publishFeedbackStatusChangeEvent(String threadId, String spaceId,
                                                  String newStatus, String changedBy) {
        publishEvent("feedback.status_changed", Map.of(
                "threadId", threadId,
                "spaceId", spaceId,
                "newStatus", newStatus,
                "changedBy", changedBy
        ));
    }
}
