import { parseStoredSettings } from "../schemas/settings";
import { londonClock } from "../util/team";
import { visitorLabel } from "../util/tokens";
import { handoffRate } from "./admin";
import type { RelayContext } from "./context";

/**
 * Scheduled work (ADR-038), called by pg_cron through the website's cron routes. Every job is
 * idempotent: calling it twice sends nothing twice.
 */
export class CronService {
  constructor(private readonly ctx: RelayContext) {}

  private get store() {
    return this.ctx.deps.store;
  }

  /** Unjoined hand-offs: one reminder after `reminderMinutes` and one more after `secondReminderMinutes`. */
  async reminders(): Promise<{ sent: number }> {
    const settings = parseStoredSettings(await this.store.getSettingsConfig());
    const now = this.ctx.deps.now();
    let sent = 0;
    for (const h of await this.store.listOpenHandoffs()) {
      const waitedMin = (now.getTime() - Date.parse(h.requestedAt)) / 60_000;
      const nth =
        h.reminderCount === 0 && waitedMin >= settings.reminderMinutes
          ? 1
          : h.reminderCount === 1 && waitedMin >= settings.secondReminderMinutes
            ? 2
            : 0;
      if (nth === 0) continue;
      const c = await this.store.getConversation(h.conversationId);
      if (!c || c.status !== "awaiting_human") {
        await this.store.updateHandoff(h.id, { reminderCount: 2 });
        continue;
      }
      // Claim before sending, so a concurrent run cannot send the same reminder.
      await this.store.updateHandoff(h.id, {
        reminderCount: nth,
        lastReminderAt: now.toISOString(),
      });
      const lastVisitor = [...(await this.store.listMessages(c.id))]
        .reverse()
        .find((m) => m.senderType === "visitor");
      const counts = await this.store.inboxCounts();
      await this.ctx.deps.notifier.send({
        type: "handoff.reminder",
        counts: { needs: counts.needs, live: counts.live },
        data: {
          conversationId: c.id,
          displayName: c.contactName ?? visitorLabel(c.id),
          trigger: h.trigger,
          minutesWaiting: Math.floor(waitedMin),
          nth,
          lastVisitorMessage:
            settings.emailSnippet && lastVisitor ? lastVisitor.body.slice(0, 280) : null,
          pagePath: c.pageUrl && URL.canParse(c.pageUrl) ? new URL(c.pageUrl).pathname : null,
          requestedAt: h.requestedAt,
        },
      });
      sent += 1;
    }
    return { sent };
  }

  /** Daily digest at 08:45 Europe/London on working days (called hourly at :45). */
  async digest(force = false): Promise<{ sent: boolean }> {
    const settings = parseStoredSettings(await this.store.getSettingsConfig());
    const now = this.ctx.deps.now();
    const { day, hhmm } = londonClock(now);
    if (!force && (!settings.businessHours.days.includes(day) || !hhmm.startsWith("08:")))
      return { sent: false };
    const londonDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
    if (!(await this.store.hitRateLimit(`digest:${londonDate}`, 86_400 * 2, 1)))
      return { sent: false };
    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const [row, gaps, counts] = await Promise.all([
      this.store.insights(since),
      this.store.listGaps(new Date(now.getTime() - 30 * 86_400_000).toISOString()),
      this.store.inboxCounts(),
    ]);
    await this.ctx.deps.notifier.send({
      type: "digest.daily",
      counts: { needs: counts.needs, live: counts.live },
      data: {
        waitingNow: row.waitingNow,
        yesterday: {
          conversations: row.conversations,
          handoffs: row.handoffs,
          handoffRate: handoffRate(row.handoffs, row.conversations),
          helpful: row.helpful,
          notHelpful: row.notHelpful,
          aiResolved: row.aiResolved,
        },
        openGaps: gaps.length,
        topGaps: gaps.slice(0, 5).map((g) => ({ question: g.exampleQuestion, count: g.count })),
      },
    });
    return { sent: true };
  }
}
