CREATE TABLE checklist_repeat_settings (
 widget_id TEXT PRIMARY KEY NOT NULL REFERENCES dashboard_widgets(id) ON DELETE CASCADE,
 repeat_cycle TEXT NOT NULL DEFAULT 'daily' CHECK(repeat_cycle IN ('daily','weekly','monthly')),
 version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0)
);
--> statement-breakpoint
CREATE TABLE checklist_period_states (
 item_id TEXT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
 settings_version INTEGER NOT NULL,
 period_start TEXT NOT NULL,
 period_end INTEGER NOT NULL,
 checked INTEGER NOT NULL CHECK(checked IN (0,1)),
 checked_at INTEGER,
 PRIMARY KEY(item_id, settings_version, period_start),
 CHECK((checked = 0 AND checked_at IS NULL) OR (checked = 1 AND checked_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX idx_checklist_period_states_end ON checklist_period_states(period_end);
--> statement-breakpoint
INSERT INTO checklist_period_states(item_id, settings_version, period_start, period_end, checked, checked_at)
SELECT item_id, 0, business_date, unixepoch(business_date, '+1 day', '-9 hours') * 1000,
 checked, CASE WHEN checked = 1 THEN updated_at ELSE NULL END FROM checklist_daily_states;
