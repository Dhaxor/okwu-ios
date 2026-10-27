# Fonts

Okwu ships two SIL International faces, unmodified, through the
`@expo-google-fonts/andika` and `@expo-google-fonts/gentium-book-plus` packages
(loaded in `app/_layout.tsx`):

| Face | Files | Use |
|---|---|---|
| Gentium Book Plus | 400, 700 | Display headings and all Igbo text (`<T igbo>`) |
| Andika | 400, 700 | Interface text, English glosses, labels |

Both are licensed under the SIL Open Font License 1.1 (texts beside this file).
Both declare Reserved Font Names ("Gentium", "Andika", "SIL"), so a modified
or subsetted copy must be renamed. Ship them unmodified. The licence texts must
be reachable from the app's acknowledgements screen before release.
