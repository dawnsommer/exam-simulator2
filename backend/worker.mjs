const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

const REDIRECT_URI =
  "https://study-tools-auth-worker.summerofdawn20.workers.dev/oauth/callback";
  
const ALLOWED_APPS = {
  "step-simulator-progress": {
    returnUrls: [
      "https://dawnsommer.github.io/step-simulator-progress/"
    ]
  },

  "exam-simulator2": {
    returnUrls: [
      "https://dawnsommer.github.io/exam-simulator2/"
    ]
  },

    "thundertracker": {
    returnUrls: [
      "https://dawnsommer.github.io/thundertracker/"
    ]
  },

  "thundershadow": {
  returnUrls: [
    "https://dawnsommer.github.io/ThunderShadow/"
  ]
}
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        const cors = getCorsHeaders(request);

        if (!cors) {
          return new Response(null, { status: 403 });
        }

        return new Response(null, {
          status: 204,
          headers: cors
        });
      }

      if (url.pathname.startsWith('/exam-simulator2/updates/')) {
        return handleFormUpdates(request, env);
      }

      if (url.pathname === "/health") {
        return json({
          ok: true,
          service: "study-tools-auth-worker"
        });
      }

      if (
        url.pathname === "/oauth/start" &&
        request.method === "GET"
      ) {
        return handleOAuthStart(request, env);
      }

      if (
        url.pathname === "/oauth/callback" &&
        request.method === "GET"
      ) {
        return handleOAuthCallback(request, env);
      }

      if (
        url.pathname === "/token" &&
        request.method === "POST"
      ) {
        return handleToken(request, env);
      }

      if (
        url.pathname === "/disconnect" &&
        request.method === "POST"
      ) {
        return handleDisconnect(request, env);
      }

      return new Response("Not Found", {
        status: 404
      });

    } catch (error) {
      console.error(
        "Worker error:",
        error?.message || error
      );

      return json(
        {
          error: "internal_error"
        },
        500
      );
    }
  }
};


async function handleOAuthStart(request, env) {
  await cleanupOAuthStates(env);
  const url = new URL(request.url);

  const appId =
    url.searchParams.get("app_id");

  const returnUrl =
    url.searchParams.get("return_url");

  const deviceId =
    url.searchParams.get("device_id") || null;

  if (!isAllowedReturnUrl(appId, returnUrl)) {
    return json(
      {
        error: "invalid_return_url"
      },
      400
    );
  }

  const state = randomToken(32);

  const now = Date.now();

  const expiresAt =
    now + 10 * 60 * 1000;

  await env.AUTH_DB.prepare(`
    INSERT INTO oauth_states (
      state,
      app_id,
      return_url,
      device_id,
      created_at,
      expires_at,
      used_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL)
  `)
    .bind(
      state,
      appId,
      returnUrl,
      deviceId,
      now,
      expiresAt
    )
    .run();

  const googleUrl =
    new URL(GOOGLE_AUTH_URL);

  googleUrl.searchParams.set(
    "client_id",
    env.GOOGLE_CLIENT_ID
  );

  googleUrl.searchParams.set(
    "redirect_uri",
    REDIRECT_URI
  );

  googleUrl.searchParams.set(
    "response_type",
    "code"
  );

  googleUrl.searchParams.set(
    "scope",
    GOOGLE_SCOPE
  );

  googleUrl.searchParams.set(
    "access_type",
    "offline"
  );

  googleUrl.searchParams.set(
    "prompt",
    "consent"
  );

  googleUrl.searchParams.set(
    "state",
    state
  );

  return Response.redirect(
    googleUrl.toString(),
    302
  );
}


