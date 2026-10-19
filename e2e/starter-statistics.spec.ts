import {test,expect} from "@playwright/test";
import {generateChallenge} from "../src/lib/challenges";
import {utcDay} from "../src/lib/date";
import {measurementCopy} from "../src/lib/measurement-i18n";
import {st} from "../src/lib/social-i18n";

test.skip(process.env.COMMUNITY_STARTER_STATS!=="true","Run with COMMUNITY_STARTER_STATS=true against the isolated test database.");

test("a first Wordle result displays stable comparisons and keeps the real board and result",async({page})=>{
  const c=generateChallenge("word","fr",utcDay());if(c.kind!=="word")throw new Error();
  await page.goto("/fr/mot");
  if(await page.locator(".measurement-notice").isVisible())await page.getByRole("button",{name:measurementCopy("fr").decline,exact:true}).click();
  for(const letter of c.answer)await page.getByRole("button",{name:letter,exact:true}).click();
  await page.getByRole("button",{name:"Valider",exact:true}).click();
  const stats=page.locator('[data-game-comparison="word"]');await expect(stats).toBeVisible();
  await expect(stats.locator("[data-outcome-bar]")).toBeVisible();
  await expect(stats.locator("[data-attempt-distribution]")).toBeVisible();
  await expect(page.locator(".word-board")).toBeVisible();
  const first=await stats.innerText();await page.reload();await expect(stats).toBeVisible();expect(await stats.innerText()).toBe(first);
  expect(first).not.toMatch(/simulation|exemple uniquement|fictif/i);
});

test("starter dilemma results remain hidden until a locked vote and survive reload",async({page})=>{
  const m=st("fr");await page.goto("/fr/tu-preferes");
  if(await page.locator(".measurement-notice").isVisible())await page.getByRole("button",{name:measurementCopy("fr").decline,exact:true}).click();
  await expect(page.locator(".vote-percentages")).toHaveCount(0);
  await page.locator('[data-choice="a"]').click();
  await expect(page.locator(".vote-percentages")).toBeVisible();
  await expect(page.locator('[data-choice="a"]')).toBeDisabled();
  await expect(page.locator(".community-wait")).toHaveCount(0);
  const first=await page.locator(".vote-percentages").innerText();await page.reload();
  await expect(page.locator(".vote-percentages")).toBeVisible();expect(await page.locator(".vote-percentages").innerText()).toBe(first);
  await expect(page.getByRole("button",{name:new RegExp(m.next)})).toBeVisible();
});
