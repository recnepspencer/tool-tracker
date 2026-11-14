import type { Page } from '@playwright/test';

/**
 * Geometry a person notices on a settled screen: an icon off its label's centre line,
 * neighbouring controls of different heights, controls on top of each other, text cut
 * off or spilling out of its box, a page wider than the window and, on touch screens,
 * targets too small to tap. Returns one sentence per problem, so a failure lists them all.
 */
export async function layoutProblems(page: Page, { touch = false } = {}) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((touch) => {
    const problems: string[] = [];
    const px = (value: number) => `${Math.round(value * 10) / 10}px`;
    const describe = (element: Element) => {
      const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const kind = element.classList[0] ? `.${element.classList[0]}` : '';
      return `${element.tagName.toLowerCase()}${kind}${name ? ` "${name.slice(0, 40)}"` : ''}`;
    };
    // While a modal dialog is open, only it can be seen and used.
    const modals = [...document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')];
    const scope = modals.at(-1) ?? document.body;
    const shown = (element: Element) => {
      if (!scope.contains(element) || element.closest('[inert], [aria-hidden="true"]')) return false;
      const box = element.getBoundingClientRect();
      if (box.width <= 2 || box.height <= 2) return false;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      // On screen, it must be what a tap at its centre reaches (not under a scrim or a sticky bar).
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return true;
      const top = document.elementFromPoint(x, y);
      return !!top && (element.contains(top) || top.contains(element));
    };
    const all = (selector: string) => [...scope.querySelectorAll(selector)].filter(shown);
    const outermost = (elements: Element[]) =>
      elements.filter((element) => !elements.some((other) => other !== element && other.contains(element)));
    const overlap = (a: DOMRect, b: DOMRect) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

    if (document.documentElement.scrollWidth > innerWidth + 1)
      problems.push(`the page is ${px(document.documentElement.scrollWidth - innerWidth)} wider than the window`);

    // An icon beside its label centres on the label's line (or on the block of lines it sits beside).
    const hosts =
      'button, a[href], label, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [class*="badge"], [class*="chip"]';
    for (const icon of all('svg')) {
      const host = icon.parentElement?.closest(hosts);
      if (!host) continue;
      const box = icon.getBoundingClientRect();
      const beside: { line: DOMRect; gap: number }[] = [];
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent?.trim() || text.parentElement?.closest('svg') || !shown(text.parentElement!)) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const line of range.getClientRects()) {
          const shared = Math.min(line.bottom, box.bottom) - Math.max(line.top, box.top);
          const gap =
            line.left >= box.right - 1
              ? line.left - box.right
              : box.left >= line.right - 1
                ? box.left - line.right
                : -1;
          if (line.width > 1 && shared > 0 && gap >= -1 && gap <= 24) beside.push({ line, gap });
        }
      }
      if (!beside.length) continue;
      const nearest = Math.min(...beside.map((item) => item.gap));
      const lines = beside.filter((item) => item.gap <= nearest + 2).map((item) => item.line);
      const offset =
        (box.top + box.bottom) / 2 -
        (Math.min(...lines.map((line) => line.top)) + Math.max(...lines.map((line) => line.bottom))) / 2;
      if (Math.abs(offset) > 1)
        problems.push(
          `${describe(host)}: its icon sits ${px(Math.abs(offset))} ${offset > 0 ? 'below' : 'above'} the label`,
        );
    }

    // Controls side by side in one row are the same height.
    const controls = outermost(
      all(
        '.button, .field, select, [role="combobox"], input:not([type="checkbox"], [type="radio"], [type="file"], [type="range"], [type="hidden"])',
      ),
    );
    for (const [index, a] of controls.entries())
      for (const b of controls.slice(index + 1)) {
        const first = a.getBoundingClientRect();
        const second = b.getBoundingClientRect();
        if (Math.max(first.height, second.height) > 120) continue;
        const shared = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
        const gap = Math.max(second.left - first.right, first.left - second.right);
        if (
          shared >= Math.min(first.height, second.height) / 2 &&
          gap >= 0 &&
          gap <= 32 &&
          Math.abs(first.height - second.height) > 1
        )
          problems.push(`${describe(a)} is ${px(first.height)} tall beside ${describe(b)} at ${px(second.height)}`);
      }

    const clickable = all(
      'button, a[href], input, select, textarea, summary, [role="button"], [role="switch"], [role="tab"], [role="combobox"], [role="option"]',
    );
    // Fixed chrome floats over the page, which scrolls clear of it; only two pinned things can collide.
    const pinned = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement)
        if (getComputedStyle(node).position === 'fixed') return true;
      return false;
    };
    for (const [index, a] of clickable.entries())
      for (const b of clickable.slice(index + 1)) {
        if (a.contains(b) || b.contains(a) || pinned(a) !== pinned(b)) continue;
        if (overlap(a.getBoundingClientRect(), b.getBoundingClientRect()) > 4)
          problems.push(`${describe(a)} overlaps ${describe(b)}`);
      }

    // A card or panel keeps clear of whatever sits beside it: a button, a field or another card.
    // A card is a box drawn on its own (a full border, or a fill unlike what is behind it) big
    // enough to hold content, so badges and dividers don't count.
    const fill = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        const colour = getComputedStyle(node).backgroundColor;
        if (colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent') return colour;
      }
      return 'rgb(255, 255, 255)';
    };
    const drawn = (element: Element) => {
      const style = getComputedStyle(element);
      const border = ['Top', 'Right', 'Bottom', 'Left'].every(
        (side) =>
          parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
          style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none',
      );
      return border || fill(element) !== fill(element.parentElement);
    };
    // Inside the page's own content: the side bar and top bar meet the page edge on purpose.
    const content = modals.at(-1) ?? document.querySelector('main') ?? document.body;
    const cards = all('body *').filter((element) => {
      if (!content.contains(element) || element === content) return false;
      if (clickable.includes(element) || element.closest('.field, .button, button, a[href]')) return false;
      const box = element.getBoundingClientRect();
      return box.width >= 64 && box.height >= 32 && drawn(element);
    });
    // Compare things sitting on the same surface: two cards on the page, or a button and a panel in one card.
    const surface = (element: Element) => {
      for (let node = element.parentElement; node && node !== content; node = node.parentElement)
        if (cards.includes(node)) return node;
      return content;
    };
    const neighbours = [...cards, ...outermost(all('.button, .field, button, a.button'))];
    for (const [index, card] of cards.entries())
      for (const other of neighbours) {
        const later = cards.indexOf(other);
        if ((later >= 0 && later <= index) || !content.contains(other)) continue;
        if (other.contains(card) || card.contains(other)) continue;
        if (surface(card) !== surface(other)) continue;
        const a = card.getBoundingClientRect();
        const b = other.getBoundingClientRect();
        const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const along = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const gap =
          across > 0
            ? Math.max(b.top - a.bottom, a.top - b.bottom)
            : along > 0
              ? Math.max(b.left - a.right, a.left - b.right)
              : // Diagonal neighbours share no edge, so neither can crowd the other.
                Infinity;
        if (gap >= -1 && gap < 8)
          problems.push(`${describe(card)} is only ${px(Math.max(gap, 0))} from ${describe(other)}`);
      }

    // Text is never cut off without an ellipsis, and a label never spills out of its control.
    for (const element of all('body *')) {
      const ownText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!ownText) continue;
      const style = getComputedStyle(element);
      const clips = ['hidden', 'clip'].includes(style.overflowX) && style.textOverflow !== 'ellipsis';
      const control = clickable.includes(element) && !['auto', 'scroll'].includes(style.overflowX);
      if ((clips || control) && element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0)
        problems.push(
          `${describe(element)} cuts off or spills ${px(element.scrollWidth - element.clientWidth)} of its text`,
        );
    }

    // WCAG 2.2 target size (2.5.8): 24 by 24 CSS pixels. A field's whole box reaches its control,
    // so the box is the control's target. Links inside running text are exempt, and so is a smaller
    // target whose 24px circle touches no other target (the spacing exception).
    if (touch) {
      const targets = [
        ...new Set(
          outermost(clickable).map((element) =>
            element.matches('input, select, textarea, [role="combobox"]')
              ? (element.closest('.field') ?? element)
              : element,
          ),
        ),
      ];
      const centre = (box: DOMRect) => [box.left + box.width / 2, box.top + box.height / 2];
      const small = targets.filter((element) => {
        const box = element.getBoundingClientRect();
        return getComputedStyle(element).display !== 'inline' && (box.width < 24 || box.height < 24);
      });
      for (const element of small) {
        const box = element.getBoundingClientRect();
        const [x, y] = centre(box);
        const crowded = targets.some((other) => {
          if (other === element || other.contains(element) || element.contains(other)) return false;
          const near = other.getBoundingClientRect();
          const reach = Math.hypot(
            Math.max(near.left - x, 0, x - near.right),
            Math.max(near.top - y, 0, y - near.bottom),
          );
          if (reach < 12) return true;
          const [ox, oy] = centre(near);
          return small.includes(other) && Math.hypot(ox - x, oy - y) < 24;
        });
        if (crowded)
          problems.push(
            `${describe(element)} is only ${px(box.width)} by ${px(box.height)} to tap, too close to another target`,
          );
      }
    }
    return [...new Set(problems)];
  }, touch);
}
