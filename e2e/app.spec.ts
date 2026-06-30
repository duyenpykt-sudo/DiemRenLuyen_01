import { test, expect, type Page } from "@playwright/test";

// Đăng nhập qua form /login và chờ về dashboard (dev có thể biên dịch chậm lần đầu).
async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("Admin đăng nhập thấy Dashboard", async ({ page }) => {
  await login(page, "admin", "Admin@123");
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
});

test("Phân quyền: CVHT không vào được /admin", async ({ page }) => {
  await login(page, "hothiduyen", "Cvht@123");
  await expect(page).toHaveURL(/\/dashboard/);
  // Truy cập thẳng /admin → bị đẩy về /dashboard.
  await page.goto("/admin/faculties");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("Feature flag tắt: không thấy nút Import Excel", async ({ page }) => {
  await login(page, "hothiduyen", "Cvht@123");
  await page.goto("/scores");
  await expect(page.getByRole("heading", { name: "Điểm rèn luyện" })).toBeVisible();
  // Chọn lớp (combobox 1) + học kỳ (combobox 2).
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option").first().click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await expect(page.getByRole("button", { name: "Xuất Excel" })).toBeVisible();
  // Flag mặc định false → KHÔNG có nút Import Excel.
  await expect(page.getByRole("button", { name: "Import Excel" })).toHaveCount(0);
});

test("Tra cứu nhanh theo MSSV mở trang chi tiết SV", async ({ page }) => {
  await login(page, "hothiduyen", "Cvht@123");
  await page.getByPlaceholder("Tìm theo MSSV hoặc CCCD…").fill("221CTT016");
  await page.getByPlaceholder("Tìm theo MSSV hoặc CCCD…").press("Enter");
  await expect(page).toHaveURL(/\/students\//);
  await expect(page.getByText("Nguyễn Trùng Khánh")).toBeVisible();
});