async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);

  const code =
    url.searchParams.get("code");

  const state =
    url.searchParams.get("state");

  const oauthError =
    url.searchParams.get("error");

  if (!state) {
    return new Response(
      "Missing OAuth state.",
      {
        status: 400
      }
    );
  }

  const stateRow =
    await env.AUTH_DB.prepare(`
      SELECT *
      FROM oauth_states
      WHERE state = ?
      LIMIT 1
    `)
      .bind(state)
      .first();

  if (!stateRow) {
    return new Response(
      "Invalid OAuth state.",
      {
        status: 400
      }
    );
  }

  if (stateRow.used_at) {
    return new Response(
      "OAuth state already used.",
      {
        status: 400
      }
    );
  }

  if (
    Date.now() >
    Number(stateRow.expires_at)
  ) {
    return new Response(
      "OAuth state expired.",
      {
        status: 400
      }
    );
  }

  if (oauthError) {
    return redirectWithError(
      stateRow.return_url,
      oauthError
    );
  }

  if (!code) {
    return new Response(
      "Missing authorization code.",
      {
        status: 400
      }
    );
  }

  await env.AUTH_DB.prepare(`
    UPDATE oauth_states
    SET used_at = ?
    WHERE state = ?
  `)
    .bind(
      Date.now(),
      state
    )
    .run();

  const tokenResponse =
    await fetch(
      GOOGLE_TOKEN_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          client_id:
            env.GOOGLE_CLIENT_ID,

          client_secret:
            env.GOOGLE_CLIENT_SECRET,

          code,

          grant_type:
            "authorization_code",

          redirect_uri:
            REDIRECT_URI
        })
      }
    );

  const tokens =
    await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error(
      "Google token exchange failed",
      tokens?.error
    );

    return redirectWithError(
      stateRow.return_url,
      "token_exchange_failed"
    );
  }

  if (!tokens.refresh_token) {
    return redirectWithError(
      stateRow.return_url,
      "refresh_token_missing"
    );
  }

  const account =
    await getGoogleAccount(
      tokens.access_token
    );

  if (!account?.accountId) {
    return redirectWithError(
      stateRow.return_url,
      "google_account_lookup_failed"
    );
  }

  const encrypted =
    await encryptRefreshToken(
      tokens.refresh_token,
      env.TOKEN_ENCRYPTION_KEY
    );

  const now =
    Date.now();

  await env.AUTH_DB.prepare(`
    INSERT INTO google_accounts (
      account_id,
      email,
      encrypted_refresh_token,
      refresh_token_iv,
      created_at,
      updated_at,
      revoked_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL)

    ON CONFLICT(account_id)
    DO UPDATE SET
      email =
        excluded.email,

      encrypted_refresh_token =
        excluded.encrypted_refresh_token,

      refresh_token_iv =
        excluded.refresh_token_iv,

      updated_at =
        excluded.updated_at,

      revoked_at =
        NULL
  `)
    .bind(
      account.accountId,
      account.email || null,
      encrypted.ciphertext,
      encrypted.iv,
      now,
      now
    )
    .run();

  const rawSessionToken =
    randomToken(32);

  const sessionHash =
    await sha256Hex(
      rawSessionToken
    );

  await env.AUTH_DB.prepare(`
    INSERT INTO sessions (
      session_hash,
      account_id,
      app_id,
      device_id,
      created_at,
      last_used_at,
      expires_at,
      revoked_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
  `)
    .bind(
      sessionHash,
      account.accountId,
      stateRow.app_id,
      stateRow.device_id,
      now,
      now
    )
    .run();

  const returnUrl =
    new URL(
      stateRow.return_url
    );

  returnUrl.hash =
    `cloud-auth=${encodeURIComponent(rawSessionToken)}`;

  return Response.redirect(
    returnUrl.toString(),
    302
  );
}


