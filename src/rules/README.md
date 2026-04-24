# src/rules

MUTCD rules engine. Contains the 15-class device vocabulary enum, MUTCD Part 6
lookup tables (Table 6C-3 advance warning spacing, Table 6C-4 longitudinal
device spacing), taper length and buffer distance formulas, and layout
validators that check a proposed device placement against MUTCD requirements.
All calculations are pure functions with no external I/O, making this package
the most testable part of the system.
