# Aarambh packing tool

This is a working event adapter of Flamethr0wer/polygon-packer, commit
966ed7af8010e0be132fed3aa174a94da6d7d0e7. The Python program is distributed
under GPL-3.0, with the original LICENSE included.

Install the requirements in a virtual environment:

    python -m venv .venv
    .venv\Scripts\python -m pip install -r requirements.txt

On macOS/Linux use `.venv/bin/python` instead. The positional arguments are
the polygon count, the inner polygon's number of sides, and the container's
number of sides. Use the values required by your room.

    python polygon_packer.py COUNT INNER_SIDES CONTAINER_SIDES --attempts 2 --jobs 2 --finalstep 0.001 --json packing-result.json

Paste the contents of `packing-result.json` into the room's layout editor and
choose Import layout. The room converts circumradii/radians to its side-length
units and container orientation. Its server checks the actual geometry.

Each attempt uses a repeatable seed. More attempts may improve a fit and take
longer. A generated layout can fail the target or geometry check; inspect it,
adjust it, or try more attempts. A plot or printed side length alone is not a
submission. Outside tools and your own constructions are also allowed.

Changes from the pinned source:

- Repair the two assignment/comparison syntax errors in output-format branches.
- Use the polygon area ratio for the compression lower bound. The original
  sqrt(count) estimate could make the shrink factor expand some configurations.
- Bound compression steps and add a worker limit, defaulting to two workers.
- Export coordinates, rotations and dimensions as JSON, alongside the plot.
- Default to four attempts and validate the numerical input ranges.
- Use a default penalty tolerance of 1e-12 for the event's geometric checks.

Original source: https://github.com/Flamethr0wer/polygon-packer
This kit contains no event solution or organizer fixture.
