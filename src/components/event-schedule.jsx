'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toDhakaInputValue, utcIsoFromDhakaInput } from '@/lib/dhaka-time';

/**
 * One schedule instant, plus the optional "same as the event" toggle.
 *
 * ⚠️ WHY THE `toInputValue` / `fromInputValue` PROPS ARE INJECTABLE, AND WHY THAT
 * IS NOT REFACTORING FOR ITS OWN SAKE.
 *
 * Two admin forms edit the same twelve fields and they deliberately disagree about
 * what a `datetime-local` wall-clock means:
 *
 *   events-content.jsx — a UTC slice in, `new Date(value).toISOString()` out, i.e.
 *     the typed wall-clock is interpreted in the ADMIN'S BROWSER timezone.
 *     Correct for a Dhaka admin; silently shifted by the browser's UTC offset for
 *     one abroad. It is a documented bug and it is left as it is, because the
 *     form covers the entire historical event archive: switching it to Dhaka
 *     wall-clock would re-interpret the stored instant of every event that
 *     already exists. See `src/lib/dhaka-time.js`.
 *
 *   hackathon-content.jsx / this component's default — `toDhakaInputValue` /
 *     `utcIsoFromDhakaInput`, i.e. Dhaka wall-clock pinned to UTC+6 regardless of
 *     where the admin is. Correct, and written correctly from the first commit
 *     because the participation window fields had no historical data to corrupt.
 *
 * Hard-coding Dhaka HERE would have silently given `events-content.jsx` Dhaka
 * semantics for the whole schedule the first time someone reused this component,
 * and nothing about that change would have been visible in a diff of the events
 * form — the form would simply start saving six hours off. So the asymmetry is a
 * PROP, the two callers state theirs explicitly, and neither inherits the other's
 * rule by accident.
 *
 * Props:
 *   id               — required, for `<Label htmlFor>`.
 *   label            — required.
 *   value            — the instant, ISO or null. Round-tripped by `toInputValue`.
 *   onChange         — called with the converted value, or `null` for a cleared
 *                      field. Receives ISO strings, never wall-clock.
 *   hint             — optional helper copy under the input.
 *   required         — marks the label; the server is still the gate.
 *   followsChecked   — presence turns the "same as" checkbox ON. Omit it and no
 *                      checkbox is rendered, which is what the two event instants
 *                      themselves use.
 *   onFollowsChange  — called with the new boolean.
 *   followLabel      — the checkbox text, e.g. "Same as event start".
 *   toInputValue     — instant → `YYYY-MM-DDTHH:mm`.
 *   fromInputValue   — `YYYY-MM-DDTHH:mm` → instant, or null for a blank input.
 *
 * ⚠️ THE FIELD NEVER SHOWS THE ANCHOR INSTANT, AND THAT IS A DELIBERATE OMISSION.
 * The obvious next feature is "when the box is ticked, display the event start it
 * now follows" — and it cannot be done safely from here, because the anchor lives
 * in the CALLING form's own space. `admin-event-participation-settings.jsx` keeps
 * its window instants as ISO strings while `events-content.jsx` keeps its event
 * instants as browser-timezone wall-clock, so the same `formData.eventStartAt` has
 * two encodings depending on which editor last wrote it. Rendering one through the
 * other's converter would put a time on screen that is six hours off the value the
 * server actually stores, and nothing about it would look wrong.
 *
 * The explanation the checkbox gets instead is static for exactly that reason. An
 * admin who needs the resolved instant can read the event start on the same form.
 *
 * ⚠️ TICKING THE TOGGLE CLEARS THE MANUAL INSTANT. The server overwrites the
 * target field from the anchor whenever the toggle is true, so anything left
 * sitting in a DISABLED input is a value that is not in use while looking exactly
 * like one that is — and it would silently come back the moment the toggle was
 * unticked. Clearing it makes the state legible: blank plus a ticked box means
 * "the server decides".
 */
export function ScheduleInstantField({
  id,
  label,
  value,
  onChange,
  hint,
  required = false,
  followsChecked,
  onFollowsChange,
  followLabel,
  toInputValue = toDhakaInputValue,
  fromInputValue = utcIsoFromDhakaInput,
}) {
  const showsFollowToggle =
    typeof followsChecked === 'boolean' && typeof onFollowsChange === 'function';

  const handleFollowsChange = (checked) => {
    if (checked && value) {
      onChange(null);
    }

    onFollowsChange(checked);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>

      <Input
        id={id}
        type="datetime-local"
        value={toInputValue(value)}
        disabled={showsFollowToggle && followsChecked}
        onChange={(e) => onChange(fromInputValue(e.target.value))}
      />

      {showsFollowToggle ? (
        <label
          htmlFor={`${id}-follows`}
          className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
        >
          <Checkbox
            id={`${id}-follows`}
            checked={followsChecked}
            onCheckedChange={(checked) => handleFollowsChange(checked === true)}
          />
          {/* One sentence covering both halves of the control: what it is tied to,
              and what happens to the field above while it is ticked. Stated here
              rather than inferred from the anchor, for the reason in the note on
              `anchorValue` above. */}
          <span>
            {followLabel} — the server sets this instant from the event schedule
            when you save.
          </span>
        </label>
      ) : null}

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default ScheduleInstantField;