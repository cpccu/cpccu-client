'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toDhakaInputValue, utcIsoFromDhakaInput } from '@/lib/dhaka-time';

/**
 * One schedule instant, plus the optional "same as the event" toggle.
 *
 * The default conversion pins admin-entered wall-clock times to Dhaka, independent
 * of the browser's timezone. Optional converters remain available to callers with
 * a different explicit time convention.
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
 * in the CALLING form's own space. Its instant is supplied by the calling form,
 * and should only be resolved by that form rather than guessed here.
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
