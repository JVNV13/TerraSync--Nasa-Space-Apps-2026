# Learn page photos (optional)

Drop photos here and the Learn deck shows them on the card fronts instead of the
animated SVG illustration. Leave a slot empty and the SVG stays — nothing breaks,
and nothing appears in the console.

| File              | Card / round                                |
|-------------------|---------------------------------------------|
| `card-1.jpg`      | 01 · Rookie's first day                     |
| `card-2.jpg`      | 02 · The beach mistake                      |
| `card-3.jpg`      | 03 · The checklist                          |
| `card-4.jpg`      | 04 · Nobody's perfect                       |
| `card-5.jpg`      | 05 · The land of long shadows               |
| `card-6.jpg`      | 06 · What Earth can't fake                  |
| `game-1.jpg`      | Game round 1 · Atacama Desert               |
| `game-2.jpg`      | Game round 2 · Lava tubes in Hawaii         |
| `game-3.jpg`      | Game round 3 · A tropical beach             |
| `game-4.jpg`      | Game round 4 · Haughton Crater              |
| `game-5.jpg`      | Game round 5 · Antarctica's Dry Valleys     |
| `game-6.jpg`      | Game round 6 · Gravity                      |

Notes

- Landscape crops work best: the slot is wide and is cropped with `object-fit: cover`.
  Roughly 1200×800 or wider is plenty.
- The filenames are set per card in `js/edu-content.js` (the `photo` field), so rename
  them there if you prefer different names.
- Photos are decorative: the card's own text carries the meaning, so they are given an
  empty `alt`. If a photo ever becomes load-bearing, add an `alt` in `js/views/edu.js`.
- Mind the licence. NASA imagery is generally public domain, but check the specific
  image page, and keep any required credit in the project's docs.