async function handleToken(request, env) {
  const cors =
    getCorsHeaders(request);

  if (!cors) {
    return json(
      {
        error:
          "origin_not_allowed"
      },
      403
    );
  }

  const rawSessionToken =
    getBearerToken(request);

  if (!rawSessionToken) {
    return json(
      {
        error:
          "missing_session"
      },
      401,
      cors
    );
  }

  const sessionHash =
    await sha256Hex(
      rawSessionToken
    );

  const row =
    await env.AUTH_DB.prepare(`
      SELECT
        s.session_hash,
        s.account_id,
        s.app_id,

        s.revoked_at
          AS session_revoked_at,

        g.email,

        g.encrypted_refresh_token,

        g.refresh_token_iv,

        g.revoked_at
          AS account_revoked_at

      FROM sessions s

      JOIN google_accounts g
        ON g.account_id =
           s.account_id

      WHERE
        s.session_hash = ?

      LIMIT 1
    `)
      .bind(sessionHash)
      .first();

  if (
    !row ||
    row.session_revoked_at ||
    row.account_revoked_at
  ) {
    return json(
      {
        error:
          "invalid_session"
      },
      401,
      cors
    );
  }

  const refreshToken =
    await decryptRefreshToken(
      row.encrypted_refresh_token,
      row.refresh_token_iv,
      env.TOKEN_ENCRYPTION_KEY
    );

  const response =
    await fetch(
      GOOGLE_TOKEN_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          client_id:
            env.GOOGLE_CLIENT_ID,

          client_secret:
            env.GOOGLE_CLIENT_SECRET,

          refresh_token:
            refreshToken,

          grant_type:
            "refresh_token"
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    if (
      data?.error ===
      "invalid_grant"
    ) {
      return json(
        {
          error:
            "google_reauthorization_required"
        },
        401,
        cors
      );
    }

    return json(
      {
        error:
          "google_token_refresh_failed"
      },
      502,
      cors
    );
  }

const now = Date.now();

await env.AUTH_DB.prepare(`
  UPDATE sessions
  SET last_used_at = ?
  WHERE session_hash = ?
  AND (
    last_used_at IS NULL
    OR last_used_at < ?
  )
`)
.bind(
  now,
  sessionHash,
  now - (24 * 60 * 60 * 1000)
)
.run();


  return json(
    {
      accessToken:
        data.access_token,

      expiresIn:
        data.expires_in,

      tokenType:
        data.token_type,

      email:
        row.email || null,

      appId:
        row.app_id
    },
    200,
    cors
  );
}


async function handleDisconnect(request, env) {
  const cors =
    getCorsHeaders(request);

  if (!cors) {
    return json(
      {
        error:
          "origin_not_allowed"
      },
      403
    );
  }

  const rawSessionToken =
    getBearerToken(request);

  if (!rawSessionToken) {
    return json(
      {
        error:
          "missing_session"
      },
      401,
      cors
    );
  }

  const sessionHash =
    await sha256Hex(
      rawSessionToken
    );

  await env.AUTH_DB.prepare(`
    UPDATE sessions

    SET revoked_at = ?

    WHERE session_hash = ?
  `)
    .bind(
      Date.now(),
      sessionHash
    )
    .run();

  return json(
    {
      ok: true
    },
    200,
    cors
  );
}


async function getGoogleAccount(accessToken) {
  const response =
    await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user",
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  return {
    accountId:
      data?.user?.permissionId ||
      data?.user?.emailAddress ||
      null,

    email:
      data?.user?.emailAddress ||
      null
  };
}


function isAllowedReturnUrl(
  appId,
  returnUrl
) {
  if (!appId || !returnUrl) {
    return false;
  }

  const app =
    ALLOWED_APPS[appId];

  if (!app) {
    return false;
  }

  try {
    const normalized =
      new URL(returnUrl)
        .toString();

    return app.returnUrls.some(
      allowed =>
        new URL(allowed)
          .toString() ===
        normalized
    );

  } catch {
    return false;
  }
}


function getCorsHeaders(request) {
  const origin =
    request.headers.get("Origin");

  const allowedOrigins =
    new Set([
      "https://dawnsommer.github.io"
    ]);

  if (
    !origin ||
    !allowedOrigins.has(origin)
  ) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin":
      origin,

    "Access-Control-Allow-Headers":
      "Authorization, Content-Type",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Vary":
      "Origin",

    "Cache-Control":
      "no-store"
  };
}


function getBearerToken(request) {
  const header =
    request.headers.get(
      "Authorization"
    ) || "";

  if (
    !header.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  return header
    .slice(7)
    .trim();
}


function redirectWithError(
  returnUrl,
  error
) {
  const url =
    new URL(returnUrl);

  url.hash =
    `cloud-auth-error=${encodeURIComponent(error)}`;

  return Response.redirect(
    url.toString(),
    302
  );
}


function randomToken(
  byteLength = 32
) {
  const bytes =
    new Uint8Array(
      byteLength
    );

  crypto.getRandomValues(
    bytes
  );

  return base64UrlEncode(
    bytes
  );
}


async function sha256Hex(value) {
  const bytes =
    new TextEncoder()
      .encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return [
    ...new Uint8Array(
      digest
    )
  ]
    .map(
      b =>
        b
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}


async function encryptRefreshToken(
  token,
  secret
) {
  const key =
    await importEncryptionKey(
      secret
    );

  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );

  const plaintext =
    new TextEncoder()
      .encode(token);

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name:
          "AES-GCM",

        iv
      },

      key,

      plaintext
    );

  return {
    ciphertext:
      base64UrlEncode(
        new Uint8Array(
          encrypted
        )
      ),

    iv:
      base64UrlEncode(
        iv
      )
  };
}


