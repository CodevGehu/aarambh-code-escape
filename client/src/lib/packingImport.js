// The creator's tool uses unit circumradii and radians. The room uses unit
// side lengths and degrees, with its own container orientation.
export function importPackingLayout(puzzle, value) {
  if (value?.format !== 'polygon-packer-v1') return { ...value, instance_id: puzzle.instance_id };
  if (value.inner_polygons !== puzzle.pieces.length || value.inner_sides !== 3 || value.container_sides !== puzzle.container.sides ||
    !Number.isFinite(value.inner_radius) || value.inner_radius <= 0 || value.inner_radius > 100 ||
    !Number.isFinite(value.container_radius) || value.container_radius <= 0 || !Array.isArray(value.positions) || value.positions.length !== puzzle.pieces.length) {
    throw new Error('This tool result has the wrong polygon count, shape, or dimensions for your room.');
  }
  const scale = 1 / (2 * value.inner_radius * Math.sin(Math.PI / value.inner_sides));
  const turn = puzzle.container.rotation * Math.PI / 180;
  const positions = value.positions.map((pose, i) => {
    if (!pose || ![pose.x, pose.y, pose.angle_radians].every(Number.isFinite)) throw new Error('Tool positions must contain finite x, y and angle_radians values.');
    return { id: puzzle.pieces[i].id,
      x: scale * (pose.x * Math.cos(turn) - pose.y * Math.sin(turn)),
      y: scale * (pose.x * Math.sin(turn) + pose.y * Math.cos(turn)),
      rotation: ((pose.angle_radians * 180 / Math.PI + puzzle.container.rotation) % 360 + 360) % 360 };
  });
  return { instance_id: puzzle.instance_id, container_side: value.container_radius * 2 * Math.sin(Math.PI / value.container_sides) * scale, positions };
}
