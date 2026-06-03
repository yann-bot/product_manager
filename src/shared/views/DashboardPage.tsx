//
// Page principale du dashboard ("/"). Sert à connecter la source
// Google Sheet EasySell (on colle le lien ; l'ID est extrait et vérifié
// côté serveur via POST /settings/google-sheet). Une fois connecté, la
// synchro (CRON 1) alimente easysell_orders, consultables dans l'onglet
// « Commandes EasySell ».
//

interface DashboardPageProps {
  sheetId: string | null;
  sheetUrl: string | null;
  serviceAccount: string | null;
  status: { kind: "ok" | "err"; message: string } | null;
}

export function DashboardPage({
  sheetId,
  sheetUrl,
  serviceAccount,
  status,
}: DashboardPageProps) {
  const connected = Boolean(sheetId);

  return (
    <div className="wrap">
      {status ? (
        <div
          className="card"
          style={{
            borderColor: status.kind === "ok" ? "#22c55e" : "#ef4444",
            marginBottom: 16,
          }}
        >
          {status.message}
        </div>
      ) : null}

      <div className="cards" style={{ padding: 0, marginBottom: 16 }}>
        <div className="card">
          <div className="k">Source Google Sheet</div>
          <div className={connected ? "v accent" : "v"}>
            {connected ? "Connectée" : "Non configurée"}
          </div>
        </div>
        {connected ? (
          <div className="card">
            <div className="k">Sheet ID</div>
            <div className="v" style={{ fontSize: 14 }}>
              <span className="ref">{sheetId}</span>
            </div>
          </div>
        ) : null}
      </div>

      <form
        method="post"
        action="/settings/google-sheet"
        style={{ maxWidth: 560 }}
      >
        <label htmlFor="url" className="muted">
          Lien du Google Sheet EasySell
        </label>
        <input
          id="url"
          name="url"
          className="filter"
          type="url"
          defaultValue={sheetUrl ?? ""}
          placeholder="https://docs.google.com/spreadsheets/d/…/edit"
          style={{ maxWidth: "100%", marginTop: 6 }}
          required
        />
        <button
          type="submit"
          style={{
            marginTop: 12,
            padding: "9px 16px",
            background: "var(--accent)",
            color: "#0f172a",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {connected ? "Mettre à jour la source" : "Connecter le Sheet"}
        </button>
      </form>

      {serviceAccount ? (
        <p className="muted" style={{ marginTop: 16, maxWidth: 560 }}>
          Pensez à partager le Sheet (lecture) avec le compte de service{" "}
          <span className="ref">{serviceAccount}</span> avant de le connecter.
        </p>
      ) : null}
    </div>
  );
}
