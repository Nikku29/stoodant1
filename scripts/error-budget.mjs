// DevOps level 7: the deploy-freeze gate. Reads how much of the 30-day error budget is left for each SLO
// (infra/slo.tf) and fails when one is used up, so the pull request can't merge and nothing new ships.
// Pull requests labelled "reliability" (the fixes) always pass. Repository variable DEPLOY_FREEZE=true
// freezes by hand. If Google Cloud can't be reached, the gate passes with a warning rather than block all work.
//
// Env: ACCESS_TOKEN (from google-github-actions/auth), PR_LABELS (JSON array of names), DEPLOY_FREEZE,
//      GCP_PROJECT (default stoodant-prod), GCP_PROJECT_NUMBER (default 839354037071).
import { appendFileSync } from "node:fs";

const project = process.env.GCP_PROJECT || "stoodant-prod";
const projectNumber = process.env.GCP_PROJECT_NUMBER || "839354037071";
const monthMinutes = 30 * 24 * 60;
const goal = 0.999;
const slos = {
  "Site": `projects/${projectNumber}/services/stoodant/serviceLevelObjectives/site-availability`,
  "Demo form": `projects/${projectNumber}/services/stoodant/serviceLevelObjectives/form-availability`,
};

const out = (line) => { console.log(line); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n"); };
const labels = JSON.parse(process.env.PR_LABELS || "[]");
const isFix = labels.includes("reliability");

async function budgetFraction(slo) {
  const end = new Date();
  const params = new URLSearchParams({
    filter: `select_slo_budget_fraction("${slo}")`,
    "interval.startTime": new Date(end.getTime() - 60 * 60 * 1000).toISOString(),
    "interval.endTime": end.toISOString(),
  });
  const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${params}`, {
    headers: { Authorization: `Bearer ${process.env.ACCESS_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Monitoring API ${res.status} ${body.error?.status ?? ""}`.trim());
  }
  const points = (await res.json()).timeSeries?.[0]?.points ?? [];
  if (points.length === 0) throw new Error("no data yet");
  return points[0].value.doubleValue; // newest first; 1 = untouched, 0 = used up, below 0 = overspent
}

let frozen = false;
let unread = !process.env.ACCESS_TOKEN;
if (process.env.DEPLOY_FREEZE === "true") {
  frozen = true;
  out("Deploy freeze is on by hand (repository variable DEPLOY_FREEZE=true).");
}

if (!process.env.ACCESS_TOKEN) {
  out("::warning::Error budget not checked: GitHub variables GCP_WIF_PROVIDER and GCP_SLO_SA are not set yet (DEVOPS.md, level 7).");
} else {
  out("| Target | Budget left | Downtime left this month |\n|---|---|---|");
  for (const [name, slo] of Object.entries(slos)) {
    try {
      const fraction = await budgetFraction(slo);
      const minutes = Math.max(0, fraction) * monthMinutes * (1 - goal);
      out(`| ${name} | ${(fraction * 100).toFixed(1)}% | ${minutes.toFixed(0)} min |`);
      if (fraction <= 0) frozen = true;
    } catch (error) {
      out(`| ${name} | unknown | ${error.message} |`);
      unread = true;
      console.log(`::warning::Could not read the ${name} error budget, not blocking: ${error.message}`);
    }
  }
}

if (frozen && isFix) {
  out("\nBudget is used up, but this pull request is labelled `reliability`, so it can merge.");
} else if (frozen) {
  out("\n**Deploys are frozen.** The error budget is used up, so only reliability fixes can merge until it recovers. Add the `reliability` label if this pull request is one.");
  process.exit(1);
} else {
  out(unread ? "\nBudget not fully read, so not blocking." : "\nBudget left: shipping as usual.");
}
