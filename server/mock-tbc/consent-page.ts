/** The mock bank's consent screen: TBC's login and approval step, clearly marked as a simulation. */

export type PageLanguage = 'ka' | 'en';

export interface ConsentPageModel {
  sessionId: string;
  language: PageLanguage;
  clientId: string;
  validUntil: string;
  frequencyPerDay: number;
  accounts: ReadonlyArray<{ name: string; detail: string }>;
  /** Where the decision form posts. */
  formAction: string;
}

interface Text {
  ka: string;
  en: string;
}

const copy = {
  title: { ka: 'თიბისი ბანკი — ღია ბანკინგის თანხმობა', en: 'TBC Bank — open banking consent' },
  simulation: {
    ka: 'სიმულაცია: ეს არ არის თიბისი ბანკის ნამდვილი გვერდი. არც შესვლა და არც მონაცემები არ არის რეალური.',
    en: 'Simulation: this is not a real TBC Bank page. There is no real login and no real data.',
  },
  request: { ka: 'ითხოვს წვდომას შენს ანგარიშებზე:', en: 'is asking for access to your accounts:' },
  access: { ka: 'ანგარიშები, ნაშთები და ტრანზაქციების ისტორია', en: 'Accounts, balances and transaction history' },
  validUntil: { ka: 'მოქმედების ვადა', en: 'Valid until' },
  frequency: { ka: 'წაკითხვა დღეში, მაქსიმუმ', en: 'Reads per day, at most' },
  accounts: { ka: 'გასაზიარებელი ანგარიშები', en: 'Accounts to share' },
  approve: { ka: 'დადასტურება', en: 'Approve' },
  decline: { ka: 'უარყოფა', en: 'Decline' },
} satisfies Record<string, Text>;

export function renderConsentPage(model: ConsentPageModel): string {
  const t = (text: Text) => bilingual(text, model.language);
  const accounts = model.accounts
    .map((account) => `<li><strong>${escapeHtml(account.name)}</strong><span>${escapeHtml(account.detail)}</span></li>`)
    .join('');
  return page(
    model.language,
    copy.title,
    `<p class="lead"><strong>${escapeHtml(model.clientId)}</strong> ${t(copy.request)}</p>
    <ul class="facts">
      <li><span>${t(copy.access)}</span></li>
      <li><span>${t(copy.validUntil)}</span><strong>${escapeHtml(model.validUntil)}</strong></li>
      <li><span>${t(copy.frequency)}</span><strong>${model.frequencyPerDay}</strong></li>
    </ul>
    <h2>${t(copy.accounts)}</h2>
    <ul class="accounts">${accounts}</ul>
    <form method="post" action="${escapeHtml(model.formAction)}">
      <input type="hidden" name="sessionid" value="${escapeHtml(model.sessionId)}">
      <button type="submit" name="decision" value="approve" class="approve">${t(copy.approve)}</button>
      <button type="submit" name="decision" value="decline" class="decline">${t(copy.decline)}</button>
    </form>`,
  );
}

export function renderErrorPage(language: PageLanguage, message: Text): string {
  return page(language, copy.title, `<p class="lead">${bilingual(message, language)}</p>`);
}

function page(language: PageLanguage, title: Text, content: string): string {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title[language])} (sandbox simulation)</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #eef3f8; color: #0f2b46; }
  main { max-width: 440px; margin: 32px auto; padding: 0 16px; }
  .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(15, 43, 70, 0.08); }
  .banner { background: #fff4d6; border: 1px solid #f1c75b; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 14px; }
  h1 { font-size: 20px; margin: 0 0 16px; color: #00a3e0; }
  h2 { font-size: 15px; margin: 20px 0 8px; }
  .lead { font-size: 16px; line-height: 1.5; }
  ul { padding: 0; list-style: none; margin: 0; }
  .facts li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #edf1f5; font-size: 14px; }
  .accounts li { display: flex; flex-direction: column; padding: 8px 0; font-size: 14px; }
  .accounts span { color: #5b7085; font-size: 13px; }
  .other { display: block; color: #5b7085; font-size: 12px; margin-top: 2px; }
  form { display: flex; gap: 12px; margin-top: 24px; }
  button { flex: 1; border: 0; border-radius: 12px; padding: 14px; font-size: 15px; cursor: pointer; }
  .approve { background: #00a3e0; color: #fff; }
  .decline { background: #edf1f5; color: #0f2b46; }
</style>
</head>
<body>
<main>
  <div class="banner">${bilingual(copy.simulation, language)}</div>
  <div class="card">
    <h1>${bilingual(title, language)}</h1>
    ${content}
  </div>
</main>
</body>
</html>`;
}

/** The text in the page's language, with the other language underneath. */
function bilingual(text: Text, language: PageLanguage): string {
  const other: PageLanguage = language === 'ka' ? 'en' : 'ka';
  return `${escapeHtml(text[language])}<span class="other" lang="${other}">${escapeHtml(text[other])}</span>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
