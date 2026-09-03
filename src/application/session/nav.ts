export function navDir(k: string): { row: -1 | 0 | 1; col: -1 | 0 | 1 } {
  const x = k.length === 1 ? k.toLowerCase() : k
  if (x === 'w' || k === 'ArrowUp') return { row: -1, col: 0 }
  if (x === 's' || k === 'ArrowDown') return { row: 1, col: 0 }
  if (x === 'a' || k === 'ArrowLeft') return { row: 0, col: -1 }
  if (x === 'd' || k === 'ArrowRight') return { row: 0, col: 1 }
  return { row: 0, col: 0 }
}

export function pickIndexFromInput(key: string, code: string | null): number {
  const map: [string, string, string][] = [
    ['Numpad1', 'Digit1', '1'],
    ['Numpad2', 'Digit2', '2'],
    ['Numpad3', 'Digit3', '3'],
    ['Numpad4', 'Digit4', '4'],
    ['Numpad5', 'Digit5', '5'],
    ['Numpad6', 'Digit6', '6'],
  ]
  for (let i = 0; i < map.length; i++) {
    const [np, dg, ch] = map[i]!
    if (code === np || code === dg || key === ch) return i
  }
  return -1
}
