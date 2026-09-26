// parse-routes.mjs — extract the route table from mywhooshinfo HTML.
// Tolerant by design: rows are recognized by shape (5+ cells, numeric
// distance + elevation), not by classes or attributes, so minor site
// redesigns don't break the weekly refresh. Zero dependencies.
export function parseRoutesHtml(html) {
  const routes = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const cells = [];
    const cellRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let cell;
    while ((cell = cellRe.exec(row[1])) !== null) {
      cells.push(cell[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.length < 4) continue;
    const distanceKm = parseFloat(cells[2].replace(/\s/g, ''));
    const elevM = parseFloat(cells[3].replace(/\s/g, ''));
    if (!cells[0] || !cells[1] || !(distanceKm > 0) || !(elevM >= 0)) continue;
    routes.push({ name: cells[0], world: cells[1], distanceKm, elevM });
  }
  return routes;
}
