import "./instrumentation"; // Must be the first import
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dbQuery, ordersCreate, ordersAppend, generateSignature, taskReset, taskDone, type ApiResponse } from './task.js';
import { shutdownTracing } from "./instrumentation.js";

const WORKSPACE = join(process.cwd(), 'workspace');
const PIPELINE = join(WORKSPACE, 'pipeline');

const save = async (name: string, data: unknown): Promise<void> => {
  await mkdir(PIPELINE, { recursive: true });
  await writeFile(join(PIPELINE, name), JSON.stringify(data, null, 2), 'utf-8');
};

/** Extract rows from any DB query response shape */
type Row = Record<string, unknown>;
function extractRows(resp: ApiResponse): Row[] {
  for (const key of ['reply', 'rows', 'data', 'results', 'records']) {
    const val = resp[key];
    if (Array.isArray(val)) return val as Row[];
  }
  return [];
}

/** Find which column in rows loosely matches one of the candidate names */
function findCol(rows: Row[], ...candidates: string[]): string | undefined {
  if (!rows.length) return undefined;
  const keys = Object.keys(rows[0]);
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

async function main() {
  // ── 1. Load city needs ───────────────────────────────────────────────────
  const food4cities = JSON.parse(
    await readFile(join(WORKSPACE, 'food4cities.json'), 'utf-8')
  ) as Record<string, Record<string, number>>;
  console.log('Cities to supply:', Object.keys(food4cities));

  // ── 2. Explore DB schema ─────────────────────────────────────────────────
  console.log('\n[DB] Discovering schema...');
  const tablesResp = await dbQuery('show tables');
  await save('db_tables.json', tablesResp);

  // Collect table names regardless of response shape (reply / tables / data)
  const tables: string[] = [];
  for (const key of ['tables', 'reply', 'data', 'rows']) {
    const val = tablesResp[key];
    if (Array.isArray(val)) {
      for (const row of val) {
        if (typeof row === 'string') tables.push(row);
        else if (row && typeof row === 'object') tables.push(...Object.values(row as Record<string, string>));
      }
      break;
    }
  }
  console.log('Tables found:', tables);

  // Fetch all data from all tables (paginate since API caps at 30 rows per query)
  const tableData: Record<string, Row[]> = {};
  for (const table of tables) {
    const allRows: Row[] = [];
    let offset = 0;
    while (true) {
      const resp = await dbQuery(`SELECT * FROM ${table} LIMIT 30 OFFSET ${offset}`);
      const rows = extractRows(resp);
      if (!rows.length) break;
      allRows.push(...rows);
      const total = resp.totalTableRows as number | undefined;
      if (total !== undefined && allRows.length >= total) break;
      offset += rows.length;
    }
    tableData[table] = allRows;
  }
  await save('db_data.json', tableData);

  // ── 3. Identify users and cities tables ──────────────────────────────────
  let usersTable = '';
  let citiesTable = '';

  for (const [table, rows] of Object.entries(tableData)) {
    if (!rows.length) continue;
    const keys = Object.keys(rows[0]).map(k => k.toLowerCase());
    if (keys.some(k => k.includes('login') || k.includes('birthday'))) usersTable = table;
    if (keys.some(k => k.includes('dest') || k.includes('code')) && keys.some(k => k.includes('city') || k.includes('name'))) citiesTable = table;
  }

  if (!usersTable) throw new Error('Could not identify users table. DB data: ' + JSON.stringify(tableData));
  if (!citiesTable) throw new Error('Could not identify cities/destinations table. DB data: ' + JSON.stringify(tableData));

  console.log(`Users table: ${usersTable}, Cities table: ${citiesTable}`);

  const userRows = tableData[usersTable];
  const cityRows = tableData[citiesTable];

  // ── 4. Pick a creator user (must have transport role) ───────────────────
  const idCol   = findCol(userRows, 'user_id', 'id');
  const loginCol = findCol(userRows, 'login', 'username', 'user');
  const bdayCol  = findCol(userRows, 'birthday', 'birth', 'date');
  const roleCol  = findCol(userRows, 'role');
  const activeCol = findCol(userRows, 'active', 'is_active');

  if (!idCol || !loginCol || !bdayCol) {
    throw new Error(`Cannot find required user columns. Keys: ${Object.keys(userRows[0] ?? {}).join(', ')}`);
  }

  // Find role_id for transport (look for "transport" in role names)
  const rolesRows = tableData[Object.keys(tableData).find(t => t !== usersTable && t !== citiesTable) ?? ''] ?? [];
  const roleIdCol = findCol(rolesRows, 'role_id', 'id');
  const roleNameCol = findCol(rolesRows, 'name');
  let transportRoleId: unknown;
  if (roleIdCol && roleNameCol) {
    const transportRole = rolesRows.find(r => String(r[roleNameCol]).toLowerCase().includes('transport'));
    transportRoleId = transportRole?.[roleIdCol];
  }
  console.log('Transport role id:', transportRoleId);

  // Pick first active user with transport role
  const creator = userRows.find(u => {
    if (activeCol && !u[activeCol]) return false;
    if (transportRoleId !== undefined && roleCol) return u[roleCol] == transportRoleId;
    return true;
  }) ?? userRows[0];

  const creatorID = Number(creator[idCol]);
  const creatorLogin = String(creator[loginCol]);
  const creatorBirthday = String(creator[bdayCol]);
  console.log(`Creator: ${creatorLogin} (id=${creatorID}, birthday=${creatorBirthday})`);

  // ── 5. Build city → destination map ─────────────────────────────────────
  const nameCol = findCol(cityRows, 'city', 'name', 'town');
  const destCol = findCol(cityRows, 'dest', 'code', 'id');

  if (!nameCol || !destCol) {
    throw new Error(`Cannot find city name/destination columns. Keys: ${Object.keys(cityRows[0] ?? {}).join(', ')}`);
  }

  const cityDestMap: Record<string, string> = {};
  for (const row of cityRows) {
    const cityName = String(row[nameCol]).toLowerCase().trim();
    cityDestMap[cityName] = String(row[destCol]);
  }
  await save('city_dest_map.json', cityDestMap);
  console.log('City→destination map:', cityDestMap);

  // Validate all cities from food4cities.json have a destination
  for (const city of Object.keys(food4cities)) {
    if (!cityDestMap[city]) {
      throw new Error(`No destination found for city: ${city}. Available: ${Object.keys(cityDestMap).join(', ')}`);
    }
  }

  // ── 6. Reset existing orders ─────────────────────────────────────────────
  console.log('\n[Orders] Resetting...');
  await taskReset();

  // ── 7. Create one order per city ─────────────────────────────────────────
  const orderResults: Record<string, unknown> = {};

  for (const [city, items] of Object.entries(food4cities)) {
    const destination = cityDestMap[city];
    console.log(`\n[${city}] destination=${destination}`);

    // Generate signature
    const sigResp = await generateSignature(creatorLogin, creatorBirthday, destination);
    const signature = String(sigResp.signature ?? sigResp.hash ?? sigResp.reply ?? sigResp.sign ?? '');
    if (!signature) throw new Error(`No signature returned for ${city}: ${JSON.stringify(sigResp)}`);
    console.log(`  signature: ${signature}`);

    // Create order
    const title = `Dostawa dla ${city.charAt(0).toUpperCase()}${city.slice(1)}`;
    const createResp = await ordersCreate(title, creatorID, destination, signature);
    const orderObj = createResp.order as Record<string, unknown> | undefined;
    const orderId = String(createResp.id ?? orderObj?.id ?? createResp.orderId ?? '');
    if (!orderId) throw new Error(`No order ID returned for ${city}: ${JSON.stringify(createResp)}`);
    console.log(`  order id: ${orderId}`);

    // Append all goods in batch mode
    const appendResp = await ordersAppend(orderId, items);
    const appendCode = Number(appendResp.code ?? 0);
    if (appendCode < 0) throw new Error(`Append failed for ${city}: ${JSON.stringify(appendResp)}`);

    orderResults[city] = { orderId, destination, signature, items };
  }

  await save('orders_created.json', orderResults);

  // ── 8. Call done ─────────────────────────────────────────────────────────
  console.log('\n[Done] Calling done...');
  const result = await taskDone();
  await save('final_result.json', result);
  console.log('\nFinal result:', JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await shutdownTracing();
  });
