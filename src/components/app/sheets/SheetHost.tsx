'use client';

import { closeSheet, getItem, useStore } from '@/lib/store/store';
import { PEOPLE_BY_ID } from '@/lib/catalog';
import { SAMPLE_SHORTS } from '@/lib/shorts';
import { Sheet } from '../../ui/Sheet';
import { RecordView } from '../RecordView';
import { LookSheet, leaveLookSheet } from '../LookPicker';
import { AddOwnSheet, CanonPickerSheet, CanonSlotSheet, ManualSheet, PassportCodeSheet, PersonSheet, SettingsSheet } from './Sheets';
import { ShortSheet, SubmitShortSheet } from './ShortSheets';

export function SheetHost() {
  const top = useStore((s) => s.sheets[s.sheets.length - 1]);
  const remotePeople = useStore((s) => s.remote.people);
  const shorts = useStore((s) => s.shorts);
  if (!top) return null;
  const { spec, key } = top;
  switch (spec.type) {
    case 'record': {
      const item = getItem(spec.id);
      return (
        <Sheet key={key} title={item ? item.title : 'Record'} onClose={closeSheet}>
          <RecordView id={spec.id} onNavigate={closeSheet} />
        </Sheet>
      );
    }
    case 'settings':
      return (
        <Sheet key={key} title="Settings" onClose={closeSheet}>
          <SettingsSheet />
        </Sheet>
      );
    case 'manual':
      return (
        <Sheet key={key} title="Field manual" onClose={closeSheet}>
          <ManualSheet />
        </Sheet>
      );
    case 'canon-picker':
      return (
        <Sheet key={key} title="Canonical nine" onClose={closeSheet}>
          <CanonPickerSheet />
        </Sheet>
      );
    case 'canon-slot':
      return (
        <Sheet key={key} title={`Canon slot ${spec.index + 1}`} onClose={closeSheet}>
          <CanonSlotSheet index={spec.index} />
        </Sheet>
      );
    case 'person': {
      const p = PEOPLE_BY_ID[spec.id] ?? remotePeople.find((x) => x.id === spec.id);
      return (
        <Sheet key={key} title={p ? `${p.name}’s passport` : 'Passport'} onClose={closeSheet}>
          {p ? <PersonSheet person={p} /> : <p>This passport isn’t available right now.</p>}
        </Sheet>
      );
    }
    case 'add-own':
      return (
        <Sheet key={key} title="Add it yourself" onClose={closeSheet}>
          <AddOwnSheet initial={spec} />
        </Sheet>
      );
    case 'look':
      return (
        <Sheet key={key} title="Your look" onClose={() => leaveLookSheet(spec.next)}>
          <LookSheet next={spec.next} />
        </Sheet>
      );
    case 'short': {
      const s = shorts.mine.find((x) => x.id === spec.id) ?? shorts.live.find((x) => x.id === spec.id) ?? SAMPLE_SHORTS.find((x) => x.id === spec.id);
      return (
        <Sheet key={key} title={s ? s.title : 'Short film'} onClose={closeSheet}>
          {s ? <ShortSheet short={s} /> : <p>This film isn’t available right now.</p>}
        </Sheet>
      );
    }
    case 'submit-short':
      return (
        <Sheet key={key} title="Send your film" onClose={closeSheet}>
          <SubmitShortSheet />
        </Sheet>
      );
    case 'passport-code':
      return (
        <Sheet key={key} title="Your passport code" onClose={closeSheet}>
          <PassportCodeSheet />
        </Sheet>
      );
  }
}
