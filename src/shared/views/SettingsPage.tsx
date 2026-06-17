//
// Page « Paramètres » (/settings/view) — centralise la configuration de
// l'application. Aujourd'hui le seul réglage réellement éditable est la
// source Google Sheet (clé/valeur en base via `app_settings`) ; le reste
// est de l'information système en lecture seule (variables d'environnement).
// Rendu 100 % serveur, sans JS client, dans le thème clair partagé.
//

import type { ReactNode } from "react";
import { shortSheetId } from "../settings";

interface SettingsPageProps {
  /** Sheet actif (id) et son lien d'origine, si configurés. */
  sheetId: string | null;
  sheetUrl: string | null;
  /** Tous les Sheets connus : id -> titre lisible. */
  sheetNames: Record<string, string>;
  /** Compte de service Google (pour le partage du Sheet). */
  serviceAccount: string | null;
  /** Cron de synchronisation actif ? (DISABLE_CRONS != "true") */
  cronEnabled: boolean;
  /** Port d'écoute du serveur. */
  port: number;
  /** Bannière de retour après une tentative de connexion. */
  status: { kind: "ok" | "err"; message: string } | null;
}

export function SettingsPage({
  sheetId,
  sheetUrl,
  sheetNames,
  serviceAccount,
  cronEnabled,
  port,
  status,
}: SettingsPageProps) {
  const connected = Boolean(sheetId);
  const sheets = Object.entries(sheetNames);

  return (
    <div className="wrap">
      {status && (
        <div className={status.kind === "ok" ? "alert alert-ok" : "alert"}>
          {status.message}
        </div>
      )}

      {/* ---- Source Google Sheet (seul réglage éditable) ---- */}
      <section className="form" style={{ maxWidth: 640 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Source Google Sheet</h2>
        <p className="sub" style={{ margin: "0 0 16px" }}>
          Le Sheet EasySell synchronisé chaque minute par le cron d'ingestion.
        </p>

        <div style={{ marginBottom: 16 }}>
          <span className={connected ? "tag tag-active" : "tag"}>
            {connected ? "● Source connectée" : "○ Non configurée"}
          </span>
        </div>

        {connected && sheetId && (
          <div className="field">
            <label>Sheet actif</label>
            <div>
              <span className="ref">{sheetId}</span>
            </div>
          </div>
        )}

        <form method="post" action="/settings/google-sheet">
          <input type="hidden" name="redirect" value="/settings/view" />
          <div className="field">
            <label htmlFor="url">Lien du Google Sheet</label>
            <input
              id="url"
              name="url"
              type="url"
              defaultValue={sheetUrl ?? ""}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary">
              {connected ? "Mettre à jour la source" : "Connecter le Sheet"}
            </button>
          </div>
        </form>

        {serviceAccount && (
          <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
            Partagez d'abord le Sheet (accès lecture) avec{" "}
            <span className="ref">{serviceAccount}</span>.
          </p>
        )}
      </section>

      {/* ---- Sheets configurés (historique multi-source) ---- */}
      {sheets.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="section-h">Sheets configurés</div>
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Identifiant</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map(([id, name]) => (
                <tr key={id}>
                  <td className="strong">{name}</td>
                  <td>
                    <span className="ref">{shortSheetId(id)}</span>
                  </td>
                  <td>
                    {id === sheetId ? (
                      <span className="tag tag-active">actif</span>
                    ) : (
                      <span className="tag">archive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ---- Informations système (lecture seule) ---- */}
      <section style={{ marginTop: 24 }}>
        <div className="section-h">Informations système</div>
        <div className="detail">
          <Row label="Compte de service">
            {serviceAccount ? (
              <span className="ref">{serviceAccount}</span>
            ) : (
              <span className="muted">non défini</span>
            )}
          </Row>
          <Row label="Synchronisation">
            <span className={cronEnabled ? "tag tag-active" : "tag"}>
              {cronEnabled ? "cron actif (chaque minute)" : "cron désactivé"}
            </span>
          </Row>
          <Row label="Sheets configurés">{sheets.length}</Row>
          <Row label="Port d'écoute">{port}</Row>
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="lbl">{label}</div>
      <div className="val">{children}</div>
    </div>
  );
}
