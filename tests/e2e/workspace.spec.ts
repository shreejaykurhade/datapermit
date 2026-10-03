import { test, expect } from "@playwright/test";
test("API rejects anonymous access and never exposes credentials", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const data = await health.json();
  expect(data.chainId).toBe(10143);
  expect(data).not.toHaveProperty("SESSION_SECRET");
  const access = await request.get("/api/access");
  expect(access.status()).toBe(401);
  const permits = await request.get("/api/permits");
  expect(permits.status()).toBe(401);
  expect((await request.get("/api/account")).status()).toBe(401);
  expect((await request.get("/api/vault?id=private")).status()).toBe(401);
  expect(
    (
      await request.post("/api/kimi", { data: { records: [], consent: true } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post(
        "/api/intents/api/v1/executions/0x0000000000000000000000000000000000000000",
        { data: {} },
      )
    ).status(),
  ).toBe(401);
  const cre = await request.post("/api/cre", {
    data: { permitId: "1", txHash: "fake" },
  });
  expect(cre.ok()).toBe(false);
  expect(data).not.toHaveProperty("DATA_ENCRYPTION_KEY");
  expect(data).not.toHaveProperty("AURORA_API_KEY");
});
test("purchase, access, persist and revoke a demo permit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /Marathi support, beyond translation/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Create demo permit" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I accept the terms/ }).check();
  await page.getByRole("button", { name: "Create demo permit" }).click();
  await expect(
    page.getByText("Demo permit created. No funds were transferred."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Access dataset", exact: true })
    .click();
  await expect(page.getByText("200 · Access granted")).toBeVisible();
  await expect(page.getByText("99 requests left")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /My permits/ }).click();
  await expect(page.getByText("1/100 requests used")).toBeVisible();
  await page
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Access dataset", exact: true })
    .click();
  await expect(page.locator(".toast[role=alert]")).toHaveText(/revoked/);
});
test("publish, search and preview a new dataset", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Publisher studio", exact: true })
    .click();
  await page.getByLabel("Dataset title").fill("Tamil support test collection");
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "An original evaluation collection for testing customer support intent.",
    );
  await page.getByLabel("Language", { exact: true }).fill("Tamil");
  await page.getByRole("checkbox", { name: /I created these records/ }).check();
  await page
    .getByRole("button", { name: "Publish dataset", exact: true })
    .click();
  await expect(
    page.getByText("Dataset published. Buyers can now preview and license it."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search datasets" }).fill("Tamil");
  await expect(
    page.getByRole("button", { name: /Tamil support test collection/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Tamil support test collection/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("My order is late.");
});
test("mobile layout does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good data/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
});
test("desktop visual", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good data/ })).toBeVisible();
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
});
test("sponsor tools require live mode and consent without fabricating results", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Publisher studio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review dataset with Kimi" }),
  ).toBeDisabled();
  await page
    .getByText(
      "I approve sending up to 50 current publisher records to Kimi for a quality review.",
    )
    .click();
  await expect(
    page.getByRole("button", { name: "Review dataset with Kimi" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Connect a passkey in live mode to use these services. Demo records remain local.",
    ),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/publisher.png", fullPage: true });
  await page.getByRole("button", { name: "Developer", exact: true }).click();
  await expect(
    page.getByText("Mera non-wallet keys", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Aurora Intents", { exact: true })).toBeVisible();
  await expect(page.getByText("Chainlink CRE", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/developer.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Publisher studio", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/publisher-mobile.png",
    fullPage: true,
  });
});
