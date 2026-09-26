# TODO

## Levels

### Level 10

Sources:
1. row 1, col 0, color red, direction right

Targets:
1. row 1, col 12, color red
1. row 2, col 13, color red
1. row 13, col 11, color red
1. row 14, col 7, color red
1. row 9, col 1, color red
1. row 5, col 2, color red
1. row 5, col 7, color red
1. row 8, col 10, color red
1. row 9, col 5, color red

Blockers:
Row 3, col 0 to col 11
Rows 4 to 12, col 11
Row 12, col 2 to 10
Rows 6 to 11, col 2
Row 6, cols 3 to 8
Rows 7 to 10, col 8
Row 10, cols 4 to 7
Rows 8 to 9, col 4
Row 8, cols 5 to 6

Benders: 18
Mirror: 1

### Level 11

Sources:
1. Row 7, col 1, color: red, direction: right
1. Row 8, col 13, color green, direction: left


Targets:
1. Row 2, col 4, color red
1. Row 2, col 10, color green


Blockers
1. Row 1, col 3 to 11
1. Row 2, col 3
1. Row 2, col 5 to 9
1. Row 2, col 11
1. Row 3, col 3 to 4
1. Row 3, col 6 to 8
1. Row 3, col 10 to 11
1. Row 4, col 3 to 5
1. Row 4, col 7
1. Row 4, col 9 to 11
1. Row 5, col 3 to 6
1. Row 5, col 8 to 11

Tools:
Mirrors: 3
Benders: 1

### Level 12

Sources
red col 1	row 9	dir right
blue	col 12 row 5	dir left


Targets:
red	col 3 row	6
red	col 11 row 9
red	col 5	row 11
blue	col 5	row 5
blue	col 10 row 6
blue	col 8	row 10

Splitter 3
Mirror 1


### Level 13
Level 13

Sources:

Row 1, col 14, color blue, direction left
Row 13, col 14, color red, direction left

Targets:

Row 4, col 7, color red
Row 5, col 3, color blue
Row 8, col 8, color red
Row 9, col 12, color blue
Row 10, col 5, color red
Row 10, col 9, color blue

Blockers:
Row 3, col 0 to 1
Row 3, col 3 to 14
Row 7, col 0 to 11
Row 7, col 13 to 14
Row 11, col 0 to 1
Row 11, col 3 to 14

Benders: 7
Splitters: 2

### Level 14

Sources:
1. Row 6, col 0, color red, direction right
1. Row 0, col 6, color blue, direction down
1. Row 14, col 8, color white, direction up
1. Row 8, col 14, color green, direction left

Targets:
1. Row 6, col 6, color green
1. Row 8, col 6, color white
1. Row 8, col 8, color red

Mirrors: 5
Benders: 2