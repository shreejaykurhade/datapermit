import { test, expect } from "@playwright/test";
test("50 image answers → clusters → expert approval → versioned sale → shared earnings", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Contributions", exact: true })
    .click();
  const grid = page.locator(".annotation-workspace .annotation-grid");
  await expect(grid.getByRole("button")).toHaveCount(16);
  await page.getByLabel("Answer language").selectOption("mr");
  await expect(page.locator(".annotation-workspace h2")).toContainText("वाहने");
  await grid.getByRole("button", { name: /Image \d+: car$/ }).click();
  await page
    .locator(".annotation-workspace textarea")
    .fill("वाहनांच्या चित्रांची निवड केली.");
  await page.getByRole("button", { name: "जतन करा आणि पुढे जा" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Contributions", exact: true })
    .click();
  await expect(page.locator(".annotation-workspace textarea")).toHaveValue(
    "वाहनांच्या चित्रांची निवड केली.",
  );
  await page.getByLabel("Answer language").selectOption("en");
  for (let i = 0; i < 50; i++) {
    const heading = await page.locator(".annotation-workspace h2").innerText();
    const target = heading.includes("vehicles")
      ? "car|bus|bike|plane"
      : heading.includes("fruit")
        ? "apple|cherry|grape|citrus"
        : heading.includes("nature")
          ? "sun|moon|cloud|tree"
          : "cat|dog|fish|bird";
    const existing = grid.locator('button[aria-pressed="true"]');
    while (await existing.count()) await existing.first().click();
    const matches = grid.getByRole("button", {
      name: new RegExp("Image \\d+: (" + target + ")$"),
    });
    for (let j = 0; j < (await matches.count()); j++)
      await matches.nth(j).click();
    await page
      .locator(".annotation-workspace textarea")
      .fill(
        "I selected the requested object category based on its visible features.",
      );
    await page.getByRole("button", { name: "Save & next" }).click();
  }
  await page
    .getByRole("checkbox", { name: /I permit the requesting company/ })
    .check();
  await page.getByRole("button", { name: "Submit all 50 answers" }).click();
  await expect(page.getByText(/50 answers submitted ·/)).toBeVisible();
  await page.getByRole("tab", { name: "Company workspace" }).click();
  await page.getByRole("button", { name: "Cluster all 50 questions" }).click();
  await expect(page.getByText(/50\/50 questions clustered/)).toBeVisible();
  await page.getByRole("tab", { name: "Expert verification" }).click();
  for (const id of ["q01", "q02", "q03"]) {
    await page.locator(".expert-workspace select").selectOption(id);
    await page
      .getByLabel("Expert decision notes")
      .fill(
        "Checked all selected images and the original explanation. This answer is usable.",
      );
    await page.getByRole("button", { name: "Accept cluster" }).click();
    await expect(page.getByText("ACCEPTED", { exact: true })).toBeVisible();
  }
  await page.getByRole("tab", { name: "Company workspace" }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download approved answers & provenance" })
    .click();
  const file = await downloading;
  expect(file.suggestedFilename()).toContain("reviewed-answers");
  await page
    .getByRole("button", { name: "Prepare reviewed dataset for publishing" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Publisher studio", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Revenue share 1", { exact: true }).fill("25");
  await page.getByLabel("Revenue share 2", { exact: true }).fill("5");
  await page.getByRole("checkbox", { name: /I created these records/ }).check();
  await page
    .getByRole("button", { name: "Publish dataset", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Everyday objects in your language/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Company: 70%");
  await expect(page.getByRole("dialog")).toContainText("25%");
  await page.getByRole("checkbox", { name: /I accept the terms/ }).check();
  await page.getByRole("button", { name: "Create demo permit" }).click();
  await page.getByRole("button", { name: "Developer", exact: true }).click();
  await expect(
    page.getByText("3.5 demo credits", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1.25 demo credits", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0.25 demo credits", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Contributions", exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/contributions-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/contributions-mobile.png",
    fullPage: true,
  });
});
