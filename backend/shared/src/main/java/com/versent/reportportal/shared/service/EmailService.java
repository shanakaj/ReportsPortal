package com.versent.reportportal.shared.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;

import java.util.Map;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final SesClient sesClient;
    private final PlatformSettingsService platformSettingsService;
    private final String fromAddress;

    public EmailService(SesClient sesClient,
                        PlatformSettingsService platformSettingsService,
                        @Value("${ses.from-address:noreply@reports.yourdomain.com}") String fromAddress) {
        this.sesClient = sesClient;
        this.platformSettingsService = platformSettingsService;
        this.fromAddress = fromAddress;
    }

    public void sendInvitationEmail(String toEmail, String spaceName, String inviteLink) {
        String subject = "You've been invited to access reports on " + spaceName;
        String htmlBody = buildInvitationTemplate(spaceName, inviteLink);
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendAdminInvitationEmail(String toEmail, String inviteLink) {
        String orgName = platformSettingsService.getSettings().getOrganizationName();
        String subject = "You've been invited as an admin to " + orgName;
        String htmlBody = buildAdminInvitationTemplate(inviteLink);
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendFirstLoginNotification(String toEmail, String customerName, String spaceName) {
        String subject = customerName + " has logged in for the first time to " + spaceName;
        String htmlBody = buildFirstLoginTemplate(customerName, spaceName);
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendMfaResetNotification(String toEmail) {
        String subject = "Your MFA has been reset";
        String htmlBody = buildMfaResetTemplate();
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendFeedbackNewEmail(String toEmail, String customerName, String reportName,
                                     String spaceName, String feedbackSubject, String messageContent,
                                     String threadLink) {
        String subject = customerName + " left feedback on " + reportName + " in " + spaceName;
        String htmlBody = buildFeedbackNewTemplate(customerName, reportName, spaceName,
                feedbackSubject, messageContent, threadLink);
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendFeedbackReplyEmail(String toEmail, String authorName, String reportName,
                                       String replyContent, String threadLink) {
        String subject = authorName + " replied to feedback on " + reportName;
        String htmlBody = buildFeedbackReplyTemplate(authorName, reportName, replyContent, threadLink);
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendFeedbackResolvedEmail(String toEmail, String threadSubject, String reportName,
                                          String adminName) {
        String subject = "Feedback thread '" + threadSubject + "' on " + reportName + " has been resolved";
        String htmlBody = buildFeedbackResolvedTemplate(threadSubject, reportName, adminName);
        sendEmail(toEmail, subject, htmlBody);
    }

    public void sendEmail(String toEmail, String subject, String htmlBody) {
        try {
            SendEmailRequest request = SendEmailRequest.builder()
                    .source(fromAddress)
                    .destination(Destination.builder()
                            .toAddresses(toEmail)
                            .build())
                    .message(Message.builder()
                            .subject(Content.builder().data(subject).charset("UTF-8").build())
                            .body(Body.builder()
                                    .html(Content.builder().data(htmlBody).charset("UTF-8").build())
                                    .build())
                            .build())
                    .build();

            sesClient.sendEmail(request);
            log.info("Email sent successfully to: {}, subject: {}", toEmail, subject);
        } catch (Exception e) {
            log.error("Failed to send email to: {}, subject: {}", toEmail, subject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    private String buildInvitationTemplate(String spaceName, String inviteLink) {
        return buildEmailWrapper("You've Been Invited",
                "<p>You have been invited to access reports on <strong>" + spaceName + "</strong>.</p>" +
                "<p>Click the button below to complete your registration:</p>" +
                "<p style=\"text-align:center;\">" +
                "<a href=\"" + inviteLink + "\" style=\"" + buttonStyle() + "\">Accept Invitation</a></p>" +
                "<p style=\"font-size:12px;color:#666;\">This invitation link expires in 24 hours.</p>");
    }

    private String buildAdminInvitationTemplate(String inviteLink) {
        return buildEmailWrapper("Admin Portal Invitation",
                "<p>You have been invited as an administrator to the Report Portal.</p>" +
                "<p>Click the button below to complete your registration:</p>" +
                "<p style=\"text-align:center;\">" +
                "<a href=\"" + inviteLink + "\" style=\"" + buttonStyle() + "\">Accept Invitation</a></p>" +
                "<p style=\"font-size:12px;color:#666;\">This invitation link expires in 24 hours.</p>");
    }

    private String buildFirstLoginTemplate(String customerName, String spaceName) {
        return buildEmailWrapper("First Login Notification",
                "<p><strong>" + customerName + "</strong> has logged in for the first time to " +
                "<strong>" + spaceName + "</strong>.</p>" +
                "<p>The customer can now access reports in their assigned space.</p>");
    }

    private String buildMfaResetTemplate() {
        return buildEmailWrapper("MFA Reset",
                "<p>Your Multi-Factor Authentication (MFA) has been reset by an administrator.</p>" +
                "<p>You will need to set up MFA again on your next login.</p>");
    }

    private String buildFeedbackNewTemplate(String customerName, String reportName, String spaceName,
                                            String feedbackSubject, String messageContent, String threadLink) {
        return buildEmailWrapper("New Feedback",
                "<p><strong>" + customerName + "</strong> left feedback on <strong>" +
                reportName + "</strong> in <strong>" + spaceName + "</strong>.</p>" +
                "<div style=\"background:#f5f5f5;padding:16px;border-radius:4px;margin:16px 0;\">" +
                "<p style=\"font-weight:bold;margin:0 0 8px 0;\">" + feedbackSubject + "</p>" +
                "<div>" + messageContent + "</div></div>" +
                "<p style=\"text-align:center;\">" +
                "<a href=\"" + threadLink + "\" style=\"" + buttonStyle() + "\">View Thread</a></p>");
    }

    private String buildFeedbackReplyTemplate(String authorName, String reportName,
                                              String replyContent, String threadLink) {
        return buildEmailWrapper("New Reply",
                "<p><strong>" + authorName + "</strong> replied to feedback on <strong>" +
                reportName + "</strong>.</p>" +
                "<div style=\"background:#f5f5f5;padding:16px;border-radius:4px;margin:16px 0;\">" +
                "<div>" + replyContent + "</div></div>" +
                "<p style=\"text-align:center;\">" +
                "<a href=\"" + threadLink + "\" style=\"" + buttonStyle() + "\">View Thread</a></p>");
    }

    private String buildFeedbackResolvedTemplate(String threadSubject, String reportName, String adminName) {
        return buildEmailWrapper("Feedback Resolved",
                "<p>Feedback thread <strong>'" + threadSubject + "'</strong> on <strong>" +
                reportName + "</strong> has been marked as resolved by <strong>" + adminName + "</strong>.</p>");
    }

    private String buildEmailWrapper(String title, String content) {
        var settings = platformSettingsService.getSettings();
        String orgName = settings.getOrganizationName() != null
                ? settings.getOrganizationName() : "Report Portal";
        String legalEntity = settings.getOrganizationLegalEntity() != null
                && !settings.getOrganizationLegalEntity().isBlank()
                ? settings.getOrganizationLegalEntity() : orgName;

        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head>" +
                "<body style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
                "background:#f9fafb;margin:0;padding:20px;\">" +
                "<div style=\"max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;" +
                "overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);\">" +
                "<div style=\"background:#1a1a2e;padding:24px;text-align:center;\">" +
                "<h1 style=\"color:#ffffff;margin:0;font-size:20px;\">" + orgName + "</h1></div>" +
                "<div style=\"padding:32px;\">" +
                "<h2 style=\"margin:0 0 16px 0;color:#1a1a2e;\">" + title + "</h2>" +
                content + "</div>" +
                "<div style=\"background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666;\">" +
                "<p style=\"margin:0;\">" + legalEntity + "</p></div>" +
                "</div></body></html>";
    }

    private String buttonStyle() {
        return "display:inline-block;background:#1a1a2e;color:#ffffff;padding:12px 32px;" +
                "text-decoration:none;border-radius:4px;font-weight:bold;";
    }
}