async function decryptRefreshToken(
  ciphertext,
  iv,
  secret
) {
  const key =
    await importEncryptionKey(
      secret
    );

  const decrypted =
    await crypto.subtle.decrypt(
      {
        name:
          "AES-GCM",

        iv:
          base64UrlDecode(iv)
      },

      key,

      base64UrlDecode(
        ciphertext
      )
    );

  return new TextDecoder()
    .decode(decrypted);
}


async function importEncryptionKey(
  secret
) {
  const raw =
    base64ToBytes(secret);

  if (
    raw.byteLength !== 32
  ) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes"
    );
  }

  return crypto.subtle.importKey(
    "raw",

    raw,

    {
      name:
        "AES-GCM"
    },

    false,

    [
      "encrypt",
      "decrypt"
    ]
  );
}


function base64ToBytes(value) {
  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const padded =
    normalized +
    "=".repeat(
      (
        4 -
        (
          normalized.length %
          4
        )
      ) %
      4
    );

  const binary =
    atob(padded);

  return Uint8Array.from(
    binary,
    char =>
      char.charCodeAt(0)
  );
}


function base64UrlEncode(bytes) {
  let binary = "";

  for (
    const byte of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlDecode(value) {
  return base64ToBytes(value);
}


function json(
  body,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store",

        ...extraHeaders
      }
    }
  );
}
async function cleanupOAuthStates(env) {
  const cutoff =
    Date.now() - (14 * 24 * 60 * 60 * 1000);

  await env.AUTH_DB.prepare(`
    DELETE FROM oauth_states
    WHERE created_at < ?
  `)
  .bind(cutoff)
  .run();
}

