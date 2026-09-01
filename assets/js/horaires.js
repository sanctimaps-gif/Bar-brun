/* =============================================================
   Bar Brun — calcul des horaires
   Aucune dépendance au navigateur : ce module est aussi chargé
   par tests/verifie.js sous Node.
   ============================================================= */

(function (racine) {
  'use strict';

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var JOURS_AFFICHES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  var MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  var JOUR_MS = 24 * 60 * 60 * 1000;

  /** '17:30' → 1050 (minutes depuis minuit). null si la valeur est invalide. */
  function enMinutes(heure) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(heure == null ? '' : heure).trim());
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  /** 1050 → '17 h 30' ; 1020 → '17 h'. */
  function formatHeure(minutes) {
    if (minutes == null) return '—';
    var h = Math.floor(minutes / 60) % 24;
    var m = minutes % 60;
    return m === 0 ? h + ' h' : h + ' h ' + (m < 10 ? '0' + m : m);
  }

  /** Comme formatHeure, mais une fermeture à 0 h se dit « minuit ». */
  function formatFermeture(minutes) {
    if (minutes == null) return '—';
    return (minutes % (24 * 60)) === 0 ? 'minuit' : formatHeure(minutes);
  }

  /** Date locale à partir de 'AAAA-MM-JJ' (+ heure facultative 'HH:MM'). */
  function dateLocale(iso, heure) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso));
    if (!d) return null;
    var minutes = enMinutes(heure) || 0;
    var date = new Date(
      parseInt(d[1], 10), parseInt(d[2], 10) - 1, parseInt(d[3], 10),
      Math.floor(minutes / 60), minutes % 60, 0, 0
    );
    // Rejette les dates impossibles du type 2026-02-31.
    if (date.getMonth() !== parseInt(d[2], 10) - 1) return null;
    return date;
  }

  function isoDuJour(date) {
    var mm = date.getMonth() + 1;
    var jj = date.getDate();
    return date.getFullYear() + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (jj < 10 ? '0' + jj : jj);
  }

  function minuit(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  /**
   * Crée le calculateur d'horaires pour un contenu donné.
   * @param {object} contenu — l'objet exporté par data/contenu.js
   */
  function creer(contenu) {
    var horaires = contenu.horaires || {};
    var fermetures = contenu.fermetures || [];
    var happyHour = contenu.happyHour || null;

    function periodeFermeture(date) {
      var iso = isoDuJour(date);
      for (var i = 0; i < fermetures.length; i++) {
        var f = fermetures[i];
        var du = f.du || f.date;
        var au = f.au || f.date || du;
        if (du && iso >= du && iso <= au) return f;
      }
      return null;
    }

    function estFerme(date) {
      return periodeFermeture(date) !== null;
    }

    function motifFermeture(date) {
      var f = periodeFermeture(date);
      return f ? (f.motif || 'Fermeture exceptionnelle') : '';
    }

    /**
     * Créneaux d'ouverture susceptibles de recouvrir « maintenant » : ceux
     * de la veille (fermeture après minuit), du jour et du lendemain.
     */
    function creneauxAutour(maintenant) {
      var creneaux = [];

      [-1, 0, 1, 2].forEach(function (decalage) {
        var jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + decalage);
        if (estFerme(jour)) return;

        var plages = horaires[JOURS[jour.getDay()]] || [];
        plages.forEach(function (plage) {
          var debut = enMinutes(plage.ouverture);
          var fin = enMinutes(plage.fermeture);
          if (debut == null || fin == null) return;

          var dateDebut = new Date(minuit(jour).getTime() + debut * 60000);
          // Une fermeture à 02:00 — ou à 00:00 — appartient au lendemain.
          var duree = fin > debut ? fin - debut : fin + 24 * 60 - debut;
          if (duree === 0) return;

          creneaux.push({ debut: dateDebut, fin: new Date(dateDebut.getTime() + duree * 60000) });
        });
      });

      creneaux.sort(function (a, b) { return a.debut - b.debut; });
      return creneaux;
    }

    /** @return {{ouvert: boolean, jusqua?: Date, prochain?: Date}} */
    function etatOuverture(maintenant) {
      var creneaux = creneauxAutour(maintenant);

      for (var i = 0; i < creneaux.length; i++) {
        if (maintenant >= creneaux[i].debut && maintenant < creneaux[i].fin) {
          return { ouvert: true, jusqua: creneaux[i].fin };
        }
      }

      for (var j = 0; j < creneaux.length; j++) {
        if (creneaux[j].debut > maintenant) {
          return { ouvert: false, prochain: creneaux[j].debut };
        }
      }

      return { ouvert: false, prochain: null };
    }

    /** Phrase affichée sous le titre : « Ouvert · jusqu'à 2 h », etc. */
    function texteStatut(maintenant) {
      var etat = etatOuverture(maintenant);

      if (etat.ouvert) {
        var minutesFin = etat.jusqua.getHours() * 60 + etat.jusqua.getMinutes();
        var restant = (etat.jusqua - maintenant) / 60000;
        var suffixe = restant <= 60 ? ' — dernier service' : '';
        return { etat: 'ouvert', texte: 'Ouvert maintenant · jusqu\'à ' + formatFermeture(minutesFin) + suffixe };
      }

      if (estFerme(maintenant)) {
        var motif = motifFermeture(maintenant);
        var reprise = etat.prochain ? ' · réouverture ' + quandLisible(etat.prochain, maintenant) : '';
        return { etat: 'ferme', texte: 'Fermé aujourd\'hui — ' + motif + reprise };
      }

      if (!etat.prochain) return { etat: 'ferme', texte: 'Fermé' };

      return { etat: 'ferme', texte: 'Fermé · ouvre ' + quandLisible(etat.prochain, maintenant) };
    }

    function quandLisible(date, maintenant) {
      var heure = formatHeure(date.getHours() * 60 + date.getMinutes());
      var ecart = Math.round((minuit(date) - minuit(maintenant)) / JOUR_MS);

      if (ecart === 0) return 'aujourd\'hui à ' + heure;
      if (ecart === 1) return 'demain à ' + heure;
      if (ecart < 7) return JOURS[date.getDay()] + ' à ' + heure;
      return 'le ' + date.getDate() + ' ' + MOIS[date.getMonth()] + ' à ' + heure;
    }

    function happyHourEnCours(maintenant) {
      if (!happyHour || !happyHour.actif) return false;
      if (estFerme(maintenant)) return false;
      if ((happyHour.jours || []).indexOf(JOURS[maintenant.getDay()]) === -1) return false;

      var debut = enMinutes(happyHour.debut);
      var fin = enMinutes(happyHour.fin);
      if (debut == null || fin == null || fin <= debut) return false;

      // L'happy hour n'a de sens que si le bar est effectivement ouvert.
      if (!etatOuverture(maintenant).ouvert) return false;

      var m = maintenant.getHours() * 60 + maintenant.getMinutes();
      return m >= debut && m < fin;
    }

    /** Lignes du tableau des horaires, dans l'ordre lundi → dimanche. */
    function semaine() {
      return JOURS_AFFICHES.map(function (jour) {
        var plages = horaires[jour] || [];
        return {
          jour: jour,
          libelle: jour.charAt(0).toUpperCase() + jour.slice(1),
          ferme: plages.length === 0,
          texte: plages.length
            ? plages.map(function (p) {
                return formatHeure(enMinutes(p.ouverture)) + ' – ' + formatFermeture(enMinutes(p.fermeture));
              }).join(' · ')
            : 'Fermé',
        };
      });
    }

    /** Fermetures exceptionnelles encore à venir. */
    function fermeturesAVenir(maintenant) {
      var iso = isoDuJour(maintenant || new Date());
      return fermetures.filter(function (f) {
        return (f.au || f.du || f.date) >= iso;
      });
    }

    return {
      estFerme: estFerme,
      motifFermeture: motifFermeture,
      etatOuverture: etatOuverture,
      texteStatut: texteStatut,
      happyHourEnCours: happyHourEnCours,
      semaine: semaine,
      fermeturesAVenir: fermeturesAVenir,
    };
  }

  var api = {
    creer: creer,
    enMinutes: enMinutes,
    formatHeure: formatHeure,
    formatFermeture: formatFermeture,
    dateLocale: dateLocale,
    isoDuJour: isoDuJour,
    JOURS: JOURS,
    JOURS_AFFICHES: JOURS_AFFICHES,
    MOIS: MOIS,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.Horaires = api;
})(typeof window !== 'undefined' ? window : this);
