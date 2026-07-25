import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConsentService } from './services/consent.service';

/**
 * Bank-hosted PSU login + consent capture. Reachable directly by the PSU's
 * browser (no mTLS, no client cert - same as any normal bank webpage),
 * never proxied through a TPP. This is deliberately a minimal hand-rolled
 * page, not a framework: real PSU authentication (password/OTP/banking-app
 * push) is out of scope for this reference implementation - the point
 * being demonstrated is *where* this step must happen (bank-hosted), not
 * how the bank authenticates its own customers.
 */

// Mock PSU (bank customer) directory - NOT how real bank authentication
// works, purely so this reference has something to demonstrate the
// bank-hosted login step with.
const MOCK_PSUS: Record<string, string> = {
  psu1: 'password123',
  psu2: 'password123',
};

@Controller('auth/ui')
export class ConsentUiController {
  constructor(private consentService: ConsentService) {}

  @Get('login/:consentId')
  renderLogin(@Param('consentId') consentId: string, @Res() res: Response, @Query('error') error?: string) {
    res.type('html').send(loginPage(consentId, error === '1'));
  }

  @Post('login/:consentId')
  handleLogin(
    @Param('consentId') consentId: string,
    @Body('username') username: string,
    @Body('password') password: string,
    @Res() res: Response,
  ) {
    if (MOCK_PSUS[username] !== password) {
      return res.redirect(`/auth/ui/login/${consentId}?error=1`);
    }
    res.redirect(`/auth/ui/consent/${consentId}?psu=${encodeURIComponent(username)}`);
  }

  @Get('consent/:consentId')
  async renderConsent(
    @Param('consentId') consentId: string,
    @Query('psu') psu: string,
    @Res() res: Response,
  ) {
    if (!psu) {
      return res.redirect(`/auth/ui/login/${consentId}`);
    }

    const consent = await this.consentService.getConsentDetails(consentId);
    res.type('html').send(consentPage(consent, psu));
  }
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; color: #1a1a1a; }
    h1 { font-size: 1.25rem; }
    label { display: block; margin: 1rem 0 0.25rem; font-size: 0.9rem; }
    input[type=text], input[type=password] { width: 100%; padding: 0.5rem; box-sizing: border-box; }
    button { margin-top: 1.5rem; padding: 0.6rem 1.2rem; cursor: pointer; }
    .error { color: #b00020; font-size: 0.9rem; }
    .scope { margin: 0.75rem 0; }
    .bank-badge { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="bank-badge">Open Banking Nigeria - Bank-hosted</div>
  ${body}
</body>
</html>`;
}

function loginPage(consentId: string, showError: boolean): string {
  return pageShell(
    'Log in to your bank',
    `
    <h1>Log in to approve data sharing</h1>
    ${showError ? '<p class="error">Incorrect username or password.</p>' : ''}
    <form method="POST" action="/auth/ui/login/${escapeHtml(consentId)}">
      <label>Username</label>
      <input type="text" name="username" required autofocus>
      <label>Password</label>
      <input type="password" name="password" required>
      <button type="submit">Log in</button>
    </form>
    <p style="font-size:0.8rem;color:#666;margin-top:2rem">Demo credentials: psu1 / password123</p>
  `,
  );
}

function consentPage(consent: any, psu: string): string {
  const scopeCheckboxes = consent.permissions
    .map(
      (p: any) => `
      <div class="scope">
        <label style="display:flex;align-items:center;gap:0.5rem">
          <input type="checkbox" class="scope-checkbox" value="${escapeHtml(p.type)}" ${p.required ? 'checked disabled' : ''}>
          ${escapeHtml(p.description)} ${p.required ? '(required)' : ''}
        </label>
      </div>`,
    )
    .join('');

  return pageShell(
    'Approve data sharing',
    `
    <h1>${escapeHtml(consent.clientName)} wants to access your account</h1>
    <p>Logged in as <strong>${escapeHtml(psu)}</strong></p>
    <div id="scopes">${scopeCheckboxes}</div>
    <div id="accounts-section">
      <label>Account ID(s) to share</label>
      <input type="text" id="account-input" placeholder="e.g. 1234567890">
      <button type="button" id="add-account">Add account</button>
      <ul id="account-list"></ul>
    </div>
    <div id="error" class="error"></div>
    <button id="approve">Approve</button>
    <button id="deny" style="background:#eee">Deny</button>
    <script>
      const consentId = ${JSON.stringify(consent.id)};
      const redirectUri = ${JSON.stringify(consent.redirectUri)};
      const psu = ${JSON.stringify(psu)};
      const accounts = [];

      document.getElementById('add-account').onclick = () => {
        const input = document.getElementById('account-input');
        if (input.value.trim()) {
          accounts.push(input.value.trim());
          const li = document.createElement('li');
          li.textContent = input.value.trim();
          document.getElementById('account-list').appendChild(li);
          input.value = '';
        }
      };

      async function submit(approved) {
        const permissions = Array.from(document.querySelectorAll('.scope-checkbox'))
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        const res = await fetch('/auth/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consentId, approved, permissions, accounts, userId: psu }),
        });

        if (!res.ok) {
          document.getElementById('error').textContent = 'Something went wrong. Please try again.';
          return;
        }

        if (!approved) {
          window.location.href = redirectUri + (redirectUri.includes('?') ? '&' : '?') + 'error=access_denied';
          return;
        }

        const data = await res.json();
        window.location.href = redirectUri + (redirectUri.includes('?') ? '&' : '?') + 'code=' + encodeURIComponent(data.code);
      }

      document.getElementById('approve').onclick = () => submit(true);
      document.getElementById('deny').onclick = () => submit(false);
    </script>
  `,
  );
}