/* exam-simulator2 form update receipts and independent browser admin grants. */
async function handleFormUpdates(request, env) {
  const cors=getCorsHeaders(request);
  if(!cors)return json({error:'origin_not_allowed'},403);
  const reply=(body,status=200)=>json(body,status,cors);
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  const path=new URL(request.url).pathname.slice('/exam-simulator2/updates/'.length);
  try {
    const raw=await request.text();
    if(raw.length>16384)return reply({error:'request_too_large'},413);
    let body;try{body=raw?JSON.parse(raw):{};}catch(_){return reply({error:'invalid_json'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'invalid_request'},400);
    if(path==='admin/unlock') {
      if(!env.EXAM2_ADMIN_PASSWORD)return reply({error:'Admin password has not been configured.'},503);
      const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'unknown';
      const attemptKey=await sha256Hex('exam2-admin:'+ip),attempt=await env.AUTH_DB.prepare('SELECT failures, reset_at FROM exam2_admin_attempts WHERE attempt_key = ?').bind(attemptKey).first();
      if(attempt&&attempt.reset_at>now&&attempt.failures>=5)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
      // Hash both values to make password comparison independent of string length.
      const submitted=await sha256Hex(String(body.password||'')),expected=await sha256Hex(env.EXAM2_ADMIN_PASSWORD);
      let difference=0;for(let i=0;i<expected.length;i++)difference|=submitted.charCodeAt(i)^expected.charCodeAt(i);
      if(difference){
        await env.AUTH_DB.prepare(`INSERT INTO exam2_admin_attempts (attempt_key, failures, reset_at) VALUES (?, 1, ?)
          ON CONFLICT(attempt_key) DO UPDATE SET failures = CASE WHEN reset_at <= ? THEN 1 ELSE failures + 1 END,
          reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END`).bind(attemptKey,now+900000,now,now).run();
        return reply({error:'Incorrect admin password.'},403);
      }
      await env.AUTH_DB.prepare('DELETE FROM exam2_admin_attempts WHERE attempt_key = ?').bind(attemptKey).run();
      const token=randomToken(32),hash=await sha256Hex(token);
      await env.AUTH_DB.prepare('INSERT INTO exam2_admin_sessions (token_hash, created_at, revoked_at) VALUES (?, ?, NULL)').bind(hash,now).run();
      return reply({ok:true,token});
    }
    if(path.startsWith('admin/')) {
      const token=getBearerToken(request);
      if(!token)return reply({error:'Admin is locked.'},401);
      const hash=await sha256Hex(token),session=await env.AUTH_DB.prepare('SELECT token_hash FROM exam2_admin_sessions WHERE token_hash = ? AND revoked_at IS NULL').bind(hash).first();
      if(!session)return reply({error:'Admin is locked.'},401);
      if(path==='admin/lock') {await env.AUTH_DB.prepare('UPDATE exam2_admin_sessions SET revoked_at = ? WHERE token_hash = ?').bind(Date.now(),hash).run();return reply({ok:true});}
      if(path==='admin/status')return reply({ok:true});
      if(path==='admin/receipts') {
        const after=Number(body.after||0);if(!Number.isSafeInteger(after)||after<0)return reply({error:'invalid_cursor'},400);
        const search=String(body.search||'').slice(0,120),form=String(body.formId||'').slice(0,120),revision=String(body.revision||'').slice(0,64);
        const pattern='%'+search.replace(/[\\%_]/g,c=>'\\'+c)+'%';
        const result=await env.AUTH_DB.prepare(`SELECT receipt_id, installation_id, form_id, revision, title, device_label, account_email, installed_at, received_at
          FROM exam2_update_receipts WHERE (? = 0 OR receipt_id < ?) AND (? = '' OR form_id = ?) AND (? = '' OR revision = ?)
          AND (? = '' OR account_email LIKE ? ESCAPE '\\' OR device_label LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR form_id LIKE ? ESCAPE '\\')
          ORDER BY receipt_id DESC LIMIT 101`).bind(after,after,form,form,revision,revision,search,pattern,pattern,pattern,pattern).all();
        const rows=result.results||[],more=rows.length>100;rows.length=Math.min(100,rows.length);
        return reply({ok:true,rows,nextCursor:more?rows[rows.length-1].receipt_id:null});
      }
      return reply({error:'not_found'},404);
    }
    if(path==='receipt') {
      const r=body;
      if(!/^[A-Za-z0-9_-]{1,120}$/.test(r.formId||'')||r.formId.toUpperCase()==='QBANK_MODE'||!/^[a-f0-9]{64}$/.test(r.revision||'')||!/^[A-Za-z0-9_-]{8,120}$/.test(r.installationId||'')||typeof r.deviceLabel!=='string'||!r.deviceLabel.trim()||r.deviceLabel.length>80||!Number.isFinite(Date.parse(r.installedAt||'')))return reply({error:'invalid_receipt'},400);
      let account=null;
      const sessionToken=getBearerToken(request);
      if(sessionToken){
        const hash=await sha256Hex(sessionToken);
        account=await env.AUTH_DB.prepare(`SELECT s.account_id, g.email FROM sessions s JOIN google_accounts g ON g.account_id = s.account_id
          WHERE s.session_hash = ? AND s.app_id = 'exam-simulator2' AND s.revoked_at IS NULL AND g.revoked_at IS NULL
          AND (s.expires_at IS NULL OR s.expires_at > ?) LIMIT 1`).bind(hash,Date.now()).first();
        if(!account)return reply({error:'invalid_session'},401);
      }
      const title=String(r.title||r.formId).slice(0,200);
      await env.AUTH_DB.prepare(`INSERT INTO exam2_update_receipts (installation_id, form_id, revision, title, device_label, account_id, account_email, installed_at, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(installation_id, form_id, revision) DO NOTHING`).bind(r.installationId,r.formId,r.revision,title,r.deviceLabel.trim(),account?.account_id||null,account?.email||null,new Date(r.installedAt).toISOString(),new Date().toISOString()).run();
      return reply({ok:true});
    }
    return reply({error:'not_found'},404);
  } catch(error) {
    console.error('Form update endpoint failed',error?.message||'unknown');
    return reply({error:'Update reporting is unavailable. Check the Worker database setup.'},503);
  }
}
