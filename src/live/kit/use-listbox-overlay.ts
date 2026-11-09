import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { readTokenPx } from './read-token';

export function useListboxOverlay(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const minWidth = readTokenPx('--listbox-min-width');
      const gap = readTokenPx('--listbox-gap');
      const pad = readTokenPx('--listbox-viewport-pad');
      // A long list is taller than the token height, so place it by the height it actually has.
      const listHeight = listRef.current?.offsetHeight ?? readTokenPx('--listbox-max-height');
      const spaceBelow = window.innerHeight - anchor.bottom - gap - pad;
      const spaceAbove = anchor.top - gap - pad;
      const placeAbove = spaceBelow < listHeight && spaceAbove > spaceBelow;
      // The popover never runs past the window: it shrinks to the room on its side and its list scrolls.
      const room = Math.max(0, placeAbove ? spaceAbove : spaceBelow);
      setStyle({
        position: 'fixed',
        left: anchor.left,
        width: Math.max(anchor.width, minWidth),
        maxHeight: room,
        top: placeAbove ? anchor.top - gap - Math.min(listHeight, room) : anchor.bottom + gap,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, listRef, open]);

  return style;
}
