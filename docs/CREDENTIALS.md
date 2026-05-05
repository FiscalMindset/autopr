# Real Credentials And Live Delivery

AutoPR currently generates platform-ready content, routes it in Kestra, and either:

- saves a dry-run output for copy/paste, or
- sends the platform payload to a live delivery adapter webhook.

It does not directly post to LinkedIn, X, Instagram, or WhatsApp unless you connect a real adapter that owns the platform OAuth tokens.

## GitHub input token

Use this when you want private repos, higher rate limits, or authenticated GitHub plugin enrichment.

1. GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens.
2. Generate a token scoped to the repos AutoPR should read.
3. Grant read-only repository permissions needed for repo metadata, contents, commits, and pull requests.
4. Paste it into the GitHub token field in the AutoPR frontend.

For `FiscalMindset/autopr`, public repo fetching works without a token, but authenticated reads are more reliable.

## LinkedIn posting

LinkedIn posting needs an app in the LinkedIn Developer portal and an OAuth access token with posting permission:

- Member posting: `w_member_social`
- Organization page posting: `w_organization_social`

For organization posting you also need the organization/page URN, for example `urn:li:organization:123456`.

Recommended adapter environment:

```bash
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_AUTHOR_URN=urn:li:person:... # or urn:li:organization:...
LINKEDIN_VERSION=202604
```

The adapter should receive AutoPR's webhook payload and call `POST https://api.linkedin.com/rest/posts`.

## X posting

X posting needs a developer app and user-context OAuth credentials with write permission.

Recommended scopes:

```text
tweet.read tweet.write users.read offline.access
```

Recommended adapter environment:

```bash
X_CLIENT_ID=...
X_CLIENT_SECRET=...
X_ACCESS_TOKEN=...
X_REFRESH_TOKEN=...
```

The adapter should refresh the token when needed and call the X post endpoint.

## Instagram publishing

Instagram publishing uses Meta's Instagram Graph API. You need:

- a Meta app,
- an Instagram professional account,
- a Facebook Page connected to that Instagram account,
- Graph API permissions approved for publishing,
- a Page/User access token usable by the app.

Recommended adapter environment:

```bash
META_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
```

For publishing, the adapter usually creates a media container, then publishes it.

## WhatsApp / DM delivery

WhatsApp Cloud API needs:

- a Meta app,
- a WhatsApp Business Account,
- a phone number ID,
- a token with WhatsApp messaging permission.

Recommended adapter environment:

```bash
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TO_NUMBER=...
```

The adapter should receive AutoPR's `whatsapp_dm` output and call the Cloud API messages endpoint.

## How to connect live mode now

1. Build a small adapter service with a route like `POST /autopr-deliver`.
2. Store platform tokens only in that adapter's server environment.
3. Put the adapter URL into AutoPR's `Delivery Adapter Webhook URL`.
4. Turn off Dry Run.
5. Trigger Kestra Live Adapter.

If no adapter URL is provided, AutoPR blocks live mode. That is intentional because pretending to post would be worse than a clear dry run.
