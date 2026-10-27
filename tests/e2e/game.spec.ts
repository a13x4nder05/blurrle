import { test, expect } from "@playwright/test";
import type { Daily } from "../../src/game/types";
test("play five rounds, resume, and preserve the first score on replay", async ({
  page,
  request,
}) => {
  const daily = (await (
    await request.get("/api/daily/actors")
  ).json()) as Daily;
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "blurrle." })).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Play today" }).click();
  const guess = () => page.getByRole("textbox", { name: "Your guess" });
  await expect(guess()).toBeEnabled();
  await guess().fill("not a person");
  await guess().press("Enter");
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(
    page.getByText(daily.rounds[0].hint, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(daily.rounds[0].hint, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue guessing" }).click();
  await guess().fill(daily.rounds[0].name);
  await guess().press("Enter");
  await expect(
    page.getByRole("heading", { name: daily.rounds[0].name, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/reveal-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next face" }).press("Enter");
  await expect(guess()).toBeEnabled();
  await page.clock.fastForward(10050);
  await expect(page.getByText("Time’s up.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: daily.rounds[1].name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next face" }).click();
  for (let i = 2; i < 5; i++) {
    await expect(guess()).toBeEnabled();
    await guess().fill(daily.rounds[i].name);
    await guess().press("Enter");
    await expect(
      page.getByRole("heading", { name: daily.rounds[i].name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: i === 4 ? "See results" : "Next face" })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Quite the eye." }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.includes(":score:"))
      .map((k) => [k, localStorage.getItem(k)]),
  );
  expect(stored).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Quite the eye." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/results-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to Blurrle" }).click();
  await page.getByRole("button", { name: "Play again" }).click();
  for (let i = 0; i < 5; i++) {
    await expect(guess()).toBeEnabled();
    await guess().fill(daily.rounds[i].name);
    await guess().press("Enter");
    await page
      .getByRole("button", { name: i === 4 ? "See results" : "Next face" })
      .click();
  }
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.includes(":score:"))
        .map((k) => [k, localStorage.getItem(k)]),
    ),
  ).toEqual(stored);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/results-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to Blurrle" }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  await page.getByRole("combobox").selectOption("ceos-founders");
  await page.getByRole("button", { name: "Play today" }).click();
  await expect(guess()).toBeEnabled();
  await page.screenshot({
    path: "test-results/game-mobile.png",
    fullPage: true,
  });
});
