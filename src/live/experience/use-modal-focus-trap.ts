import { useEffect, useRef, type RefObject } from 'react';

export function useModalFocusTrap(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const focusable = () =>
      [
        ...(container?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((element) => !element.hasAttribute('disabled'));
    const initialFocus = focusable().find((element) => !['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName));
    const previousContainerTabIndex = container ? container.getAttribute('tabindex') : null;
    if (initialFocus) initialFocus.focus();
    else if (container) {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const modalDialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')];
      const topModal = modalDialogs[modalDialogs.length - 1];
      if (topModal && topModal !== container) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
      if (container) {
        if (previousContainerTabIndex === null) container.removeAttribute('tabindex');
        else container.setAttribute('tabindex', previousContainerTabIndex);
      }
    };
  }, [containerRef, open]);
}
