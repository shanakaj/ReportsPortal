package com.versent.reportportal.shared.util;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class HtmlSanitizer {

    private static final Pattern DANGEROUS_TAGS_PATTERN = Pattern.compile(
            "<(iframe|object|embed|form|input)(\\s[^>]*)?>.*?</\\1>|<(iframe|object|embed|form|input)(\\s[^>]*)?/?>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    private static final Pattern EXTERNAL_SCRIPT_PATTERN = Pattern.compile(
            "<script[^>]+src\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>\\s*</script>",
            Pattern.CASE_INSENSITIVE
    );

    private static final List<String> ALLOWED_CDN_HOSTS = List.of(
            "cdn.jsdelivr.net"
    );

    private static final Pattern EVENT_HANDLER_FETCH_PATTERN = Pattern.compile(
            "\\bon\\w+\\s*=\\s*[\"'][^\"']*(?:fetch|XMLHttpRequest|sendBeacon)[^\"']*[\"']",
            Pattern.CASE_INSENSITIVE
    );

    private static final PolicyFactory FEEDBACK_POLICY = new HtmlPolicyBuilder()
            .allowElements("p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li",
                    "code", "pre", "blockquote", "a", "h1", "h2", "h3", "h4", "h5", "h6",
                    "span", "div", "table", "thead", "tbody", "tr", "td", "th")
            .allowUrlProtocols("https", "http", "mailto")
            .allowAttributes("href").onElements("a")
            .allowAttributes("class").globally()
            .allowAttributes("style").globally()
            .toFactory();

    public SanitizeResult sanitizeReport(String html) {
        List<String> modifications = new ArrayList<>();

        String result = html;

        Matcher dangerousMatcher = DANGEROUS_TAGS_PATTERN.matcher(result);
        if (dangerousMatcher.find()) {
            StringBuffer sb = new StringBuffer();
            dangerousMatcher.reset();
            while (dangerousMatcher.find()) {
                modifications.add("Removed dangerous tag: <" +
                        (dangerousMatcher.group(1) != null ? dangerousMatcher.group(1) : dangerousMatcher.group(3)) + ">");
                dangerousMatcher.appendReplacement(sb, "<!-- removed by sanitizer -->");
            }
            dangerousMatcher.appendTail(sb);
            result = sb.toString();
        }

        Matcher scriptMatcher = EXTERNAL_SCRIPT_PATTERN.matcher(result);
        StringBuffer scriptSb = new StringBuffer();
        while (scriptMatcher.find()) {
            String srcUrl = scriptMatcher.group(1);
            boolean allowed = ALLOWED_CDN_HOSTS.stream()
                    .anyMatch(host -> srcUrl.contains(host));

            if (!allowed) {
                modifications.add("Removed external script: " + srcUrl);
                scriptMatcher.appendReplacement(scriptSb, "<!-- external script removed by sanitizer -->");
            }
        }
        scriptMatcher.appendTail(scriptSb);
        result = scriptSb.toString();

        Matcher eventMatcher = EVENT_HANDLER_FETCH_PATTERN.matcher(result);
        StringBuffer eventSb = new StringBuffer();
        while (eventMatcher.find()) {
            modifications.add("Removed suspicious event handler with network call");
            eventMatcher.appendReplacement(eventSb, "");
        }
        eventMatcher.appendTail(eventSb);
        result = eventSb.toString();

        return new SanitizeResult(result, modifications);
    }

    public String sanitizeFeedbackMessage(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        return FEEDBACK_POLICY.sanitize(html);
    }

    public record SanitizeResult(
            String sanitizedHtml,
            List<String> modifications
    ) {
        public boolean wasModified() {
            return !modifications.isEmpty();
        }
    }
}
