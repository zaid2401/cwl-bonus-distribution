import crypto from "node:crypto";
import { parseCsv } from "./csv";

export async function loadRows(source: string): Promise<string[][]> {
  const src = source.trim();
  if (!src) throw new Error("Paste a Google Sheet link or CSV text.");
  if (!/^https?:\/\//i.test(src)) return clean(parseCsv(src));

  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(src);
  if (!m) throw new Error("That doesn't look like a Google Sheets link.");
  const gid = /[#&?]gid=(\d+)/.exec(src)?.[1] ?? "0";
  const url = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html"))
    throw new Error(
      "Could not read the sheet. Set sharing to “Anyone with the link can view” and open the correct tab before copying the link.",
    );
  return clean(parseCsv(await res.text()));
}

function clean(rows: string[][]) {
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// --- Sheets export, via a service account

async function accessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key)
    throw new Error(
      "Google service account is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).",
    );
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${body.error_description ?? body.error}`);
  return body.access_token;
}

export interface SheetExport {
  title: string;
  rows: (string | number | boolean)[][];
  greenRows: number[];
  goldRows: number[];
}

export async function writeSheetTab(sheetUrl: string, data: SheetExport): Promise<string> {
  const id = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(sheetUrl)?.[1];
  if (!id) throw new Error("Set a valid export Google Sheet link in Settings.");
  const token = await accessToken();
  const api = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message ?? res.statusText;
      if (res.status === 403 || res.status === 404)
        throw new Error(
          `Google Sheets: ${msg}. Share the sheet with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor.`,
        );
      throw new Error(`Google Sheets: ${msg}`);
    }
    return body;
  };

  const meta = await api("?fields=sheets.properties");
  const existing = meta.sheets?.find(
    (sh: { properties: { title: string } }) => sh.properties.title === data.title,
  );
  const requests: object[] = [];
  if (existing) requests.push({ deleteSheet: { sheetId: existing.properties.sheetId } });
  const newId = Math.floor(Math.random() * 1e9);
  requests.push({
    addSheet: {
      properties: {
        sheetId: newId,
        title: data.title,
        index: 0,
        gridProperties: {
          rowCount: data.rows.length + 5,
          columnCount: Math.max(26, data.rows[0]?.length ?? 0),
          frozenRowCount: 1,
        },
      },
    },
  });
  await api(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });

  await api(`/values/${encodeURIComponent(`'${data.title}'!A1`)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: data.rows }),
  });

  const color = (r: number, g: number, b: number) => ({ red: r, green: g, blue: b });
  const fmt = (row: number, bg: object, bold = false) => ({
    repeatCell: {
      range: { sheetId: newId, startRowIndex: row, endRowIndex: row + 1 },
      cell: { userEnteredFormat: { backgroundColor: bg, textFormat: { bold } } },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  });
  const fmtReqs = [
    fmt(0, color(0.85, 0.85, 0.85), true),
    ...data.greenRows.map((r) => fmt(r, color(0.8, 1, 0.8))),
    ...data.goldRows.map((r) => fmt(r, color(1, 0.9, 0.6), true)),
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId: newId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: data.rows[0]?.length ?? 1,
        },
      },
    },
  ];
  await api(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: fmtReqs }) });
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${newId}`;
}
