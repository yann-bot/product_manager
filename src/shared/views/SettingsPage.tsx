//
// Page « Paramètres » (/settings/view) — centralise la configuration de
// l'application. Le réglage éditable est l'ensemble des sources Google
// Sheet (multi-Sheet) : on peut en ajouter plusieurs à la fois, puis
// activer / désactiver / retirer chacune indépendamment. Le reste est de
// l'information système en lecture seule (variables d'environnement).
// Rendu 100 % serveur, sans JS client, dans le thème clair partagé.
//

import type { ReactNode } from "react";
import { shortSheetId, type SheetConfig } from "../settings";

interface SettingsPageProps {
  /** Tous les Sheets configurés et leur état d'activation. */
  sheets: SheetConfig[];
  /** Compte de service Google (pour le partage du Sheet). */
  serviceAccount: string | null;
  /** Cron de synchronisation actif ? (DISABLE_CRONS != "true") */
  cronEnabled: boolean;
  /** Port d'écoute du serveur. */
  port: number;
  /** Bannière de retour après une action. */
  status: { kind: "ok" | "err"; message: string } | null;
}

export function SettingsPage({
  sheets,
  serviceAccount,
  cronEnabled,
  port,
  status,
}: SettingsPageProps) {
  const enabledCount = sheets.filter((s) => s.enabled).length;

  return (
    <div className="wrap">
      {status && (
        <div className={status.kind === "ok" ? "alert alert-ok" : "alert"}>
          {status.message}
        </div>
      )}

      {/* ---- Ajout de sources Google Sheet ---- */}
      <section className="form" style={{ maxWidth: 640 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Sources Google Sheet</h2>
        <p className="sub" style={{ margin: "0 0 16px" }}>
          Les Sheets EasySell synchronisés chaque minute par le cron
          d'ingestion. Vous pouvez en ajouter plusieurs (un lien par ligne)
          puis activer ou désactiver chacun à volonté.
        </p>

        <div style={{ marginBottom: 16 }}>
          <span className={enabledCount > 0 ? "tag tag-active" : "tag"}>
            {enabledCount > 0
              ? `● ${enabledCount} source(s) active(s)`
              : "○ Aucune source active"}
          </span>
        </div>

        <form method="post" action="/settings/google-sheet">
          <input type="hidden" name="redirect" value="/settings/view" />
          <div className="field">
            <label htmlFor="links">Lien(s) du / des Google Sheet(s)</label>
            <textarea
              id="links"
              name="links"
              rows={3}
              placeholder={
                "https://docs.google.com/spreadsheets/d/…/edit\nhttps://docs.google.com/spreadsheets/d/…/edit"
              }
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary">
              Ajouter le(s) Sheet(s)
            </button>
          </div>
        </form>

        {serviceAccount && (
          <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
            Partagez d'abord chaque Sheet (accès lecture) avec{" "}
            <span className="ref">{serviceAccount}</span>.
          </p>
        )}
      </section>

      {/* ---- Sheets configurés (activer / désactiver / retirer) ---- */}
      {sheets.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="section-h">Sheets configurés</div>
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Identifiant</th>
                <th>État</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.id}>
                  <td className="strong">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </td>
                  <td>
                    <span className="ref">{shortSheetId(s.id)}</span>
                  </td>
                  <td>
                    {s.enabled ? (
                      <span className="tag tag-active">actif</span>
                    ) : (
                      <span className="tag">désactivé</span>
                    )}
                  </td>
                  <td className="num">
                    <div
                      style={{
                        display: "inline-flex",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      <form method="post" action="/settings/sheets/toggle">
                        <input type="hidden" name="redirect" value="/settings/view" />
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={s.enabled ? "0" : "1"}
                        />
                        <button type="submit" className="btn">
                          {s.enabled ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                      <form method="post" action="/settings/sheets/remove">
                        <input type="hidden" name="redirect" value="/settings/view" />
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="btn btn-danger">
                          Retirer
                        </button>
                      </form>
                    </div>
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
          <Row label="Sheets configurés">
            {sheets.length} ({enabledCount} actif/s)
          </Row>
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
