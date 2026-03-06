import { test as base, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
}

export interface AuthFixtures {
  superAdmin: TestUser;
  admin: TestUser;
  customer: TestUser;
}

export const test = base.extend<AuthFixtures>({
  superAdmin: async ({}, use) => {
    await use({
      email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@versent.com.au',
      password: process.env.SUPER_ADMIN_PASSWORD || 'TestPassword123!',
    });
  },

  admin: async ({}, use) => {
    await use({
      email: process.env.TEST_ADMIN_EMAIL || 'admin@versent.com.au',
      password: process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
    });
  },

  customer: async ({}, use) => {
    await use({
      email: process.env.TEST_CUSTOMER_EMAIL || 'customer@example.com',
      password: process.env.TEST_CUSTOMER_PASSWORD || 'TestPassword123!',
    });
  },
});

export { expect };
