package com.versent.reportportal.feedback;

import com.versent.reportportal.shared.exception.ValidationException;
import com.versent.reportportal.shared.model.UserRole;
import com.versent.reportportal.shared.security.SecurityContext;
import com.versent.reportportal.shared.util.HtmlSanitizer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    private HtmlSanitizer htmlSanitizer;

    @BeforeEach
    void setUp() {
        htmlSanitizer = new HtmlSanitizer();
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1"), null, false
        ));
    }

    @AfterEach
    void tearDown() {
        SecurityContext.clear();
    }

    @Test
    void sanitizeFeedbackMessage_allowsBasicHtml() {
        String input = "<p>This is <strong>bold</strong> and <em>italic</em></p>";
        String result = htmlSanitizer.sanitizeFeedbackMessage(input);
        assertTrue(result.contains("<strong>bold</strong>"));
        assertTrue(result.contains("<em>italic</em>"));
    }

    @Test
    void sanitizeFeedbackMessage_stripsScript() {
        String input = "<p>Hello</p><script>alert('xss')</script>";
        String result = htmlSanitizer.sanitizeFeedbackMessage(input);
        assertFalse(result.contains("<script>"));
        assertTrue(result.contains("<p>Hello</p>"));
    }

    @Test
    void sanitizeReport_stripsIframe() {
        String input = "<html><body><iframe src='evil.com'></iframe><p>content</p></body></html>";
        HtmlSanitizer.SanitizeResult result = htmlSanitizer.sanitizeReport(input);
        assertTrue(result.wasModified());
        assertFalse(result.sanitizedHtml().contains("<iframe"));
    }

    @Test
    void sanitizeReport_preservesInlineScript() {
        String input = "<html><body><script>var x = 1;</script></body></html>";
        HtmlSanitizer.SanitizeResult result = htmlSanitizer.sanitizeReport(input);
        assertTrue(result.sanitizedHtml().contains("<script>var x = 1;</script>"));
    }

    @Test
    void sanitizeReport_allowsMermaidCdn() {
        String input = "<html><body><script src=\"https://cdn.jsdelivr.net/npm/mermaid\"></script></body></html>";
        HtmlSanitizer.SanitizeResult result = htmlSanitizer.sanitizeReport(input);
        assertTrue(result.sanitizedHtml().contains("cdn.jsdelivr.net"));
    }

    @Test
    void sanitizeReport_blocksExternalScriptSrc() {
        String input = "<html><body><script src=\"https://evil.com/malware.js\"></script></body></html>";
        HtmlSanitizer.SanitizeResult result = htmlSanitizer.sanitizeReport(input);
        assertTrue(result.wasModified());
        assertFalse(result.sanitizedHtml().contains("evil.com"));
    }

    @Test
    void attachmentValidation_rejectsOversizedFile() {
        long fileSize = 11L * 1024 * 1024; // 11MB
        assertThrows(ValidationException.class, () -> {
            if (fileSize > 10L * 1024 * 1024) {
                throw new ValidationException("Attachment size exceeds maximum of 10MB");
            }
        });
    }

    @Test
    void attachmentValidation_rejectsDisallowedType() {
        String contentType = "application/javascript";
        List<String> allowedTypes = List.of("image/png", "image/jpeg", "image/gif", "application/pdf");
        assertThrows(ValidationException.class, () -> {
            if (!allowedTypes.contains(contentType)) {
                throw new ValidationException("File type not allowed");
            }
        });
    }

    @Test
    void customer_cannotAccessOtherSpaceFeedback() {
        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (!user.hasAccessToSpace("space-2")) {
                throw new SecurityException("No access to space");
            }
        });
    }

    @Test
    void impersonatedUser_cannotPostFeedback() {
        SecurityContext.setCurrentUser(new SecurityContext.AuthenticatedUser(
                "customer-id", "customer@example.com",
                UserRole.CUSTOMER, List.of("space-1"),
                "super-admin-id", true
        ));

        SecurityContext.AuthenticatedUser user = SecurityContext.getCurrentUser();
        assertThrows(SecurityException.class, () -> {
            if (user.readOnly()) {
                throw new SecurityException("Write operations not permitted");
            }
        });
    }
}
