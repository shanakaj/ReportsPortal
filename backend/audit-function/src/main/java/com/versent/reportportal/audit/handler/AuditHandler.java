package com.versent.reportportal.audit.handler;

import com.versent.reportportal.audit.service.AuditQueryService;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.security.RoleChecker;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.audit",
        "com.versent.reportportal.shared"
})
@RestController
@RequestMapping("/admin")
public class AuditHandler {

    private final AuditQueryService auditQueryService;
    private final RoleChecker roleChecker;

    public AuditHandler(AuditQueryService auditQueryService, RoleChecker roleChecker) {
        this.auditQueryService = auditQueryService;
        this.roleChecker = roleChecker;
    }

    public static void main(String[] args) {
        SpringApplication.run(AuditHandler.class, args);
    }

    @GetMapping("/audit-log")
    public ResponseEntity<PaginatedResponse<AuditQueryService.AuditLogEntry>> queryAuditLog(
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String spaceId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit) {
        roleChecker.requireAdmin();
        return ResponseEntity.ok(auditQueryService.queryAuditLog(
                actor, action, spaceId, from, to, cursor, Math.min(limit, 100)));
    }
}
