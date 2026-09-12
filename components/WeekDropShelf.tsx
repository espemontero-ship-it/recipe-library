"use client";

import styles from "./WeekDropShelf.module.css";

export type WeekDropTarget = {
  weekStart: string;
  label: string;
};

type Props = {
  weeks: WeekDropTarget[];
  /** Week matching whatever's currently being dragged — shown disabled, you can't drop onto where it already is. */
  currentWeekStart?: string | null;
  dragOverWeek: string | null;
  onDragOverWeek: (event: React.DragEvent, weekStart: string) => void;
  onDragLeaveWeek: (weekStart: string) => void;
  onDropWeek: (event: React.DragEvent, weekStart: string) => void;
  onShowMoreWeeks: () => void;
  label?: string;
};

/**
 * Sticky, always-visible row of week targets for drag-and-drop. Exists
 * because dragging a card onto its "real" section (which can be far down a
 * long page) was reported as both non-obvious and a very long throw — this
 * gives drag-and-drop a constant-distance target pinned to the top instead.
 */
export function WeekDropShelf({
  weeks,
  currentWeekStart,
  dragOverWeek,
  onDragOverWeek,
  onDragLeaveWeek,
  onDropWeek,
  onShowMoreWeeks,
  label = "Weeks",
}: Props) {
  return (
    <div className={styles.shelf}>
      <span className={styles.label}>{label}</span>
      <div className={styles.targets}>
        {weeks.map((week) => {
          const isCurrent = currentWeekStart === week.weekStart;
          return (
            <button
              className={`${styles.target} ${isCurrent ? styles.targetCurrent : ""} ${
                dragOverWeek === week.weekStart ? styles.targetHover : ""
              }`}
              disabled={isCurrent}
              key={week.weekStart}
              onDragLeave={() => onDragLeaveWeek(week.weekStart)}
              onDragOver={(event) => onDragOverWeek(event, week.weekStart)}
              onDrop={(event) => onDropWeek(event, week.weekStart)}
              type="button"
            >
              {week.label}
            </button>
          );
        })}
        <button className={styles.more} onClick={onShowMoreWeeks} type="button">
          + Show next month
        </button>
      </div>
    </div>
  );
}
