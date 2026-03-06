package com.versent.reportportal.shared.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.versent.reportportal.shared.model.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class JwtValidator {

    private static final Logger log = LoggerFactory.getLogger(JwtValidator.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String userPoolId;
    private final String region;
    private final String clientId;
    private final Map<String, RSAPublicKey> keyCache = new ConcurrentHashMap<>();

    public JwtValidator(
            @Value("${cognito.user-pool-id}") String userPoolId,
            @Value("${cognito.region:ap-southeast-2}") String region,
            @Value("${cognito.client-id}") String clientId) {
        this.userPoolId = userPoolId;
        this.region = region;
        this.clientId = clientId;
    }

    public SecurityContext.AuthenticatedUser validate(String token) {
        try {
            String[] parts = token.replace("Bearer ", "").split("\\.");
            if (parts.length != 3) {
                throw new SecurityException("Invalid JWT format");
            }

            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]));
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]));

            JsonNode header = MAPPER.readTree(headerJson);
            JsonNode payload = MAPPER.readTree(payloadJson);

            String kid = header.get("kid").asText();
            RSAPublicKey publicKey = getPublicKey(kid);

            verifySignature(parts[0] + "." + parts[1], parts[2], publicKey);

            String issuer = String.format("https://cognito-idp.%s.amazonaws.com/%s", region, userPoolId);
            if (!issuer.equals(payload.get("iss").asText())) {
                throw new SecurityException("Invalid token issuer");
            }

            long exp = payload.get("exp").asLong();
            if (Instant.now().getEpochSecond() > exp) {
                throw new SecurityException("Token expired");
            }

            String tokenUse = payload.has("token_use") ? payload.get("token_use").asText() : "";
            if (!"id".equals(tokenUse) && !"access".equals(tokenUse)) {
                throw new SecurityException("Invalid token_use claim");
            }

            String userId = payload.has("sub") ? payload.get("sub").asText() : "";
            String email = payload.has("email") ? payload.get("email").asText() : "";

            UserRole role = UserRole.CUSTOMER;
            if (payload.has("custom:role")) {
                role = UserRole.valueOf(payload.get("custom:role").asText().toUpperCase());
            }

            List<String> customerSpaces = Collections.emptyList();
            if (payload.has("custom:customer_space")) {
                String spacesStr = payload.get("custom:customer_space").asText();
                customerSpaces = Arrays.asList(spacesStr.split(","));
            }

            String impersonatorId = null;
            if (payload.has("impersonator")) {
                impersonatorId = payload.get("impersonator").asText();
            }

            boolean readOnly = false;
            if (payload.has("read_only")) {
                readOnly = payload.get("read_only").asBoolean();
            }

            return new SecurityContext.AuthenticatedUser(
                    userId, email, role, customerSpaces, impersonatorId, readOnly
            );

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            log.error("JWT validation failed", e);
            throw new SecurityException("JWT validation failed: " + e.getMessage());
        }
    }

    private RSAPublicKey getPublicKey(String kid) {
        return keyCache.computeIfAbsent(kid, k -> {
            try {
                String jwksUrl = String.format(
                        "https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
                        region, userPoolId
                );

                HttpClient client = HttpClient.newHttpClient();
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(jwksUrl))
                        .GET()
                        .build();

                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                JsonNode jwks = MAPPER.readTree(response.body());

                for (JsonNode key : jwks.get("keys")) {
                    if (kid.equals(key.get("kid").asText())) {
                        byte[] nBytes = Base64.getUrlDecoder().decode(key.get("n").asText());
                        byte[] eBytes = Base64.getUrlDecoder().decode(key.get("e").asText());

                        BigInteger n = new BigInteger(1, nBytes);
                        BigInteger e = new BigInteger(1, eBytes);

                        RSAPublicKeySpec spec = new RSAPublicKeySpec(n, e);
                        KeyFactory factory = KeyFactory.getInstance("RSA");
                        return (RSAPublicKey) factory.generatePublic(spec);
                    }
                }

                throw new SecurityException("Key ID not found in JWKS: " + kid);
            } catch (SecurityException se) {
                throw se;
            } catch (Exception ex) {
                throw new RuntimeException("Failed to fetch JWKS", ex);
            }
        });
    }

    private void verifySignature(String data, String signature, RSAPublicKey publicKey) {
        try {
            java.security.Signature sig = java.security.Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            byte[] signatureBytes = Base64.getUrlDecoder().decode(signature);
            if (!sig.verify(signatureBytes)) {
                throw new SecurityException("Invalid JWT signature");
            }
        } catch (SecurityException se) {
            throw se;
        } catch (Exception e) {
            throw new SecurityException("Signature verification failed", e);
        }
    }
}
