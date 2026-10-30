/** Joins class names, skipping falsy entries: `cx('a', isOn && 'b')`. */
export function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}
