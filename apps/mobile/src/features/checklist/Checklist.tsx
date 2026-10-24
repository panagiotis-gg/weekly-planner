import { checklistProgress, IsoDate, Task, taskDates, TEXT_LIMITS, WeeklyTodo } from '@planner/shared';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { deleteItem, moveTaskToDate, moveWithinList, renameItem } from '@/data/repositories/checklists';
import { countCompletionsOutside } from '@/data/repositories/completions';
import { formatMonthDay, formatWeekday } from '@/lib/format';
import { useCanEdit } from '@/state/planner';
import { AddButton, AddRow, Button, Checkbox, Counter, EditableText, IconButton, ProgressBar, Sheet, textStyles } from '@/ui/components';
import { confirm } from '@/ui/confirm';
import { usePalette } from '@/ui/theme';
import { DayCellView, ItemView } from './itemViews';

type Item = Task | WeeklyTodo;

export function DayCell({ cell, label, compact }: { cell: DayCellView; label: string; compact?: boolean }) {
  const canEdit = useCanEdit();
  return cell.kind === 'check' ? (
    <Checkbox checked={cell.met} label={label} onToggle={canEdit ? cell.onPress : undefined} />
  ) : (
    <Counter count={cell.count} goal={cell.goal} met={cell.met} label={label} compact={compact} onAdd={canEdit ? cell.onPress : undefined} />
  );
}

/**
 * Checklist with progress bar: daily tasks or weekly to-dos. Done items are struck through;
 * items with a target show a checkbox or counter per day and count partially (J5, J6).
 * Tap a title to edit it; "⋯" opens reorder / move / target / undo / delete.
 */
