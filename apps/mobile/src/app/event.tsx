import {
  addDays,
  diffDays,
  EventException,
  eventExceptionId,
  IsoDate,
  isoWeekday,
  isValidIsoDate,
  IsoWeekday,
  maskFromWeekdays,
  maskIncludes,
  RecurrenceFreq,
  TEXT_LIMITS,
  weekKeyOf,
  weekRange,
  weekdaysFromMask,
} from '@planner/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  cancelOccurrence,
  createEvent,
  deleteEvent,
  editOccurrence,
  EventDraft,
  getEvent,
  updateEvent,
} from '@/data/repositories/events';
import { getItemOffsets, setItemReminders } from '@/data/repositories/reminders';
import { selectRows, WriteError } from '@/data/write';
import { ReminderPicker } from '@/features/reminders/ReminderPicker';
import { formatWeekday, todayIso } from '@/lib/format';
import { usePlanner, usePlannerId, PlannerGate } from '@/state/planner';
import { Button, Chip, Field, textStyles } from '@/ui/components';
import { DateField, TimeField } from '@/ui/pickers';
import { usePalette } from '@/ui/theme';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
type EndsMode = 'never' | 'until' | 'count';
type Pending = { action: 'save' | 'delete' } | null;

const FREQS: (RecurrenceFreq | null)[] = [null, 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'];
const FREQ_LABEL: Record<string, string> = {
  none: 'event.repeatNone',
  daily: 'event.repeatDaily',
  weekdays: 'event.repeatWeekdays',
  weekly: 'event.repeatWeekly',
  monthly: 'event.repeatMonthly',
  yearly: 'event.repeatYearly',
};

/**
 * Create or edit an event (DECISIONS A6, Q7, Q8). For a repeating event the user chooses
 * "This event" (stored as an exception snapshot) or "All events" (the series).
 */
function EventEditorContent() {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const plannerId = usePlannerId();
  const planner = usePlanner();
  const params = useLocalSearchParams<{ date?: string; eventId?: string; originalDate?: string }>();

  const event = params.eventId ? getEvent(plannerId, params.eventId) : null;
  const isRecurring = !!event?.recurrenceFreq;
  const originalDate = params.originalDate ?? event?.startDate ?? null;
  const exception = useMemo(
    () =>
      event && originalDate
        ? (selectRows<EventException>('event_exception', plannerId, 'id = ?', [eventExceptionId(event.id, originalDate)])[0] ??
          null)
        : null,
    [event, originalDate, plannerId],
  );
  // Prefill from this occurrence's snapshot if it was edited before, else from the series.
  const source = exception && !exception.cancelled ? exception : event;
  const initialDate = (exception?.date ?? originalDate ?? params.date ?? todayIso()) as IsoDate;

  const [title, setTitle] = useState(source?.title ?? '');
  const [date, setDate] = useState<string>(initialDate);
  const [allDay, setAllDay] = useState(source?.allDay ?? false);
  const [start, setStart] = useState(source?.startTime ?? '09:00');
  const [end, setEnd] = useState(source?.endTime ?? '');
  const [freq, setFreq] = useState<RecurrenceFreq | null>(event?.recurrenceFreq ?? null);
  const [weekdays, setWeekdays] = useState<IsoWeekday[]>(
    event?.recurrenceWeekdays ? weekdaysFromMask(event.recurrenceWeekdays) : [isoWeekday(initialDate)],
  );
  const [endsMode, setEndsMode] = useState<EndsMode>(
    event?.recurrenceUntil ? 'until' : event?.recurrenceCount ? 'count' : 'never',
  );
  const [until, setUntil] = useState(event?.recurrenceUntil ?? '');
  const [count, setCount] = useState(event?.recurrenceCount ? String(event.recurrenceCount) : '');
  const [offsets, setOffsets] = useState<number[]>(() => (event ? getItemOffsets(plannerId, event.id) : []));
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending>(null);

  const weekDates = weekRange(weekKeyOf(isValidIsoDate(date) ? date : initialDate, planner.weekStartDay), planner.weekStartDay).days;

  function validate(): string[] {
    const e: string[] = [];
    if (!title.trim()) e.push('TITLE_REQUIRED');
    if (!isValidIsoDate(date)) e.push('INVALID_DATE');
    if (!allDay && !TIME_RE.test(start)) e.push('INVALID_TIME');
    if (!allDay && end !== '' && !TIME_RE.test(end)) e.push('INVALID_TIME');
    if (freq && endsMode === 'until' && !isValidIsoDate(until)) e.push('INVALID_DATE');
    if (freq && endsMode === 'count' && !(Number(count) > 0 && Number.isInteger(Number(count)))) e.push('INVALID_COUNT');
    return [...new Set(e)];
  }

  function draft(startDate: IsoDate): EventDraft {
    return {
      title,
      startDate,
      allDay,
      startTime: allDay ? null : start,
      endTime: allDay || end === '' ? null : end,
      recurrenceFreq: freq,
      recurrenceWeekdays: freq === 'weekly' ? maskFromWeekdays(weekdays) : null,
      recurrenceUntil: freq && endsMode === 'until' ? until : null,
      recurrenceCount: freq && endsMode === 'count' ? Number(count) : null,
    };
  }

  function run(action: () => void) {
    try {
      action();
      router.back();
    } catch (err) {
      setErrors(err instanceof WriteError && err.issues.length ? err.issues : ['generic']);
      setPending(null);
    }
  }

  function save(scope: 'this' | 'all' | 'only') {
    const e = validate();
    setErrors(e);
    if (e.length) return;
    run(() => {
      // Reminders belong to the event (every occurrence), whichever scope is saved.
      if (!event) {
        setItemReminders(plannerId, 'event', createEvent(plannerId, draft(date)), offsets);
        return;
      }
      if (scope === 'this' && originalDate) {
        editOccurrence(event, originalDate, {
          title,
          date,
          allDay,
          startTime: allDay ? null : start,
          endTime: allDay || end === '' ? null : end,
        });
      } else {
        // Whole series: moving this occurrence's date shifts the series start by the same amount.
        const shift = originalDate ? diffDays(date, originalDate) : 0;
        updateEvent(event, draft(isRecurring ? addDays(event.startDate, shift) : date));
      }
      setItemReminders(plannerId, 'event', event.id, offsets);
    });
  }

  function remove(scope: 'this' | 'all' | 'only') {
    if (!event) return;
    run(() => (scope === 'this' && originalDate ? cancelOccurrence(event, originalDate) : deleteEvent(event)));
  }

  const ask = (action: 'save' | 'delete') => {
    if (action === 'save' && validate().length) return setErrors(validate());
    if (isRecurring) setPending({ action });
    else if (action === 'save') save('only');
    else remove('only');
  };

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: event ? t('event.edit') : t('event.new') }} />

      <Text style={text.muted}>{t('event.title')}</Text>
      <Field value={title} onChangeText={setTitle} maxLength={TEXT_LIMITS.title} placeholder={t('event.titlePlaceholder')} accessibilityLabel={t('event.title')} />

      <Text style={text.muted}>{t('event.date')}</Text>
      <DateField value={date} onChange={(v) => v && setDate(v)} label={t('event.date')} />

      <View style={styles.row}>
        <Text style={text.body}>{t('event.allDay')}</Text>
        <Switch value={allDay} onValueChange={setAllDay} accessibilityLabel={t('event.allDay')} />
      </View>
      {!allDay ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={text.muted}>{t('event.start')}</Text>
            <TimeField value={start} onChange={(v) => v && setStart(v)} label={t('event.start')} />
          </View>
          <View style={styles.flex}>
            <Text style={text.muted}>{t('event.end')}</Text>
            <TimeField value={end || null} onChange={(v) => setEnd(v ?? '')} label={t('event.end')} clearable />
          </View>
        </View>
      ) : null}

      <ReminderPicker
        value={offsets}
        onChange={setOffsets}
        hint={[allDay ? t('reminder.noTimeHint') : '', freq ? t('reminder.seriesHint') : ''].filter(Boolean).join(' ') || undefined}
      />

      {/* Repeat settings belong to the series: saving with "This event" keeps the series' rule. */}
      <Text style={text.muted}>{t('event.repeat')}</Text>
      <View style={styles.chips}>
        {FREQS.map((f) => (
          <Chip key={f ?? 'none'} label={t(FREQ_LABEL[f ?? 'none']!)} selected={freq === f} onPress={() => setFreq(f)} />
        ))}
      </View>
      {freq === 'weekly' ? (
        <View style={styles.chips}>
          {weekDates.map((d) => {
            const wd = isoWeekday(d);
            return (
              <Chip
                key={d}
                label={formatWeekday(d, 'short')}
                selected={maskIncludes(maskFromWeekdays(weekdays), wd)}
                onPress={() => setWeekdays((s) => (s.includes(wd) ? s.filter((x) => x !== wd) : [...s, wd]))}
              />
            );
          })}
        </View>
      ) : null}
      {freq ? (
        <>
          <Text style={text.muted}>{t('event.ends')}</Text>
          <View style={styles.chips}>
            <Chip label={t('event.endsNever')} selected={endsMode === 'never'} onPress={() => setEndsMode('never')} />
            <Chip label={t('event.endsOn')} selected={endsMode === 'until'} onPress={() => setEndsMode('until')} />
            <Chip label={t('event.endsAfter')} selected={endsMode === 'count'} onPress={() => setEndsMode('count')} />
          </View>
          {endsMode === 'until' ? (
            <DateField value={until || null} onChange={(v) => v && setUntil(v)} label={t('event.endsOn')} min={date} />
          ) : null}
          {endsMode === 'count' ? (
            <View style={styles.row}>
              <Field value={count} onChangeText={setCount} keyboardType="number-pad" style={styles.countField} accessibilityLabel={t('event.occurrences')} />
              <Text style={text.body}>{t('event.occurrences')}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {errors.map((code) => (
        <Text key={code} style={{ color: p.danger }}>
          {t(`errors.${code}`, { defaultValue: t('errors.generic') })}
        </Text>
      ))}

      {pending ? (
        <View style={[styles.scope, { borderColor: p.border, backgroundColor: p.surfaceMuted }]}>
          <Text style={text.body}>{t('event.scopeQuestion')}</Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                title={t('event.scopeThis')}
                variant={pending.action === 'delete' ? 'danger' : 'primary'}
                onPress={() => (pending.action === 'save' ? save('this') : remove('this'))}
              />
            </View>
            <View style={styles.flex}>
              <Button
                title={t('event.scopeAll')}
                variant={pending.action === 'delete' ? 'danger' : 'secondary'}
                onPress={() => (pending.action === 'save' ? save('all') : remove('all'))}
              />
            </View>
          </View>
          <Button title={t('common.cancel')} variant="secondary" onPress={() => setPending(null)} />
        </View>
      ) : (
        <>
          <Button title={t('common.save')} onPress={() => ask('save')} />
          {event ? <Button title={t('event.deleteEvent')} variant="danger" onPress={() => ask('delete')} /> : null}
          <Button title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Fixed bottom room (not keyboard-dependent, so nothing shifts under a tap on iPhone):
  // Save / Cancel can always be scrolled above the on-screen keyboard.
  form: { padding: 16, paddingBottom: 320, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  flex: { flex: 1, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countField: { width: 80 },
  scope: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
});

/** Waits for the local database before rendering (see PlannerGate). */
export default function EventEditor() {
  return (
    <PlannerGate>
      <EventEditorContent />
    </PlannerGate>
  );
}
