package com.versent.reportportal.feedback.handler;

import com.versent.reportportal.feedback.dto.AttachmentUploadResponse;
import com.versent.reportportal.feedback.dto.CreateThreadRequest;
import com.versent.reportportal.feedback.dto.MessageResponse;
import com.versent.reportportal.feedback.dto.ReplyRequest;
import com.versent.reportportal.feedback.dto.ThreadResponse;
import com.versent.reportportal.feedback.dto.UpdateStatusRequest;
import com.versent.reportportal.feedback.service.FeedbackService;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.security.RoleChecker;
import jakarta.validation.Valid;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.feedback",
        "com.versent.reportportal.shared"
})
@RestController
public class FeedbackHandler {

    private final FeedbackService feedbackService;
    private final RoleChecker roleChecker;

    public FeedbackHandler(FeedbackService feedbackService, RoleChecker roleChecker) {
        this.feedbackService = feedbackService;
        this.roleChecker = roleChecker;
    }

    public static void main(String[] args) {
        SpringApplication.run(FeedbackHandler.class, args);
    }

    @GetMapping("/spaces/{spaceId}/reports/{reportId}/feedback")
    public ResponseEntity<PaginatedResponse<ThreadResponse>> listThreads(
            @PathVariable String spaceId,
            @PathVariable String reportId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        roleChecker.requireSpaceAccess(spaceId);
        return ResponseEntity.ok(feedbackService.listThreads(spaceId, reportId, cursor,
                Math.min(limit, 100)));
    }

    @PostMapping("/spaces/{spaceId}/reports/{reportId}/feedback")
    public ResponseEntity<ThreadResponse> createThread(
            @PathVariable String spaceId,
            @PathVariable String reportId,
            @Valid @RequestBody CreateThreadRequest request) {
        roleChecker.requireSpaceAccess(spaceId);
        roleChecker.requireNotReadOnly();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(feedbackService.createThread(spaceId, reportId, request));
    }

    @GetMapping("/feedback/threads/{threadId}")
    public ResponseEntity<PaginatedResponse<MessageResponse>> getThread(
            @PathVariable String threadId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(feedbackService.getThreadMessages(threadId, cursor,
                Math.min(limit, 100)));
    }

    @PostMapping("/feedback/threads/{threadId}/reply")
    public ResponseEntity<MessageResponse> replyToThread(
            @PathVariable String threadId,
            @Valid @RequestBody ReplyRequest request) {
        roleChecker.requireNotReadOnly();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(feedbackService.replyToThread(threadId, request));
    }

    @PutMapping("/feedback/threads/{threadId}/status")
    public ResponseEntity<Void> updateThreadStatus(
            @PathVariable String threadId,
            @Valid @RequestBody UpdateStatusRequest request) {
        roleChecker.requireAdmin();
        roleChecker.requireNotReadOnly();
        feedbackService.updateThreadStatus(threadId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/feedback/threads/{threadId}/attachments")
    public ResponseEntity<AttachmentUploadResponse> uploadAttachment(
            @PathVariable String threadId,
            @RequestBody Map<String, Object> request) {
        roleChecker.requireNotReadOnly();
        return ResponseEntity.ok(feedbackService.generateAttachmentUploadUrl(
                threadId,
                (String) request.get("fileName"),
                (String) request.get("contentType"),
                request.get("fileSize") != null ? ((Number) request.get("fileSize")).longValue() : null
        ));
    }

    @GetMapping("/admin/feedback/inbox")
    public ResponseEntity<PaginatedResponse<ThreadResponse>> adminInbox(
            @RequestParam(required = false) String spaceId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        roleChecker.requireAdmin();
        return ResponseEntity.ok(feedbackService.getAdminInbox(spaceId, status, cursor,
                Math.min(limit, 100)));
    }

    @GetMapping("/admin/feedback/inbox/count")
    public ResponseEntity<Map<String, Integer>> adminInboxCount() {
        roleChecker.requireAdmin();
        PaginatedResponse<ThreadResponse> inbox = feedbackService.getAdminInbox(null, "open", null, 1000);
        int unreadCount = (int) inbox.items().stream()
                .filter(t -> Boolean.TRUE.equals(t.unreadByAdmin()))
                .count();
        return ResponseEntity.ok(Map.of("unreadCount", unreadCount));
    }
}
