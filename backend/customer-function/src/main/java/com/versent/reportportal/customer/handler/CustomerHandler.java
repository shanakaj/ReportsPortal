package com.versent.reportportal.customer.handler;

import com.versent.reportportal.customer.dto.CustomerReportResponse;
import com.versent.reportportal.customer.dto.CustomerSpaceResponse;
import com.versent.reportportal.customer.dto.PreferencesRequest;
import com.versent.reportportal.customer.dto.ReportViewResponse;
import com.versent.reportportal.customer.service.CustomerService;
import com.versent.reportportal.shared.dto.PaginatedResponse;
import com.versent.reportportal.shared.security.RoleChecker;
import jakarta.validation.Valid;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.versent.reportportal.customer",
        "com.versent.reportportal.shared"
})
@RestController
@RequestMapping("/customer")
public class CustomerHandler {

    private final CustomerService customerService;
    private final RoleChecker roleChecker;

    public CustomerHandler(CustomerService customerService, RoleChecker roleChecker) {
        this.customerService = customerService;
        this.roleChecker = roleChecker;
    }

    public static void main(String[] args) {
        SpringApplication.run(CustomerHandler.class, args);
    }

    @GetMapping("/spaces")
    public ResponseEntity<List<CustomerSpaceResponse>> listSpaces() {
        return ResponseEntity.ok(customerService.listSpaces());
    }

    @GetMapping("/spaces/{spaceId}/reports")
    public ResponseEntity<PaginatedResponse<CustomerReportResponse>> listReports(
            @PathVariable String spaceId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        roleChecker.requireSpaceAccess(spaceId);
        return ResponseEntity.ok(customerService.listReports(spaceId, cursor, Math.min(limit, 100)));
    }

    @GetMapping("/spaces/{spaceId}/reports/{reportId}")
    public ResponseEntity<ReportViewResponse> getReport(
            @PathVariable String spaceId,
            @PathVariable String reportId) {
        roleChecker.requireSpaceAccess(spaceId);
        return ResponseEntity.ok(customerService.getReport(spaceId, reportId));
    }

    @PutMapping("/preferences")
    public ResponseEntity<Void> updatePreferences(@Valid @RequestBody PreferencesRequest request) {
        customerService.updatePreferences(request);
        return ResponseEntity.ok().build();
    }
}