export function Checklist({
  kind,
  items,
  views,
  onAdd,
  addPlaceholder,
  moveTargets,
  progressColor,
  renderTargetEditor,
  renderCreate,
}: {
  kind: 'task' | 'weekly_todo';
  items: Item[];
  views: ReadonlyMap<string, ItemView>;
  /** Inline add (type and press enter). Ignored when `renderCreate` is given. */
  onAdd?: (title: string) => void;
  addPlaceholder: string;
  /** Create dialog opened by the "+ New …" row instead of inline typing. */
  renderCreate?: (close: () => void) => ReactNode;
  /** Dates a task can be moved to (tasks only). */
  moveTargets?: IsoDate[];
  progressColor?: string;
  /** Target editor shown inside the item menu. */
  renderTargetEditor?: (item: Item, close: () => void) => ReactNode;
}) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const canEdit = useCanEdit();
  const [actionsFor, setActionsFor] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [creating, setCreating] = useState(false);
  const progress = checklistProgress(items.map((i) => ({ done: views.get(i.id)?.struck ?? false, fraction: views.get(i.id)?.fraction })));
  const selected = actionsFor !== null ? items[actionsFor] : undefined;
  const selectedView = selected ? views.get(selected.id) : undefined;
  const close = () => {
    setActionsFor(null);
    setEditingTarget(false);
  };

  const moveTask = (task: Task, date: IsoDate) => {
    const lost = countCompletionsOutside(task.plannerId, task.id, taskDates({ ...task, date }));
    const run = () => {
      moveTaskToDate(task, date);
      close();
    };
    if (lost > 0) confirm(t('target.discardConfirm', { count: lost }), run);
    else run();
  };

  return (
    <View style={styles.wrap}>
      <ProgressBar percent={progress.percent} color={progressColor} />
      {items.map((item, index) => {
        const view = views.get(item.id);
        if (!view) return null;
        return (
          <View key={item.id} style={styles.item}>
            <View style={styles.row}>
              {view.control === 'done' ? (
                <Checkbox checked={view.checked} label={item.title} onToggle={canEdit ? view.onToggle : undefined} />
              ) : view.control === 'cell' && view.cell ? (
                <DayCell cell={view.cell} label={item.title} />
              ) : null}
              <View style={styles.titleCol}>
                <EditableText
                  value={item.title}
                  label={item.title}
                  maxLength={TEXT_LIMITS.title}
                  editable={canEdit}
                  onSave={(title) => (title.trim() ? renameItem(kind, item, title) : undefined)}
                  style={view.struck ? text.done : undefined}
                />
                {view.status ? <Text style={[text.muted, styles.status]}>{view.status}</Text> : null}
              </View>
              {canEdit ? <IconButton glyph="⋯" label={t('common.edit')} onPress={() => setActionsFor(index)} /> : null}
            </View>
            {view.strip ? (
              <View style={styles.strip}>
                {view.strip.map((cell) => (
                  <View key={cell.date} style={styles.stripCell}>
                    <Text style={[styles.stripDay, { color: p.textMuted }]}>{formatWeekday(cell.date, 'narrow')}</Text>
                    <DayCell cell={cell} label={`${item.title} ${formatWeekday(cell.date, 'short')}`} compact />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      {canEdit && renderCreate ? <AddButton label={addPlaceholder} onPress={() => setCreating(true)} /> : null}
      {canEdit && !renderCreate && onAdd ? <AddRow placeholder={addPlaceholder} onAdd={onAdd} maxLength={TEXT_LIMITS.title} /> : null}
      {renderCreate ? (
        <Sheet visible={creating} onClose={() => setCreating(false)} title={addPlaceholder.replace(/…$/, '')}>
          {creating ? renderCreate(() => setCreating(false)) : null}
        </Sheet>
      ) : null}

      <Sheet visible={selected !== undefined} onClose={close} title={selected?.title ?? ''}>
        {selected && actionsFor !== null ? (
          editingTarget && renderTargetEditor ? (
            renderTargetEditor(selected, close)
          ) : (
            <View style={styles.actions}>
              <View style={styles.actionRow}>
                <Button
                  title={`↑ ${t('common.moveUp')}`}
                  variant="secondary"
                  disabled={actionsFor === 0}
                  onPress={() => {
                    moveWithinList(kind, items, actionsFor, -1);
                    setActionsFor(actionsFor - 1);
                  }}
                />
                <Button
                  title={`↓ ${t('common.moveDown')}`}
                  variant="secondary"
                  disabled={actionsFor === items.length - 1}
                  onPress={() => {
                    moveWithinList(kind, items, actionsFor, 1);
                    setActionsFor(actionsFor + 1);
                  }}
                />
              </View>
              {renderTargetEditor ? (
                <Button title={t('target.edit')} variant="secondary" onPress={() => setEditingTarget(true)} />
              ) : null}
              {selectedView?.onUndo ? (
                <Button
                  title={t('target.undoLastTap')}
                  variant="secondary"
                  onPress={() => {
                    selectedView.onUndo?.();
                  }}
                />
              ) : null}
              {kind === 'task' && moveTargets ? (
                <>
                  <Text style={text.muted}>{t('day.moveTo')}</Text>
                  <View style={styles.targets}>
                    {moveTargets
                      .filter((d) => d !== (selected as Task).date)
                      .map((date) => (
                        <Button
                          key={date}
                          variant="secondary"
                          title={`${formatWeekday(date, 'short')} ${formatMonthDay(date)}`}
                          onPress={() => moveTask(selected as Task, date)}
                        />
                      ))}
                  </View>
                </>
              ) : null}
              <Button
                title={t('common.delete')}
                variant="danger"
                onPress={() => {
                  deleteItem(kind, selected);
                  close();
                }}
              />
            </View>
          )
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  item: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleCol: { flex: 1 },
  status: { fontSize: 12, marginTop: -2 },
  strip: { flexDirection: 'row', gap: 4, paddingLeft: 4, flexWrap: 'wrap' },
  stripCell: { alignItems: 'center', gap: 2, minWidth: 30 },
  stripDay: { fontSize: 10, fontWeight: '600' },
  actions: { gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
