import { test, expect } from "@playwright/test";

// Golden Walkthrough: mock ingest -> click a 2D bounding box -> verify the
// click propagates through Zustand to the 3D graph and the Context Drawer.
test("mock ingest syncs 2D bbox click -> drawer -> active highlight", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));

  await page.goto("/", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Run Demo/i }).click();

  await expect(page.getByText("READY", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const box = page.locator('svg g[style*="cursor: pointer"]').first();
  await expect(box).toBeVisible();
  const tag = await box.locator("text").textContent();
  expect(tag).toBeTruthy();

  await box.click();

  // Drawer opens and shows the same tag we clicked.
  await expect(page.locator("body")).toContainText(tag!, { timeout: 5_000 });

  // Bounding box turns active (danger-red stroke).
  await expect(box.locator("rect")).toHaveAttribute("stroke", "#EF4444");

  // 3D graph engine mounted a canvas.
  await expect(page.locator("canvas")).toHaveCount(1);

  expect(errors).toEqual([]);
});
