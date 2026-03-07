package com.versent.reportportal.customer.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class SignedCookieService {

    private static final Logger log = LoggerFactory.getLogger(SignedCookieService.class);
    private static final long COOKIE_TTL_HOURS = 3;

    private final String cloudFrontDomain;
    private final String cloudFrontKeyPairId;
    private final String privateKeyPath;

    public SignedCookieService(
            @Value("${cloudfront.domain:reports.yourdomain.com}") String cloudFrontDomain,
            @Value("${cloudfront.key-pair-id:PLACEHOLDER}") String cloudFrontKeyPairId,
            @Value("${cloudfront.private-key-path:/opt/keys/cloudfront-private-key.pem}") String privateKeyPath) {
        this.cloudFrontDomain = cloudFrontDomain;
        this.cloudFrontKeyPairId = cloudFrontKeyPairId;
        this.privateKeyPath = privateKeyPath;
    }

    public SignedCookieResult generateSignedCookies(String spaceId) {
        Instant expiresAt = Instant.now().plus(COOKIE_TTL_HOURS, ChronoUnit.HOURS);
        long epochSeconds = expiresAt.getEpochSecond();

        String resourcePath = "https://" + cloudFrontDomain + "/reports/report-portal-" + spaceId + "/*";

        String policy = String.format(
                "{\"Statement\":[{\"Resource\":\"%s\",\"Condition\":{\"DateLessThan\":{\"AWS:EpochTime\":%d}}}]}",
                resourcePath, epochSeconds
        );

        try {
            String encodedPolicy = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(policy.getBytes());

            String signature = signPolicy(policy);

            Map<String, String> cookies = new HashMap<>();
            cookies.put("CloudFront-Policy", encodedPolicy);
            cookies.put("CloudFront-Signature", signature);
            cookies.put("CloudFront-Key-Pair-Id", cloudFrontKeyPairId);

            return new SignedCookieResult(cookies, expiresAt, resourcePath);

        } catch (Exception e) {
            log.error("Failed to generate signed cookies for space: {}", spaceId, e);
            throw new RuntimeException("Failed to generate signed cookies", e);
        }
    }

    private String signPolicy(String policy) throws Exception {
        PrivateKey privateKey = loadPrivateKey();

        Signature signer = Signature.getInstance("SHA1withRSA");
        signer.initSign(privateKey);
        signer.update(policy.getBytes());

        byte[] signatureBytes = signer.sign();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(signatureBytes);
    }

    private PrivateKey loadPrivateKey() throws Exception {
        String pemContent;
        try {
            pemContent = Files.readString(Path.of(privateKeyPath));
        } catch (IOException e) {
            log.warn("Private key file not found at {}, using placeholder for development", privateKeyPath);
            return generatePlaceholderKey();
        }

        String privateKeyPEM = pemContent
                .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                .replace("-----END RSA PRIVATE KEY-----", "")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s+", "");

        byte[] keyBytes = Base64.getDecoder().decode(privateKeyPEM);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return kf.generatePrivate(spec);
    }

    private PrivateKey generatePlaceholderKey() throws Exception {
        java.security.KeyPairGenerator generator = java.security.KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair().getPrivate();
    }

    public record SignedCookieResult(
            Map<String, String> cookies,
            Instant expiresAt,
            String resourcePath
    ) {
    }
}
