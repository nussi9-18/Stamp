'use client';

import { closeSheet, getItem, useStore } from '@/lib/store/store';
import { PEOPLE_BY_ID } from '@/lib/catalog';
import { Sheet } from '../../ui/Sheet';
import { RecordView } from '../RecordView';
import { AddOwnSheet, CanonPickerSheet, CanonSlotSheet, ManualSheet, PassportCodeSheet, PersonSheet, SettingsSheet } from './Sheets';

export function SheetHost() {
  const top = useStore((s) => s.sheets[s.sheets.length - 1]);
  const remotePeople = useStore((s) => s.remote.people);
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
    case 'passport-code':
      return (
        <Sheet key={key} title="Your passport code" onClose={closeSheet}>
          <PassportCodeSheet />
        </Sheet>
      );
  }
}
