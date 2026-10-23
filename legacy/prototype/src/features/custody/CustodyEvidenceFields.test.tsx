import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustodyPhotoEvidence } from '../../domain/evidence';
import { CustodyEvidenceFields } from './CustodyEvidenceFields';

class DeferredFileReader {
  static instances: DeferredFileReader[] = [];
  result: string | ArrayBuffer | null = null;
  aborted = false;
  private listeners = new Map<string, EventListener[]>();

  constructor() {
    DeferredFileReader.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  readAsDataURL() {}

  abort() {
    this.aborted = true;
    this.dispatch('loadend');
  }

  finish(result: string) {
    this.result = result;
    this.dispatch('load');
    this.dispatch('loadend');
  }

  private dispatch(type: string) {
    const event = new Event(type);
    this.listeners.get(type)?.forEach((listener) => listener.call(this, event));
  }
}

function EvidenceHarness() {
  const [photo, setPhoto] = useState<CustodyPhotoEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <CustodyEvidenceFields
        note=""
        photo={photo}
        onNoteChange={() => undefined}
        onPhotoChange={setPhoto}
        onPhotoBusyChange={setBusy}
      />
      <output>{busy ? 'busy' : 'idle'}</output>
    </>
  );
}

function ToggleEvidenceHarness() {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle fields
      </button>
      {visible ? (
        <CustodyEvidenceFields
          note=""
          photo={null}
          onNoteChange={() => undefined}
          onPhotoChange={() => undefined}
          onPhotoBusyChange={setBusy}
        />
      ) : null}
      <output>{busy ? 'busy' : 'idle'}</output>
    </>
  );
}

describe('custody photo evidence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    DeferredFileReader.instances = [];
  });

  it('ignores an older read and stays busy until the newest photo finishes', () => {
    vi.stubGlobal('FileReader', DeferredFileReader);
    render(<EvidenceHarness />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['first'], 'first.jpg', { type: 'image/jpeg' })] } });
    const firstReader = DeferredFileReader.instances[0];
    fireEvent.change(input, { target: { files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })] } });
    const secondReader = DeferredFileReader.instances[1];

    expect(firstReader.aborted).toBe(true);
    expect(screen.getByText('busy')).toBeInTheDocument();
    act(() => firstReader.finish('data:image/jpeg;base64,Zmlyc3Q='));
    expect(screen.getByText('busy')).toBeInTheDocument();
    expect(screen.queryByText('first.jpg')).not.toBeInTheDocument();

    act(() => secondReader.finish('data:image/jpeg;base64,c2Vjb25k'));
    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(screen.getByText('second.jpg')).toBeInTheDocument();
  });

  it('aborts an unfinished read when the fields unmount', () => {
    vi.stubGlobal('FileReader', DeferredFileReader);
    const view = render(<EvidenceHarness />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    const reader = DeferredFileReader.instances[0];
    view.unmount();
    expect(reader.aborted).toBe(true);
  });

  it('clears the parent busy state when an open picker is dismissed', () => {
    vi.stubGlobal('FileReader', DeferredFileReader);
    render(<ToggleEvidenceHarness />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    const reader = DeferredFileReader.instances[0];
    expect(screen.getByText('busy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle fields' }));
    expect(reader.aborted).toBe(true);
    expect(screen.getByText('idle')).toBeInTheDocument();
  });
});
