import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { readTokenPx } from '../../styles/read-token';

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
      const maxHeight = readTokenPx('--listbox-max-height');
      const minWidth = readTokenPx('--listbox-min-width');
      const gap = readTokenPx('--listbox-gap');
      const pad = readTokenPx('--listbox-viewport-pad');
      const listHeight = Math.min(maxHeight, listRef.current?.offsetHeight ?? maxHeight);
      const spaceBelow = window.innerHeight - anchor.bottom - pad;
      const placeAbove = spaceBelow < listHeight && anchor.top > spaceBelow;
      setStyle({
        position: 'fixed',
        left: anchor.left,
        width: Math.max(anchor.width, minWidth),
        top: placeAbove ? Math.max(pad, anchor.top - listHeight - gap) : anchor.bottom + gap,
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
