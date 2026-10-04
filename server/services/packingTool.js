const fs = require('node:fs/promises');
const path = require('node:path');

async function sendPackingTool(res) {
  const kit = await fs.readFile(path.join(__dirname, '..', '..', 'tools', 'polygon-packer', 'kit.zip'));
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', 'attachment; filename="aarambh-polygon-packer.zip"');
  return res.send(kit);
}
module.exports = { sendPackingTool };
